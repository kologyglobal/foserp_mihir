import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { logProductionActivity } from '../../manufacturing/shared/activity.service.js'
import { promoteSuccessorsAfterStageComplete } from '../../manufacturing/shared/stage-completion.service.js'
import { mapInspection, mapNcr } from '../shared/mappers.js'
import {
  persistParameterResults,
  resolveInspectionPlan,
  type ParameterSnapshotEntry,
  validatePassAgainstSnapshot,
} from '../shared/plan-resolve.service.js'
import * as repo from './inspection.repository.js'
import { assertCertificatesAllowPass } from '../certificates/certificate.service.js'
import { computeSampleQty } from '../shared/sampling.service.js'
import type { CancelInspectionInput, CreateInspectionInput, DecideInspectionInput, ListInspectionsQuery } from './inspection.schemas.js'

function toDecimal(value: number | undefined): Prisma.Decimal | null {
  if (value == null) return null
  return new Prisma.Decimal(value)
}

function snapshotAsJson(snapshot: ParameterSnapshotEntry[]): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue
}

async function resolvePlanCodeHint(
  tenantId: string,
  productionOrderId: string,
): Promise<string | null> {
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, tenantId },
    select: { manufacturingProfileId: true },
  })
  if (!order?.manufacturingProfileId) return null
  const profile = await prisma.manufacturingProfile.findFirst({
    where: { id: order.manufacturingProfileId, tenantId },
    select: { defaultQualityPlanRef: true },
  })
  return profile?.defaultQualityPlanRef ?? null
}

export async function listInspections(tenantId: string, query: ListInspectionsQuery) {
  const result = await repo.listInspections(tenantId, query)
  return { ...result, items: result.items.map(mapInspection) }
}

export async function getInspection(tenantId: string, id: string) {
  const row = await repo.getInspection(tenantId, id)
  if (!row) throw new NotFoundError('Inspection not found')
  return mapInspection(row)
}

export async function createPendingStageInspection(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productionOrderId: string,
  stage: { id: string; name: string; goodQuantity: Prisma.Decimal },
  order: { productItemId: string; manufacturingProfileId?: string | null },
  userId: string,
) {
  const idempotencyKey = `stage-qc:${stage.id}`
  const existing = await tx.manufacturingQualityInspection.findFirst({
    where: { tenantId, idempotencyKey },
    include: {
      parameterResults: { orderBy: { sortOrder: 'asc' } },
      inspectionPlan: { select: { id: true, planCode: true, planName: true, category: true, status: true } },
    },
  })
  if (existing) return existing

  let planCodeHint: string | null = null
  if (order.manufacturingProfileId) {
    const profile = await tx.manufacturingProfile.findFirst({
      where: { id: order.manufacturingProfileId, tenantId },
      select: { defaultQualityPlanRef: true },
    })
    planCodeHint = profile?.defaultQualityPlanRef ?? null
  }

  const resolved = await resolveInspectionPlan(tenantId, {
    category: 'IN_PROCESS',
    itemId: order.productItemId,
    planCodeHint,
  })

  const inspectionNumber = await nextCode(tenantId, 'QUALITY_INSPECTION', tx)
  return repo.createInspection(tx, {
    tenantId,
    inspectionNumber,
    category: 'IN_PROCESS',
    productionOrderId,
    stageId: stage.id,
    itemId: order.productItemId,
    inspectionPlanId: resolved?.plan.id ?? null,
    inspectionPlanRevisionId: resolved?.plan.currentRevisionId ?? null,
    planCodeSnapshot: resolved?.plan.planCode ?? null,
    planRevisionSnapshot: resolved?.plan.revision ?? null,
    parameterSnapshotJson: resolved ? snapshotAsJson(resolved.snapshot) : null,
    inspectedQty: stage.goodQuantity,
    sampleQty: resolved ? computeSampleQty(resolved.plan.samplingMethod === 'MANUAL_SAMPLE' ? 'FULL_INSPECTION' : resolved.plan.samplingMethod ?? 'FULL_INSPECTION', stage.goodQuantity, resolved.plan.fixedSampleSize, resolved.plan.samplePercentage) : stage.goodQuantity,
    certificateRequired: resolved?.plan.certificateRequired ?? false,
    title: `In-process QC — ${stage.name}`,
    idempotencyKey,
    requestedByUserId: userId,
    createdBy: userId,
  })
}

export async function createInspection(req: Request, tenantId: string, input: CreateInspectionInput) {
  const userId = req.context?.userId ?? ''

  if (input.idempotencyKey) {
    const existing = await repo.findByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing) return mapInspection(existing)
  }

  const order = await prisma.productionOrder.findFirst({
    where: { id: input.productionOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new NotFoundError('Production order not found')

  if (input.category === 'IN_PROCESS' && !input.stageId) {
    throw new ValidationError('stageId is required for IN_PROCESS inspections')
  }

  if (input.stageId) {
    const stage = await prisma.productionOrderStage.findFirst({
      where: { id: input.stageId, productionOrderId: input.productionOrderId, tenantId },
    })
    if (!stage) throw new NotFoundError('Stage not found on this production order')
  }

  const itemId = input.itemId ?? order.productItemId
  const planCodeHint = await resolvePlanCodeHint(tenantId, order.id)
  const resolved = await resolveInspectionPlan(tenantId, {
    category: input.category,
    inspectionPlanId: input.inspectionPlanId,
    itemId,
    planCodeHint,
  })

  const inspection = await prisma.$transaction(async (tx) => {
    const inspectionNumber = await nextCode(tenantId, 'QUALITY_INSPECTION', tx)
    const row = await repo.createInspection(tx, {
      tenantId,
      inspectionNumber,
      category: input.category,
      productionOrderId: input.productionOrderId,
      stageId: input.stageId ?? null,
      operationId: input.operationId ?? null,
      itemId,
      inspectionPlanId: resolved?.plan.id ?? null,
      inspectionPlanRevisionId: resolved?.plan.currentRevisionId ?? null,
      planCodeSnapshot: resolved?.plan.planCode ?? null,
      planRevisionSnapshot: resolved?.plan.revision ?? null,
      parameterSnapshotJson: resolved ? snapshotAsJson(resolved.snapshot) : null,
      inspectedQty: toDecimal(input.inspectedQty),
      sampleQty: resolved && input.inspectedQty ? computeSampleQty(resolved.plan.samplingMethod ?? 'FULL_INSPECTION', input.inspectedQty, resolved.plan.fixedSampleSize, resolved.plan.samplePercentage, input.manualSampleSize) : toDecimal(input.inspectedQty),
      certificateRequired: resolved?.plan.certificateRequired ?? false,
      title: input.title ?? `${input.category === 'FINAL' ? 'Final' : 'In-process'} QC — ${order.orderNumber}`,
      remarks: input.remarks ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      requestedByUserId: userId,
      createdBy: userId,
    })

    await tx.productionOrder.update({
      where: { id: order.id, tenantId },
      data: { qualityStatus: 'IN_QC', updatedBy: userId },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: order.id,
        activityType: 'QC_REQUESTED',
        userId,
        message: `Quality inspection ${row.inspectionNumber} requested (${input.category})`,
      },
      tx,
    )

    return row
  })

  return mapInspection(inspection)
}

async function resolveQualityStatusAfterInProcessPass(tx: Prisma.TransactionClient, tenantId: string, productionOrderId: string) {
  const pendingStageQc = await tx.productionOrderStage.count({
    where: { tenantId, productionOrderId, qualityRequired: true, status: 'QC_PENDING', isOptional: false },
  })
  const pendingInspections = await tx.manufacturingQualityInspection.count({
    where: { tenantId, productionOrderId, status: { in: ['PENDING', 'REWORK'] } },
  })
  if (pendingStageQc > 0 || pendingInspections > 0) return 'IN_QC' as const
  return 'IN_QC' as const
}

export async function decideInspection(req: Request, tenantId: string, id: string, input: DecideInspectionInput) {
  const userId = req.context?.userId ?? ''
  const inspection = await repo.getInspection(tenantId, id)
  if (!inspection) throw new NotFoundError('Inspection not found')
  if (inspection.status !== 'PENDING' && inspection.status !== 'REWORK') {
    throw new InvalidStateError(`Inspection cannot be decided in ${inspection.status} status`)
  }
  const quantityTotal = [
    input.acceptedQty, input.rejectedQty, input.reworkQty, input.conditionallyAcceptedQty,
    input.heldQty, input.scrapQty, input.pendingQty,
  ].reduce((sum: number, quantity) => sum + (quantity ?? 0), 0)
  const inspected = inspection.inspectedQty != null ? Number(inspection.inspectedQty) : null
  if (inspected != null && quantityTotal > inspected) {
    throw new ValidationError('Disposition quantities cannot exceed inspected quantity')
  }
  const permissions = req.context?.permissions ?? []
  if (input.decision === 'USE_AS_IS' && !permissions.some((p) => p === 'quality.approve' || p === 'quality.override')) {
    throw new ValidationError('USE_AS_IS requires quality.approve or quality.override permission')
  }
  if (input.decision === 'PASS' || input.decision === 'CONDITIONAL_PASS') {
    await assertCertificatesAllowPass(tenantId, id)
  }

  const snapshot = Array.isArray(inspection.parameterSnapshotJson)
    ? (inspection.parameterSnapshotJson as ParameterSnapshotEntry[])
    : []

  if ((input.decision === 'PASS' || input.decision === 'CONDITIONAL_PASS') && snapshot.length > 0) {
    const err = validatePassAgainstSnapshot(snapshot, input.parameterResults ?? [])
    if (err) throw new ValidationError(err)
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    if (snapshot.length > 0 && input.parameterResults) {
      await persistParameterResults(tx, tenantId, id, snapshot, input.parameterResults)
    }

    if (input.decision === 'PASS') {
      const updated = await repo.updateInspection(tx, tenantId, id, {
        status: 'PASSED',
        decision: 'PASS',
        acceptedQty: toDecimal(input.acceptedQty ?? Number(inspection.inspectedQty ?? 0)),
        rejectedQty: toDecimal(input.rejectedQty ?? 0),
        reworkQty: toDecimal(input.reworkQty ?? 0),
        decisionRemarks: input.remarks ?? null,
        decidedByUserId: userId,
        decidedAt: now,
        updatedBy: userId,
      })

      let promotedStages: unknown[] = []
      if (inspection.category === 'IN_PROCESS' && inspection.stageId) {
        const stage = await tx.productionOrderStage.findFirst({
          where: { id: inspection.stageId, tenantId },
        })
        const order = await tx.productionOrder.findFirstOrThrow({
          where: { id: inspection.productionOrderId!, tenantId },
        })
        if (stage && stage.status === 'QC_PENDING') {
          const promotion = await promoteSuccessorsAfterStageComplete(
            tx,
            tenantId,
            order.id,
            stage,
            order.currentStageId,
            now,
          )
          promotedStages = promotion.promotedStages
        }
        const qualityStatus = await resolveQualityStatusAfterInProcessPass(tx, tenantId, order.id)
        await tx.productionOrder.update({
          where: { id: order.id, tenantId },
          data: { qualityStatus, updatedBy: userId },
        })
      } else if (inspection.category === 'FINAL' && inspection.productionOrderId) {
        const openNcrs = await tx.qualityNcr.count({
          where: {
            tenantId,
            productionOrderId: inspection.productionOrderId,
            status: { in: ['OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED'] },
          },
        })
        await tx.productionOrder.update({
          where: { id: inspection.productionOrderId, tenantId },
          data: {
            qualityStatus: openNcrs > 0 ? 'HOLD' : 'PASSED',
            updatedBy: userId,
          },
        })
      }

      await logProductionActivity(
        {
          tenantId,
          productionOrderId: inspection.productionOrderId!,
          activityType: 'QC_PASSED',
          userId,
          message: `Inspection ${inspection.inspectionNumber} passed`,
          reason: input.remarks ?? null,
        },
        tx,
      )

      return { inspection: updated, promotedStages }
    }

    if (input.decision === 'CONDITIONAL_PASS' || input.decision === 'HOLD' || input.decision === 'USE_AS_IS') {
      const updated = await repo.updateInspection(tx, tenantId, id, {
        status: input.decision === 'HOLD' ? 'DECIDED' : 'PASSED',
        decision: input.decision,
        acceptedQty: toDecimal(input.acceptedQty ?? 0),
        conditionallyAcceptedQty: toDecimal(input.conditionallyAcceptedQty ?? (input.decision === 'CONDITIONAL_PASS' ? Number(inspection.inspectedQty ?? 0) : 0)),
        heldQty: toDecimal(input.heldQty ?? (input.decision === 'HOLD' ? Number(inspection.inspectedQty ?? 0) : 0)),
        scrapQty: toDecimal(input.scrapQty ?? 0),
        pendingQty: toDecimal(input.pendingQty ?? 0),
        stockDisposition: input.stockDisposition ?? (input.decision === 'HOLD' ? 'HOLD' : input.decision === 'USE_AS_IS' ? 'USE_AS_IS' : null),
        decisionRemarks: input.remarks ?? null, decisionReason: input.remarks ?? null,
        decidedByUserId: userId, decidedAt: now, updatedBy: userId,
      })
      return { inspection: updated, promotedStages: [] }
    }

    if (input.decision === 'REWORK') {
      const updated = await repo.updateInspection(tx, tenantId, id, {
        status: 'REWORK',
        decision: 'REWORK',
        acceptedQty: toDecimal(input.acceptedQty ?? 0),
        rejectedQty: toDecimal(input.rejectedQty ?? 0),
        reworkQty: toDecimal(input.reworkQty ?? Number(inspection.inspectedQty ?? 0)),
        decisionRemarks: input.remarks ?? null,
        decidedByUserId: userId,
        decidedAt: now,
        updatedBy: userId,
      })

      if (inspection.productionOrderId) {
        await tx.productionOrder.update({
          where: { id: inspection.productionOrderId, tenantId },
          data: { qualityStatus: 'HOLD', updatedBy: userId },
        })
      }
      if (inspection.stageId) {
        await tx.productionOrderStage.update({
          where: { id: inspection.stageId, tenantId },
          data: { status: 'QC_PENDING' },
        })
      }

      await logProductionActivity(
        {
          tenantId,
          productionOrderId: inspection.productionOrderId!,
          activityType: 'QC_REWORK',
          userId,
          message: `Inspection ${inspection.inspectionNumber} sent for rework`,
          reason: input.remarks ?? null,
        },
        tx,
      )

      return { inspection: updated, promotedStages: [] }
    }

    // REJECT
    const updated = await repo.updateInspection(tx, tenantId, id, {
      status: 'REJECTED',
      decision: 'REJECT',
      acceptedQty: toDecimal(input.acceptedQty ?? 0),
      rejectedQty: toDecimal(input.rejectedQty ?? Number(inspection.inspectedQty ?? 0)),
      reworkQty: toDecimal(input.reworkQty ?? 0),
      decisionRemarks: input.remarks ?? null,
      decidedByUserId: userId,
      decidedAt: now,
      updatedBy: userId,
    })

    const ncrNumber = await nextCode(tenantId, 'QUALITY_NCR', tx)
    const ncr = await tx.qualityNcr.create({
      data: {
        tenantId,
        ncrNumber,
        severity: input.severity ?? 'MAJOR',
        title: `Reject from ${inspection.inspectionNumber}`,
        description: input.remarks ?? null,
        productionOrderId: inspection.productionOrderId,
        inspectionId: inspection.id,
        itemId: inspection.itemId,
        reportedByUserId: userId,
        createdBy: userId,
      },
    })

    if (inspection.productionOrderId) {
      await tx.productionOrder.update({
        where: { id: inspection.productionOrderId, tenantId },
        data: { qualityStatus: 'FAILED', updatedBy: userId },
      })
    }
    if (inspection.stageId) {
      await tx.productionOrderStage.update({
        where: { id: inspection.stageId, tenantId },
        data: { status: 'BLOCKED' },
      })
    }

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: inspection.productionOrderId!,
        activityType: 'QC_REJECTED',
        userId,
        message: `Inspection ${inspection.inspectionNumber} rejected`,
        reason: input.remarks ?? null,
      },
      tx,
    )
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: inspection.productionOrderId!,
        activityType: 'NCR_OPENED',
        userId,
        message: `NCR ${ncr.ncrNumber} opened from inspection ${inspection.inspectionNumber}`,
      },
      tx,
    )

    return { inspection: updated, ncr, promotedStages: [] }
  })

  const fresh = await repo.getInspection(tenantId, id)
  return {
    inspection: mapInspection(fresh ?? result.inspection),
    promotedStages: result.promotedStages,
    ncr: result.ncr ? mapNcr(result.ncr) : undefined,
  }
}

export async function cancelInspection(req: Request, tenantId: string, id: string, input: CancelInspectionInput) {
  const userId = req.context?.userId ?? ''
  const inspection = await repo.getInspection(tenantId, id)
  if (!inspection) throw new NotFoundError('Inspection not found')
  if (inspection.status !== 'PENDING') {
    throw new InvalidStateError(`Only PENDING inspections can be cancelled (current: ${inspection.status})`)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await repo.updateInspection(tx, tenantId, id, {
      status: 'CANCELLED',
      decisionRemarks: input.remarks ?? null,
      updatedBy: userId,
    })

    if (inspection.stageId) {
      const stage = await tx.productionOrderStage.findFirst({ where: { id: inspection.stageId, tenantId } })
      if (stage?.status === 'QC_PENDING') {
        await tx.productionOrderStage.update({
          where: { id: stage.id },
          data: { status: 'IN_PROGRESS' },
        })
      }
    }

    return row
  })

  return mapInspection(updated)
}
