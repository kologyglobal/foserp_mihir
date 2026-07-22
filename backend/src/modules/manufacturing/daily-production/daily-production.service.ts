import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { recordProgress, correctProgress } from '../work-orders/work-order-progress.service.js'
import { tryRecordManufacturingAccountingEvent } from '../accounting/manufacturing-accounting-event.service.js'
import { autoPostAbsorptionAfterProduction } from '../costing/posting-orchestrator.service.js'
import * as repo from './daily-production.repository.js'
import type {
  CorrectDailyLineInput,
  CreateDailyBatchInput,
  ListDailyBatchesQuery,
  UpdateDailyBatchInput,
  UpsertDailyLineInput,
} from './daily-production.schemas.js'

function assertDraft(batch: { status: string }) {
  if (batch.status !== 'DRAFT') throw new InvalidStateError(`Batch is ${batch.status}; only DRAFT batches can be edited`)
}

export async function createBatch(req: Request, tenantId: string, input: CreateDailyBatchInput) {
  const userId = req.context?.userId ?? ''
  const batchNumber = await nextCode(tenantId, 'DAILY_PRODUCTION_BATCH')

  return prisma.dailyProductionBatch.create({
    data: {
      tenantId,
      batchNumber,
      productionDate: new Date(input.productionDate),
      shiftCode: input.shiftCode ?? null,
      shiftLabel: input.shiftLabel ?? null,
      plantCode: input.plantCode ?? null,
      workCentreId: input.workCentreId ?? null,
      supervisorId: userId,
      notes: input.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
    include: { lines: true, workCentre: { select: { id: true, code: true, name: true } } },
  })
}

export async function updateBatchHeader(req: Request, tenantId: string, id: string, input: UpdateDailyBatchInput) {
  const userId = req.context?.userId ?? ''
  const batch = await repo.getBatch(tenantId, id)
  assertDraft(batch)

  return prisma.dailyProductionBatch.update({
    where: { id },
    data: {
      ...(input.productionDate ? { productionDate: new Date(input.productionDate) } : {}),
      ...(input.shiftCode !== undefined ? { shiftCode: input.shiftCode ?? null } : {}),
      ...(input.shiftLabel !== undefined ? { shiftLabel: input.shiftLabel ?? null } : {}),
      ...(input.plantCode !== undefined ? { plantCode: input.plantCode ?? null } : {}),
      ...(input.workCentreId !== undefined ? { workCentreId: input.workCentreId ?? null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      updatedBy: userId,
    },
    include: { lines: { orderBy: { lineOrder: 'asc' } }, workCentre: { select: { id: true, code: true, name: true } } },
  })
}

export async function addLine(req: Request, tenantId: string, batchId: string, input: UpsertDailyLineInput) {
  const userId = req.context?.userId ?? ''
  const batch = await repo.getBatch(tenantId, batchId)
  assertDraft(batch)

  const existingKey = await prisma.dailyProductionLine.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey } })
  if (existingKey) throw new ValidationError('idempotencyKey already used for another daily production line')

  const order = await prisma.productionOrder.findFirst({ where: { id: input.productionOrderId, tenantId, deletedAt: null } })
  if (!order) throw new NotFoundError('Work order not found')
  const stage = await prisma.productionOrderStage.findFirst({
    where: { id: input.stageId, productionOrderId: input.productionOrderId, tenantId },
  })
  if (!stage) throw new NotFoundError('Stage not found on work order')

  const line = await prisma.dailyProductionLine.create({
    data: {
      tenantId,
      batchId,
      productionOrderId: input.productionOrderId,
      stageId: input.stageId,
      operationId: input.operationId ?? null,
      assignmentId: input.assignmentId ?? null,
      userId: input.userId ?? null,
      machineId: input.machineId ?? null,
      workCentreId: input.workCentreId ?? batch.workCentreId ?? stage.workCentreId ?? null,
      goodQuantity: input.goodQuantity,
      reworkQuantity: input.reworkQuantity,
      rejectedQuantity: input.rejectedQuantity,
      scrapQuantity: input.scrapQuantity,
      labourMinutes: input.labourMinutes ?? null,
      machineMinutes: input.machineMinutes ?? null,
      downtimeMinutes: input.downtimeMinutes ?? null,
      remarks: input.remarks ?? null,
      idempotencyKey: input.idempotencyKey,
      lineOrder: input.lineOrder ?? batch.lines.length,
      createdBy: userId,
      updatedBy: userId,
    },
  })

  await repo.refreshBatchLineCount(tenantId, batchId)
  return line
}

export async function updateLine(req: Request, tenantId: string, batchId: string, lineId: string, input: UpsertDailyLineInput) {
  const userId = req.context?.userId ?? ''
  const batch = await repo.getBatch(tenantId, batchId)
  assertDraft(batch)
  const line = await repo.getLine(tenantId, batchId, lineId)

  if (input.idempotencyKey !== line.idempotencyKey) {
    const dup = await prisma.dailyProductionLine.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey, id: { not: lineId } },
    })
    if (dup) throw new ValidationError('idempotencyKey already used for another daily production line')
  }

  return prisma.dailyProductionLine.update({
    where: { id: lineId },
    data: {
      productionOrderId: input.productionOrderId,
      stageId: input.stageId,
      operationId: input.operationId ?? null,
      assignmentId: input.assignmentId ?? null,
      userId: input.userId ?? null,
      machineId: input.machineId ?? null,
      workCentreId: input.workCentreId ?? null,
      goodQuantity: input.goodQuantity,
      reworkQuantity: input.reworkQuantity,
      rejectedQuantity: input.rejectedQuantity,
      scrapQuantity: input.scrapQuantity,
      labourMinutes: input.labourMinutes ?? null,
      machineMinutes: input.machineMinutes ?? null,
      downtimeMinutes: input.downtimeMinutes ?? null,
      remarks: input.remarks ?? null,
      idempotencyKey: input.idempotencyKey,
      lineOrder: input.lineOrder ?? line.lineOrder,
      updatedBy: userId,
    },
  })
}

export async function removeLine(_req: Request, tenantId: string, batchId: string, lineId: string) {
  const batch = await repo.getBatch(tenantId, batchId)
  assertDraft(batch)
  await repo.getLine(tenantId, batchId, lineId)
  await prisma.dailyProductionLine.delete({ where: { id: lineId } })
  await repo.refreshBatchLineCount(tenantId, batchId)
}

export async function validateBatch(tenantId: string, id: string) {
  const batch = await repo.getBatch(tenantId, id)
  assertDraft(batch)
  if (batch.lines.length === 0) throw new ValidationError('Batch has no lines')

  const errors: string[] = []
  for (const line of batch.lines) {
    const order = await prisma.productionOrder.findFirst({ where: { id: line.productionOrderId, tenantId } })
    if (!order || order.status !== 'IN_PROGRESS') {
      errors.push(`Line ${line.id}: work order must be IN_PROGRESS`)
    }
    const stage = await prisma.productionOrderStage.findFirst({ where: { id: line.stageId, tenantId } })
    if (!stage || !['READY', 'IN_PROGRESS'].includes(stage.status)) {
      errors.push(`Line ${line.id}: stage must be READY or IN_PROGRESS`)
    }
  }

  return { valid: errors.length === 0, errors, lineCount: batch.lines.length }
}

export async function submitBatch(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const batch = await repo.getBatch(tenantId, id)
  if (batch.status !== 'DRAFT') throw new InvalidStateError('Only DRAFT batches can be submitted')

  const validation = await validateBatch(tenantId, id)
  if (!validation.valid) throw new ValidationError(validation.errors.join('; '))

  const result = await prisma.$transaction(async (tx) => {
    const lines = await tx.dailyProductionLine.findMany({ where: { batchId: id, tenantId }, orderBy: { lineOrder: 'asc' } })
    const ledgerIds: string[] = []
    const scrapEvents: Array<{ productionOrderId: string; ledgerId: string; quantity: number }> = []

    for (const line of lines) {
      const progress = await recordProgress(
        req,
        tenantId,
        line.productionOrderId,
        {
          stageId: line.stageId,
          operationId: line.operationId ?? undefined,
          goodQuantity: Number(line.goodQuantity),
          reworkQuantity: Number(line.reworkQuantity),
          rejectedQuantity: Number(line.rejectedQuantity),
          scrapQuantity: Number(line.scrapQuantity),
          remarks: line.remarks ?? undefined,
          idempotencyKey: line.idempotencyKey,
        },
        { tx, skipAudit: true },
      )

      await tx.dailyProductionLine.update({
        where: { id: line.id },
        data: { resultingLedgerTransactionId: progress.ledgerEntry.id },
      })
      ledgerIds.push(progress.ledgerEntry.id)
      if (Number(line.scrapQuantity) > 0) {
        scrapEvents.push({
          productionOrderId: line.productionOrderId,
          ledgerId: progress.ledgerEntry.id,
          quantity: Number(line.scrapQuantity),
        })
      }

      await logProductionActivity(
        {
          tenantId,
          productionOrderId: line.productionOrderId,
          activityType: 'DAILY_PRODUCTION_SUBMITTED',
          userId,
          message: `Daily production batch ${batch.batchNumber} line posted`,
          sourceTransactionId: progress.ledgerEntry.id,
        },
        tx,
      )
    }

    const submitted = await tx.dailyProductionBatch.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedBy: userId, updatedBy: userId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    })

    return { batch: submitted, ledgerIds, scrapEvents }
  })

  for (const scrap of result.scrapEvents) {
    const latestCost = await prisma.workOrderCostSnapshot.findFirst({
      where: { tenantId, productionOrderId: scrap.productionOrderId },
      orderBy: { snapshotVersion: 'desc' },
      select: { unitActualCost: true },
    })
    const amount = Number(latestCost?.unitActualCost ?? 0) * scrap.quantity
    await tryRecordManufacturingAccountingEvent(req, tenantId, {
      eventType: 'SCRAP_RECORDED',
      idempotencyKey: `PROD_SCRAP:${scrap.ledgerId}:V1`,
      sourceDocumentType: 'PRODUCTION_STAGE_LEDGER',
      sourceDocumentId: scrap.ledgerId,
      productionOrderId: scrap.productionOrderId,
      quantity: scrap.quantity,
      amount,
      narration: `Scrap recorded in daily production batch ${batch.batchNumber}`,
      payloadJson: {
        batchId: id,
        unitCost: Number(latestCost?.unitActualCost ?? 0),
        scrapQuantity: scrap.quantity,
      },
    })
  }

  // Stage 4 — auto absorption (no-op unless autoPostAbsorption + MANUFACTURING_ACCOUNTING are both on).
  await autoPostAbsorptionAfterProduction(
    req,
    tenantId,
    result.batch.lines.map((line) => line.productionOrderId),
  )

  return { batch: result.batch, ledgerIds: result.ledgerIds }
}

export async function correctLine(
  req: Request,
  tenantId: string,
  batchId: string,
  lineId: string,
  input: CorrectDailyLineInput,
) {
  const userId = req.context?.userId ?? ''
  const batch = await repo.getBatch(tenantId, batchId)
  if (batch.status === 'DRAFT') throw new InvalidStateError('Cannot correct lines on a DRAFT batch')

  const line = await repo.getLine(tenantId, batchId, lineId)
  if (!line.resultingLedgerTransactionId) throw new InvalidStateError('Line has no posted ledger entry')

  const correction = await correctProgress(req, tenantId, line.productionOrderId, {
    ledgerEntryId: line.resultingLedgerTransactionId,
    goodQuantity: input.goodQuantity,
    reworkQuantity: input.reworkQuantity,
    rejectedQuantity: input.rejectedQuantity,
    scrapQuantity: input.scrapQuantity,
    reason: input.reason,
  })

  await prisma.$transaction(async (tx) => {
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: line.productionOrderId,
        activityType: 'DAILY_PRODUCTION_CORRECTED',
        userId,
        message: `Daily production line corrected in batch ${batch.batchNumber}`,
        sourceTransactionId: correction.correction.id,
      },
      tx,
    )

    const correctedCount = await tx.dailyProductionLine.count({
      where: {
        batchId,
        tenantId,
        resultingLedgerTransactionId: { not: null },
      },
    })
    const reversedCount = await tx.productionStageLedger.count({
      where: {
        tenantId,
        id: { in: batch.lines.map((l) => l.resultingLedgerTransactionId).filter(Boolean) as string[] },
        reversalOfId: { not: null },
      },
    })

    const newStatus = reversedCount >= correctedCount ? 'REVERSED' : 'PARTIALLY_REVERSED'
    await tx.dailyProductionBatch.update({ where: { id: batchId }, data: { status: newStatus, updatedBy: userId } })
  })

  return correction
}

export async function getBatch(tenantId: string, id: string) {
  return repo.getBatch(tenantId, id)
}

export async function listBatches(tenantId: string, query: ListDailyBatchesQuery) {
  return repo.listBatches(tenantId, query)
}
