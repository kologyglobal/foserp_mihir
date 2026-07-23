import type { Request } from 'express'
import { Prisma, type ProductionOrderStage } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { addDec, computeCompletionPercent, subDec, toDecimal } from '../shared/quantity.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { promoteSuccessorsAfterStageComplete } from '../shared/stage-completion.service.js'
import { createPendingStageInspection } from '../../quality/inspections/inspection.service.js'
import { mapInspection } from '../../quality/shared/mappers.js'
import { recomputeOrderHealth } from './work-order-health.service.js'
import * as repo from './work-order.repository.js'
import type { CompleteStageInput, CorrectProgressInput, RecordProgressInput } from './work-order.schemas.js'
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

export interface ProgressServiceOptions {
  /** When provided, progress is recorded inside the caller's transaction (no nested $transaction). */
  tx?: Prisma.TransactionClient
  skipAudit?: boolean
}

type DbClient = Prisma.TransactionClient | typeof prisma

/** The final stage rolls its output up into the work order's overall completed/rework/reject/scrap totals. */
async function getFinalStageId(client: DbClient, tenantId: string, productionOrderId: string): Promise<string | null> {
  const stages = await client.productionOrderStage.findMany({ where: { tenantId, productionOrderId }, orderBy: { displayOrder: 'desc' }, take: 1 })
  return stages[0]?.id ?? null
}

async function executeRecordProgress(
  _req: Request,
  tenantId: string,
  orderId: string,
  input: RecordProgressInput,
  client: Prisma.TransactionClient,
  userId: string,
) {
  const order = await client.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId, deletedAt: null } })

  if (order.status !== 'IN_PROGRESS') {
    throw new InvalidStateError(`Progress can only be recorded while the work order is IN_PROGRESS (current: ${order.status})`)
  }

  if (input.idempotencyKey) {
    const existing = await client.productionStageLedger.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey } })
    if (existing) {
      const stage = await client.productionOrderStage.findFirst({ where: { id: existing.stageId, tenantId } })
      return {
        ledgerEntry: existing,
        stage,
        order: await client.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId } }),
        warnings: [] as string[],
      }
    }
  }

  const stage = await client.productionOrderStage.findFirst({ where: { id: input.stageId, productionOrderId: orderId, tenantId } })
  if (!stage) throw new NotFoundError('Stage not found on this work order')
  if (stage.status !== 'READY' && stage.status !== 'IN_PROGRESS') {
    throw new InvalidStateError(`Cannot record progress on a stage in ${stage.status} status`)
  }

  let operation = null
  if (input.operationId) {
    operation = await client.productionOrderOperation.findFirst({ where: { id: input.operationId, stageId: stage.id, tenantId } })
    if (!operation) throw new NotFoundError('Operation not found on this stage')
  }

  const profile = await client.manufacturingProfile.findFirst({ where: { id: order.manufacturingProfileId, tenantId } })
  const settings = await getManufacturingSettingsForTenant(tenantId)
  const tenantTolerance = settings.allowOverproduction
    ? toDecimal(settings.overproductionTolerancePercent)
    : toDecimal(0)
  const profileTolerance = toDecimal(profile?.overproductionTolerancePercent ?? 0)
  const overproductionTolerancePercent = profileTolerance.greaterThan(0)
    ? Prisma.Decimal.min(profileTolerance, tenantTolerance)
    : tenantTolerance

  const goodQuantity = toDecimal(input.goodQuantity)
  const reworkQuantity = toDecimal(input.reworkQuantity)
  const rejectedQuantity = toDecimal(input.rejectedQuantity)
  const scrapQuantity = toDecimal(input.scrapQuantity)
  const additionalTotal = goodQuantity.plus(reworkQuantity).plus(rejectedQuantity).plus(scrapQuantity)

  const existingStageTotal = toDecimal(stage.goodQuantity)
    .plus(toDecimal(stage.reworkQuantity))
    .plus(toDecimal(stage.rejectedQuantity))
    .plus(toDecimal(stage.scrapQuantity))
  const toleratedMax = toDecimal(stage.plannedQuantity).times(
    new Prisma.Decimal(1).plus(overproductionTolerancePercent.dividedBy(100)),
  )
  const warnings: string[] = []
  const overLimit = existingStageTotal.plus(additionalTotal).greaterThan(toleratedMax)
  if (overLimit) {
    if (settings.flexibleExecution) {
      warnings.push(
        `OVERPRODUCTION: recorded total would be ${existingStageTotal.plus(additionalTotal).toString()} vs tolerated max ${toleratedMax.toString()}`,
      )
    } else {
      throw new ValidationError(
        `Recording this progress (${additionalTotal.toString()}) would exceed the stage's planned quantity plus overproduction tolerance (max ${toleratedMax.toString()}, already recorded ${existingStageTotal.toString()})`,
      )
    }
  }

  const finalStageId = await getFinalStageId(client, tenantId, orderId)
  const isFinalStage = stage.id === finalStageId

  const updatedStage = await client.productionOrderStage.update({
      where: { id: stage.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: stage.startedAt ?? new Date(),
        goodQuantity: addDec(stage.goodQuantity, goodQuantity),
        reworkQuantity: addDec(stage.reworkQuantity, reworkQuantity),
        rejectedQuantity: addDec(stage.rejectedQuantity, rejectedQuantity),
        scrapQuantity: addDec(stage.scrapQuantity, scrapQuantity),
      },
    })

    if (operation) {
      await client.productionOrderOperation.update({
        where: { id: operation.id },
        data: {
          status: operation.status === 'NOT_STARTED' || operation.status === 'READY' ? 'IN_PROGRESS' : operation.status,
          startedAt: operation.startedAt ?? new Date(),
          goodQuantity: addDec(operation.goodQuantity, goodQuantity),
          reworkQuantity: addDec(operation.reworkQuantity, reworkQuantity),
          rejectedQuantity: addDec(operation.rejectedQuantity, rejectedQuantity),
          scrapQuantity: addDec(operation.scrapQuantity, scrapQuantity),
        },
      })
    }

    let updatedOrder = order
    if (isFinalStage) {
      const newCompletedGoodQuantity = addDec(order.completedGoodQuantity, goodQuantity)
      updatedOrder = await client.productionOrder.update({
        where: { id: orderId },
        data: {
          completedGoodQuantity: newCompletedGoodQuantity,
          reworkQuantity: addDec(order.reworkQuantity, reworkQuantity),
          rejectedQuantity: addDec(order.rejectedQuantity, rejectedQuantity),
          scrapQuantity: addDec(order.scrapQuantity, scrapQuantity),
          completionPercent: computeCompletionPercent(newCompletedGoodQuantity, order.plannedQuantity),
          updatedBy: userId,
        },
      })
    }

    const resultingBalanceJson = {
      stageGoodQuantity: updatedStage.goodQuantity.toString(),
      stageReworkQuantity: updatedStage.reworkQuantity.toString(),
      stageRejectedQuantity: updatedStage.rejectedQuantity.toString(),
      stageScrapQuantity: updatedStage.scrapQuantity.toString(),
      orderCompletedGoodQuantity: updatedOrder.completedGoodQuantity.toString(),
      orderCompletionPercent: updatedOrder.completionPercent.toString(),
    }

    const ledgerEntry = await client.productionStageLedger.create({
      data: {
        tenantId,
        productionOrderId: orderId,
        stageId: stage.id,
        operationId: operation?.id ?? null,
        transactionType: 'PROGRESS_RECORDED',
        goodQuantity,
        reworkQuantity,
        rejectedQuantity,
        scrapQuantity,
        remarks: input.remarks ?? null,
        resultingBalanceJson,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId,
      },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: orderId,
        activityType: 'PROGRESS_RECORDED',
        userId,
        message:
          `Progress recorded on stage "${stage.name}": good ${goodQuantity.toString()}, rework ${reworkQuantity.toString()}, rejected ${rejectedQuantity.toString()}, scrap ${scrapQuantity.toString()}`
          + (warnings.length ? ` (${warnings.join('; ')})` : ''),
        newValue: { ...resultingBalanceJson, warnings },
        sourceTransactionId: ledgerEntry.id,
      },
      client,
    )

  await recomputeOrderHealth(client, tenantId, orderId)

  return {
    ledgerEntry,
    stage: updatedStage,
    order: await client.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId } }),
    warnings,
  }
}

export async function recordProgress(
  req: Request,
  tenantId: string,
  orderId: string,
  input: RecordProgressInput,
  options?: ProgressServiceOptions,
) {
  const userId = req.context?.userId ?? ''

  if (options?.tx) {
    return executeRecordProgress(req, tenantId, orderId, input, options.tx, userId)
  }

  const result = await prisma.$transaction(async (tx) => executeRecordProgress(req, tenantId, orderId, input, tx, userId))

  if (!options?.skipAudit) {
    await audit(req, tenantId, orderId, 'PROGRESS_RECORDED', undefined, result.ledgerEntry)
  }
  return result
}

export async function completeStage(req: Request, tenantId: string, orderId: string, input: CompleteStageInput) {
  const userId = req.context?.userId ?? ''
  const order = await repo.getWorkOrder(tenantId, orderId)

  if (order.status !== 'IN_PROGRESS') {
    throw new InvalidStateError(`Stages can only be completed while the work order is IN_PROGRESS (current: ${order.status})`)
  }

  const stage = await prisma.productionOrderStage.findFirst({ where: { id: input.stageId, productionOrderId: orderId, tenantId } })
  if (!stage) throw new NotFoundError('Stage not found on this work order')

  const settings = await getManufacturingSettingsForTenant(tenantId)
  const flexible = Boolean(settings.flexibleExecution)
  // requireQc / skipQcGate:false forces QC_PENDING even under flexible execution.
  const qualityGateApplies = Boolean(stage.qualityRequired) || input.requireQc === true
  const forceStrictQc = input.skipQcGate === false || input.requireQc === true
  const bypassQc = qualityGateApplies && !forceStrictQc && (Boolean(input.skipQcGate) || flexible)
  if (bypassQc && input.skipQcGate === true && !input.qcOverrideReason?.trim() && !flexible) {
    throw new ValidationError('qcOverrideReason is required when skipQcGate is true')
  }

  // Recovery: stage was completed while skipping QC (flexible / override). Re-open QC gate.
  const reopenQcFromCompleted =
    stage.status === 'COMPLETED' && qualityGateApplies && !bypassQc

  if (
    stage.status !== 'IN_PROGRESS' &&
    stage.status !== 'READY' &&
    stage.status !== 'QC_PENDING' &&
    !reopenQcFromCompleted
  ) {
    throw new InvalidStateError(`Cannot complete a stage in ${stage.status} status`)
  }

  if (reopenQcFromCompleted) {
    const alreadyPassed = await prisma.manufacturingQualityInspection.findFirst({
      where: {
        tenantId,
        productionOrderId: orderId,
        stageId: stage.id,
        status: 'PASSED',
      },
      select: { id: true, inspectionNumber: true },
    })
    if (alreadyPassed) {
      throw new InvalidStateError(
        `Stage already has passed QC (${alreadyPassed.inspectionNumber}); cannot reopen`,
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const stageForQc = await tx.productionOrderStage.findFirstOrThrow({
        where: { id: stage.id, tenantId },
      })
      const qcPendingStage = await tx.productionOrderStage.update({
        where: { id: stage.id },
        data: { status: 'QC_PENDING', completedAt: null },
      })
      const inspectionRow = await createPendingStageInspection(tx, tenantId, orderId, stageForQc, order, userId)
      const qualityStatus =
        order.qualityStatus === 'NOT_APPLICABLE' || order.qualityStatus === 'PENDING_INTEGRATION'
          ? 'PENDING_QC'
          : 'IN_QC'
      await tx.productionOrder.update({
        where: { id: orderId, tenantId },
        data: { qualityStatus, updatedBy: userId },
      })
      await logProductionActivity(
        {
          tenantId,
          productionOrderId: orderId,
          activityType: 'QC_REQUESTED',
          userId,
          message: `Stage "${stage.name}" QC reopened (${inspectionRow.inspectionNumber}) — was completed without QC clearance`,
          reason: input.remarks ?? null,
        },
        tx,
      )
      await recomputeOrderHealth(tx, tenantId, orderId)
      return {
        stage: qcPendingStage,
        inspection: mapInspection(inspectionRow),
        awaitingQuality: true as const,
        promotedStages: [] as ProductionOrderStage[],
        order: await tx.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId } }),
        warnings: ['QC_REOPENED_FROM_COMPLETED'] as string[],
      }
    })

    await audit(req, tenantId, orderId, 'QC_REOPENED', { stageId: stage.id, status: 'COMPLETED' }, result.stage)
    return result
  }

  const profile = await prisma.manufacturingProfile.findFirst({ where: { id: order.manufacturingProfileId, tenantId } })
  const underproductionTolerancePercent = toDecimal(profile?.underproductionTolerancePercent ?? 0)
  const minimumRequiredGood = toDecimal(stage.plannedQuantity).times(
    new Prisma.Decimal(1).minus(underproductionTolerancePercent.dividedBy(100)),
  )
  const stageGood = toDecimal(stage.goodQuantity)
  const underproduced = stageGood.lessThan(minimumRequiredGood)
  const underproductionNote = underproduced
    ? ` (underproduction allowed: good ${stageGood.toString()} < minimum ${minimumRequiredGood.toString()}, tolerance ${underproductionTolerancePercent.toString()}%)`
    : ''
  const warnings: string[] = []
  if (underproduced) warnings.push('UNDERPRODUCTION')
  if (bypassQc && qualityGateApplies) {
    warnings.push(
      input.qcOverrideReason?.trim()
        ? `QC_OVERRIDE:${input.qcOverrideReason.trim()}`
        : 'QC_DEFERRED_FLEXIBLE_EXECUTION',
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const stageOperations = await tx.productionOrderOperation.findMany({ where: { stageId: stage.id, tenantId } })
    const now = new Date()
    for (const op of stageOperations) {
      if (op.status === 'COMPLETED' || op.status === 'SKIPPED' || op.status === 'CANCELLED') continue
      await tx.productionOrderOperation.update({
        where: { id: op.id },
        data: { status: 'COMPLETED', completedAt: now },
      })
    }

    if (qualityGateApplies && !bypassQc) {
      // Reload quantities so inspection inspectedQty reflects progress recorded just before complete.
      const stageForQc = await tx.productionOrderStage.findFirstOrThrow({
        where: { id: stage.id, tenantId },
      })
      const qcPendingStage = await tx.productionOrderStage.update({
        where: { id: stage.id },
        data: { status: 'QC_PENDING' },
      })

      const inspectionRow = await createPendingStageInspection(tx, tenantId, orderId, stageForQc, order, userId)
      const qualityStatus = order.qualityStatus === 'NOT_APPLICABLE' || order.qualityStatus === 'PENDING_INTEGRATION'
        ? 'PENDING_QC'
        : 'IN_QC'

      await tx.productionOrder.update({
        where: { id: orderId, tenantId },
        data: { qualityStatus, updatedBy: userId },
      })

      await logProductionActivity(
        {
          tenantId,
          productionOrderId: orderId,
          activityType: 'QC_REQUESTED',
          userId,
          message: `Stage "${stage.name}" awaiting QC (${inspectionRow.inspectionNumber})${underproductionNote}`,
          reason: input.remarks ?? null,
        },
        tx,
      )

      await recomputeOrderHealth(tx, tenantId, orderId)

      return {
        stage: qcPendingStage,
        inspection: mapInspection(inspectionRow),
        awaitingQuality: true as const,
        promotedStages: [] as ProductionOrderStage[],
        order: await tx.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId } }),
        warnings,
      }
    }

    const promotion = await promoteSuccessorsAfterStageComplete(tx, tenantId, orderId, stage, order.currentStageId, now)

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: orderId,
        activityType: 'STAGE_COMPLETED',
        userId,
        message:
          `Stage "${stage.name}" completed${underproductionNote}`
          + (bypassQc && stage.qualityRequired
            ? ` (QC gate skipped${input.qcOverrideReason ? `: ${input.qcOverrideReason}` : ' — flexible execution'})`
            : ''),
        reason: input.qcOverrideReason ?? input.remarks ?? null,
      },
      tx,
    )

    return {
      stage: promotion.completedStage,
      awaitingQuality: false as const,
      promotedStages: promotion.promotedStages,
      order: await tx.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId } }),
      warnings,
    }
  })

  await audit(req, tenantId, orderId, 'STAGE_COMPLETED', { stageId: stage.id, status: stage.status }, result.stage)
  return result
}

async function executeCorrectProgress(
  _req: Request,
  tenantId: string,
  orderId: string,
  input: CorrectProgressInput,
  client: Prisma.TransactionClient,
  userId: string,
) {
  const order = await client.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId, deletedAt: null } })

  const original = await client.productionStageLedger.findFirst({
    where: { id: input.ledgerEntryId, productionOrderId: orderId, tenantId },
  })
  if (!original) throw new NotFoundError('Ledger entry not found on this work order')
  if (original.transactionType !== 'PROGRESS_RECORDED') {
    throw new ValidationError('Only PROGRESS_RECORDED entries can be corrected')
  }
  const alreadyReversed = await client.productionStageLedger.findFirst({
    where: { tenantId, reversalOfId: original.id, transactionType: 'REVERSAL' },
  })
  if (alreadyReversed) throw new ValidationError('This ledger entry has already been corrected')

  const stage = await client.productionOrderStage.findFirst({ where: { id: original.stageId, tenantId } })
  if (!stage) throw new NotFoundError('Stage not found for this ledger entry')

  const correctedGood = toDecimal(input.goodQuantity)
  const correctedRework = toDecimal(input.reworkQuantity)
  const correctedRejected = toDecimal(input.rejectedQuantity)
  const correctedScrap = toDecimal(input.scrapQuantity)

  const deltaGood = subDec(correctedGood, original.goodQuantity)
  const deltaRework = subDec(correctedRework, original.reworkQuantity)
  const deltaRejected = subDec(correctedRejected, original.rejectedQuantity)
  const deltaScrap = subDec(correctedScrap, original.scrapQuantity)

  const finalStageId = await getFinalStageId(client, tenantId, orderId)
  const isFinalStage = stage.id === finalStageId

  const updatedStage = await client.productionOrderStage.update({
      where: { id: stage.id },
      data: {
        goodQuantity: addDec(stage.goodQuantity, deltaGood),
        reworkQuantity: addDec(stage.reworkQuantity, deltaRework),
        rejectedQuantity: addDec(stage.rejectedQuantity, deltaRejected),
        scrapQuantity: addDec(stage.scrapQuantity, deltaScrap),
      },
    })

    if (original.operationId) {
      const operation = await client.productionOrderOperation.findFirst({ where: { id: original.operationId, tenantId } })
      if (operation) {
        await client.productionOrderOperation.update({
          where: { id: operation.id },
          data: {
            goodQuantity: addDec(operation.goodQuantity, deltaGood),
            reworkQuantity: addDec(operation.reworkQuantity, deltaRework),
            rejectedQuantity: addDec(operation.rejectedQuantity, deltaRejected),
            scrapQuantity: addDec(operation.scrapQuantity, deltaScrap),
          },
        })
      }
    }

    let updatedOrder = order
    if (isFinalStage) {
      const newCompletedGoodQuantity = addDec(order.completedGoodQuantity, deltaGood)
      updatedOrder = await client.productionOrder.update({
        where: { id: orderId },
        data: {
          completedGoodQuantity: newCompletedGoodQuantity,
          reworkQuantity: addDec(order.reworkQuantity, deltaRework),
          rejectedQuantity: addDec(order.rejectedQuantity, deltaRejected),
          scrapQuantity: addDec(order.scrapQuantity, deltaScrap),
          completionPercent: computeCompletionPercent(newCompletedGoodQuantity, order.plannedQuantity),
          updatedBy: userId,
        },
      })
    }

    const reversal = await client.productionStageLedger.create({
      data: {
        tenantId,
        productionOrderId: orderId,
        stageId: stage.id,
        operationId: original.operationId,
        transactionType: 'REVERSAL',
        goodQuantity: original.goodQuantity,
        reworkQuantity: original.reworkQuantity,
        rejectedQuantity: original.rejectedQuantity,
        scrapQuantity: original.scrapQuantity,
        remarks: `Reversal for correction: ${input.reason}`,
        reversalOfId: original.id,
        createdBy: userId,
      },
    })

    const correction = await client.productionStageLedger.create({
      data: {
        tenantId,
        productionOrderId: orderId,
        stageId: stage.id,
        operationId: original.operationId,
        transactionType: 'CORRECTION',
        goodQuantity: correctedGood,
        reworkQuantity: correctedRework,
        rejectedQuantity: correctedRejected,
        scrapQuantity: correctedScrap,
        remarks: input.reason,
        resultingBalanceJson: {
          stageGoodQuantity: updatedStage.goodQuantity.toString(),
          orderCompletedGoodQuantity: updatedOrder.completedGoodQuantity.toString(),
        },
        createdBy: userId,
      },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: orderId,
        activityType: 'CORRECTION',
        userId,
        message: `Progress entry corrected on stage "${stage.name}"`,
        oldValue: { goodQuantity: original.goodQuantity.toString() },
        newValue: { goodQuantity: correctedGood.toString() },
        reason: input.reason,
        sourceTransactionId: correction.id,
      },
      client,
    )

  await recomputeOrderHealth(client, tenantId, orderId)

  return {
    reversal,
    correction,
    stage: updatedStage,
    order: await client.productionOrder.findFirstOrThrow({ where: { id: orderId, tenantId } }),
  }
}

export async function correctProgress(
  req: Request,
  tenantId: string,
  orderId: string,
  input: CorrectProgressInput,
  options?: ProgressServiceOptions,
) {
  const userId = req.context?.userId ?? ''

  if (options?.tx) {
    return executeCorrectProgress(req, tenantId, orderId, input, options.tx, userId)
  }

  const result = await prisma.$transaction(async (tx) => executeCorrectProgress(req, tenantId, orderId, input, tx, userId))

  if (!options?.skipAudit) {
    const original = await prisma.productionStageLedger.findFirst({ where: { id: input.ledgerEntryId, tenantId } })
    await audit(req, tenantId, orderId, 'PROGRESS_CORRECTED', original, result.correction)
  }
  return result
}
