import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { recomputeOrderHealth } from './work-order-health.service.js'
import * as repo from './work-order.repository.js'
import type { CompleteWorkOrderInput, HoldWorkOrderInput, ResumeWorkOrderInput, StartWorkOrderInput } from './work-order.schemas.js'
import { isPositive, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { collectQualityBlockers } from '../../quality/shared/blockers.service.js'
import { getFgEligibility } from '../fg-receipts/fg-eligibility.service.js'
import { postFinishedGoodsReceipt } from '../fg-receipts/fg-receipt.service.js'
import { getManufacturingSettingsForTenant } from '../settings/manufacturing-settings.service.js'

async function audit(req: Request, tenantId: string, entityId: string, action: string, oldValues: unknown, newValues: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'productionOrder',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function startWorkOrder(req: Request, tenantId: string, id: string, input: StartWorkOrderInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkOrder(tenantId, id)

  // Allow starting an individual READY stage while the WO is already running.
  const startStageOnly = before.status === 'IN_PROGRESS' && Boolean(input.stageId)
  if (before.status !== 'READY' && !startStageOnly) {
    throw new InvalidStateError(
      `Work order can only be started from READY status, or start a stage while IN_PROGRESS (current: ${before.status})`,
    )
  }

  const settings = await getManufacturingSettingsForTenant(tenantId)
  let reservationWarning: string | null = null
  if (!startStageOnly && settings.requireReservation) {
    const reservations = await prisma.inventoryStockReservation.count({
      where: { tenantId, demandType: 'WO', demandId: id, status: 'ACTIVE' },
    })
    if (reservations === 0) {
      if (settings.flexibleExecution) {
        reservationWarning = 'MATERIAL_RESERVATION_MISSING'
      } else {
        throw new ConflictError('Manufacturing settings require material reservation before starting this work order')
      }
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    let targetStageId = input.stageId ?? before.currentStageId
    // Flexible start: if WO has no current stage yet, pick the first incomplete stage.
    if (!startStageOnly && !targetStageId) {
      const firstOpen = await tx.productionOrderStage.findFirst({
        where: {
          productionOrderId: id,
          tenantId,
          status: { in: ['READY', 'NOT_STARTED'] },
        },
        orderBy: { displayOrder: 'asc' },
      })
      targetStageId = firstOpen?.id ?? null
    }
    if (targetStageId) {
      const stage = await tx.productionOrderStage.findFirst({ where: { id: targetStageId, productionOrderId: id, tenantId } })
      if (!stage) throw new NotFoundError('Stage not found on this work order')
      const canStartStageStatus = stage.status === 'READY' || stage.status === 'NOT_STARTED'
      if (canStartStageStatus) {
        // Promote ops so shopfloor progress can be recorded after start.
        if (stage.status === 'NOT_STARTED') {
          await tx.productionOrderOperation.updateMany({
            where: { stageId: stage.id, tenantId, status: 'NOT_STARTED' },
            data: { status: 'READY' },
          })
        }
        await tx.productionOrderStage.update({
          where: { id: stage.id },
          data: { status: 'IN_PROGRESS', startedAt: stage.startedAt ?? new Date() },
        })
        await logProductionActivity(
          {
            tenantId,
            productionOrderId: id,
            activityType: 'STAGE_STARTED',
            userId,
            message: `Stage "${stage.name}" started`,
          },
          tx,
        )
      } else if (startStageOnly) {
        throw new InvalidStateError(`Cannot start stage in ${stage.status} status (expected READY or NOT_STARTED)`)
      }
    }

    if (!startStageOnly) {
      await tx.productionOrder.update({
        where: { id, tenantId },
        data: {
          status: 'IN_PROGRESS',
          actualStartAt: before.actualStartAt ?? new Date(),
          currentStageId: targetStageId,
          updatedBy: userId,
        },
      })

      await logProductionActivity(
        {
          tenantId,
          productionOrderId: id,
          activityType: 'STARTED',
          userId,
          message: reservationWarning
            ? `Work order ${before.orderNumber} started (warning: ${reservationWarning})`
            : `Work order ${before.orderNumber} started`,
          oldValue: { status: before.status },
          newValue: { status: 'IN_PROGRESS', warnings: reservationWarning ? [reservationWarning] : [] },
        },
        tx,
      )
    } else if (targetStageId) {
      await tx.productionOrder.update({
        where: { id, tenantId },
        data: { currentStageId: targetStageId, updatedBy: userId },
      })
    }

    await recomputeOrderHealth(tx, tenantId, id)
    return tx.productionOrder.findFirstOrThrow({ where: { id, tenantId } })
  })

  await audit(req, tenantId, id, startStageOnly ? 'STAGE_START' : 'START', before, order)
  return {
    order,
    warnings: reservationWarning ? [reservationWarning] : ([] as string[]),
  }
}

export async function holdWorkOrder(req: Request, tenantId: string, id: string, input: HoldWorkOrderInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkOrder(tenantId, id)

  if (before.status !== 'READY' && before.status !== 'IN_PROGRESS') {
    throw new InvalidStateError(`Work order can only be held from READY or IN_PROGRESS status (current: ${before.status})`)
  }

  const order = await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id, tenantId },
      data: {
        status: 'ON_HOLD',
        previousStatusBeforeHold: before.status,
        holdReasonCategory: input.reasonCategory,
        holdRemarks: input.remarks ?? null,
        holdExpectedResumeAt: input.expectedResumeAt ? new Date(input.expectedResumeAt) : null,
        updatedBy: userId,
      },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: id,
        activityType: 'HELD',
        userId,
        message: `Work order ${before.orderNumber} put on hold (${input.reasonCategory})`,
        oldValue: { status: before.status },
        newValue: { status: 'ON_HOLD', reasonCategory: input.reasonCategory },
        reason: input.remarks ?? null,
      },
      tx,
    )

    await recomputeOrderHealth(tx, tenantId, id)
    return tx.productionOrder.findFirstOrThrow({ where: { id, tenantId } })
  })

  await audit(req, tenantId, id, 'HOLD', before, order)
  return order
}

export async function resumeWorkOrder(req: Request, tenantId: string, id: string, input: ResumeWorkOrderInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkOrder(tenantId, id)

  if (before.status !== 'ON_HOLD') {
    throw new InvalidStateError(`Work order can only be resumed from ON_HOLD status (current: ${before.status})`)
  }

  const resumedStatus = before.previousStatusBeforeHold ?? 'IN_PROGRESS'

  const order = await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id, tenantId },
      data: {
        status: resumedStatus,
        previousStatusBeforeHold: null,
        holdReasonCategory: null,
        holdRemarks: null,
        holdExpectedResumeAt: null,
        updatedBy: userId,
      },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: id,
        activityType: 'RESUMED',
        userId,
        message: `Work order ${before.orderNumber} resumed`,
        oldValue: { status: before.status },
        newValue: { status: resumedStatus },
        reason: input.remarks ?? null,
      },
      tx,
    )

    await recomputeOrderHealth(tx, tenantId, id)
    return tx.productionOrder.findFirstOrThrow({ where: { id, tenantId } })
  })

  await audit(req, tenantId, id, 'RESUME', before, order)
  return order
}

export interface CompleteWorkOrderResult {
  order: Awaited<ReturnType<typeof repo.getWorkOrder>>
  warnings: string[]
}

/**
 * Completes the WO and auto-posts remaining eligible FG via shared `postFinishedGoodsReceipt`
 * (same path as explicit FG receipt API). Does not auto-close the WO.
 */
export async function completeWorkOrder(
  req: Request,
  tenantId: string,
  id: string,
  input: CompleteWorkOrderInput,
): Promise<CompleteWorkOrderResult> {
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkOrder(tenantId, id)

  if (before.status !== 'IN_PROGRESS') {
    throw new InvalidStateError(`Work order can only be completed from IN_PROGRESS status (current: ${before.status})`)
  }

  const settings = await getManufacturingSettingsForTenant(tenantId)
  const flexible = Boolean(settings.flexibleExecution)
  const allowCloseWithoutQc = Boolean(settings.allowCloseWithoutQc) || flexible
  const stages = await prisma.productionOrderStage.findMany({ where: { productionOrderId: id, tenantId } })
  const mandatoryStages = stages.filter((s) => !s.isOptional)
  const incomplete = mandatoryStages.filter(
    (s) =>
      s.status !== 'COMPLETED'
      && s.status !== 'SKIPPED'
      && !(allowCloseWithoutQc && s.status === 'QC_PENDING'),
  )
  if (incomplete.length > 0) {
    throw new ValidationError(
      `Cannot complete work order: mandatory stage(s) not completed: ${incomplete.map((s) => s.name).join(', ')}`,
    )
  }

  const qualityBlockers = await collectQualityBlockers(tenantId, id)
  const qualityWarnings: string[] = []
  if (qualityBlockers.length > 0) {
    if (!allowCloseWithoutQc) {
      throw new ConflictError(
        `Cannot complete work order due to quality blockers: ${qualityBlockers.map((b) => b.message).join('; ')}`,
      )
    }
    qualityWarnings.push(
      ...qualityBlockers.map((b) => `QUALITY_WARNING:${b.code}:${b.message}`),
    )
  }

  let fgReceiptPosted = false
  try {
    const eligibility = await getFgEligibility(tenantId, id)
    const eligibleQty = toDecimal(eligibility.eligibleQuantity)

    if (eligibility.isStockable && isPositive(eligibleQty)) {
      await postFinishedGoodsReceipt(req, tenantId, id, {
        quantity: eligibleQty.toNumber(),
        remarks: input.remarks ?? `FG receipt for WO ${before.orderNumber}`,
        idempotencyKey: `fg-complete:${id}`,
      })
      fgReceiptPosted = true
    }
  } catch {
    // Preserve complete when FG warehouse/tracking is not ready — surface via warning.
    fgReceiptPosted = false
  }

  const order = await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id, tenantId },
      data: { status: 'COMPLETED', actualCompletedAt: new Date(), updatedBy: userId },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: id,
        activityType: 'COMPLETED',
        userId,
        message: `Work order ${before.orderNumber} completed`,
        oldValue: { status: before.status },
        newValue: { status: 'COMPLETED' },
        reason: input.remarks ?? null,
      },
      tx,
    )

    await recomputeOrderHealth(tx, tenantId, id)
    return tx.productionOrder.findFirstOrThrow({ where: { id, tenantId } })
  })

  await audit(req, tenantId, id, 'COMPLETE', before, order)

  const warnings: string[] = [...qualityWarnings]
  if (!fgReceiptPosted) {
    warnings.push('FINISHED_GOODS_RECEIPT_PENDING')
  }
  if (
    order.qualityStatus !== 'PASSED' &&
    order.qualityStatus !== 'NOT_APPLICABLE'
  ) {
    warnings.push('QUALITY_INTEGRATION_PENDING')
  }
  warnings.push('DISPATCH_PENDING')

  return { order, warnings }
}
