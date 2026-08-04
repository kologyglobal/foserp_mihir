import type { QualityInspectionStatus } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { logger } from '../../../config/logger.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InventoryPostingService } from '../../inventory/shared/stock-posting.service.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { postGrnStockInward } from '../shared/purchase-inventory-posting.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import { QualityInspectionNotFoundError, QualityInspectionValidationError, QualityInspectionWorkflowError } from './quality-inspection.errors.js'
import { mapQualityInspection, type QiEnrichment } from './quality-inspection.mapper.js'
import * as repo from './quality-inspection.repository.js'
import type {
  CreateQualityInspectionInput,
  ListQualityInspectionsQuery,
  QualityInspectionLineInput,
  QualityInspectionParameterInput,
  UpdateQualityInspectionInput,
} from './quality-inspection.validation.js'
import { assertQiEditable, qiDate, qiQty, validateQiLines } from './quality-inspection.workflow.js'

function defaultQiParameters(itemCode: string): QualityInspectionParameterInput[] {
  const code = itemCode.trim() || 'item'
  return [
    {
      parameter: 'Visual / dimensions',
      specification: `${code} — as per PO / drawing`,
      minValue: null,
      maxValue: null,
      observedValue: null,
      unit: '',
      result: 'na',
      remarks: '',
    },
    {
      parameter: 'Documentation',
      specification: 'TC / COA present',
      minValue: null,
      maxValue: null,
      observedValue: null,
      unit: '',
      result: 'na',
      remarks: '',
    },
  ]
}

function buildQiParameters(inputs: QualityInspectionParameterInput[]) {
  return inputs.map((p, index) => ({
    lineNumber: index + 1,
    sourceParameterId: p.sourceParameterId ?? null,
    parameterCode: p.parameterCode?.trim() || null,
    parameterName: p.parameter.trim(),
    specification: p.specification?.trim() || '',
    minValue: p.minValue ?? null,
    maxValue: p.maxValue ?? null,
    observedValue: p.observedValue ?? null,
    unit: p.unit?.trim() || '',
    result: p.result ?? 'na',
    remarks: p.remarks?.trim() || null,
  }))
}

/** Snapshot shared QualityInspectionPlan lines into Purchase QI parameters (never live-linked). */
async function snapshotInspectionPlan(
  tenantId: string,
  planId: string,
): Promise<{
  inspectionPlanId: string
  inspectionPlanRevisionId: string | null
  planCodeSnapshot: string
  planRevisionSnapshot: string | null
  inspectionPlanLabel: string
  parameters: ReturnType<typeof buildQiParameters>
}> {
  const plan = await prisma.qualityInspectionPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    include: {
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: { parameter: true },
      },
      revisions: {
        where: { status: 'ACTIVE' },
        orderBy: { revisionNumber: 'desc' },
        take: 1,
      },
    },
  })
  if (!plan) throw new QualityInspectionValidationError('Inspection plan not found.')
  if (plan.status !== 'ACTIVE' && plan.category !== 'INCOMING') {
    // Allow ACTIVE or INCOMING-category plans; still allow ACTIVE only preferred
  }
  const rev = plan.revisions[0] ?? null
  const paramInputs: QualityInspectionParameterInput[] = plan.lines
    .filter((l) => l.parameter && !l.parameter.deletedAt && l.parameter.active)
    .map((l) => {
      const p = l.parameter!
      const min = l.minValueOverride ?? p.minValue
      const max = l.maxValueOverride ?? p.maxValue
      return {
        parameter: p.parameterName,
        parameterCode: p.parameterCode,
        sourceParameterId: p.id,
        specification: [p.parameterCode, min != null || max != null ? `[${min ?? '—'}..${max ?? '—'}]` : null]
          .filter(Boolean)
          .join(' '),
        minValue: min != null ? Number(min) : null,
        maxValue: max != null ? Number(max) : null,
        observedValue: null,
        unit: p.uomCode ?? '',
        result: 'na' as const,
        remarks: '',
      }
    })
  if (!paramInputs.length) {
    throw new QualityInspectionValidationError('Inspection plan has no active parameters to snapshot.')
  }
  return {
    inspectionPlanId: plan.id,
    inspectionPlanRevisionId: rev?.id ?? null,
    planCodeSnapshot: plan.planCode,
    planRevisionSnapshot: rev?.revisionCode ?? plan.revision ?? null,
    inspectionPlanLabel: `${plan.planCode} — ${plan.planName}`,
    parameters: buildQiParameters(paramInputs),
  }
}

function resultFromStatus(status: QualityInspectionStatus): string | null {
  if (status === 'ACCEPTED') return 'ACCEPT'
  if (status === 'PARTIALLY_ACCEPTED') return 'PARTIAL'
  if (status === 'REJECTED') return 'REJECT'
  if (status === 'DEVIATION_PENDING') return 'HOLD'
  return null
}

async function loadOrThrow(tenantId: string, id: string) {
  const row = await repo.findQualityInspectionById(tenantId, id)
  if (!row) throw new QualityInspectionNotFoundError()
  return row
}

async function resolveInspectorName(tenantId: string, userId: string | null | undefined) {
  if (!userId) return null
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    select: { firstName: true, lastName: true },
  })
  if (!user) return null
  return `${user.firstName} ${user.lastName}`.trim() || null
}

async function enrichmentForQi(
  tenantId: string,
  qi: { goodsReceiptId: string | null; lines: Array<{ goodsReceiptLineId: string | null }> },
): Promise<QiEnrichment> {
  if (!qi.goodsReceiptId) return {}
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id: qi.goodsReceiptId, tenantId, deletedAt: null },
    select: {
      grnNumber: true,
      purchaseOrderNumber: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          itemCodeSnapshot: true,
          itemNameSnapshot: true,
          batchNumber: true,
          lotNumber: true,
          receivedQuantity: true,
        },
      },
    },
  })
  if (!grn) return {}
  const lineItemFallbacks = new Map(
    grn.lines.map((l) => [
      l.id,
      {
        itemId: l.itemId,
        itemCode: l.itemCodeSnapshot,
        itemName: l.itemNameSnapshot,
        receivedQuantity: Number(l.receivedQuantity) || 0,
      },
    ]),
  )
  const firstLineId = qi.lines[0]?.goodsReceiptLineId
  const grnLine = (firstLineId && grn.lines.find((l) => l.id === firstLineId)) || grn.lines[0]
  const batchLotNo = grnLine
    ? [grnLine.batchNumber, grnLine.lotNumber].filter(Boolean).join(' / ')
    : ''
  return {
    goodsReceiptNumber: grn.grnNumber,
    purchaseOrderNumber: grn.purchaseOrderNumber,
    batchLotNo,
    lineItemFallbacks,
  }
}

async function toQiDto(
  tenantId: string,
  qi: NonNullable<Awaited<ReturnType<typeof repo.findQualityInspectionById>>>,
) {
  const enrichment = await enrichmentForQi(tenantId, qi)
  const dto = mapQualityInspection(qi, enrichment)
  if (!dto.inspectedByName && dto.inspectedById) {
    dto.inspectedByName = await resolveInspectorName(tenantId, dto.inspectedById)
  }
  return dto
}

async function loadGrn(tenantId: string, id?: string | null) {
  if (!id) return null
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: { lines: true },
  })
  if (!grn) throw new QualityInspectionValidationError('Goods receipt not found.')
  if (!['QC_PENDING', 'SUBMITTED', 'RECEIVING_COMPLETED'].includes(grn.status)) {
    throw new QualityInspectionWorkflowError('Goods receipt is not available for quality inspection.')
  }
  return grn
}

function buildQiLines(
  inputs: QualityInspectionLineInput[],
  grnLines?: Array<{
    id: string
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    purchaseOrderLineId: string | null
  }>,
) {
  validateQiLines(inputs)
  const byId = new Map((grnLines ?? []).map((l) => [l.id, l]))
  return inputs.map((line, index) => {
    const grnLine = line.goodsReceiptLineId ? byId.get(line.goodsReceiptLineId) : undefined
    return {
      lineNumber: index + 1,
      goodsReceiptLineId: line.goodsReceiptLineId ?? null,
      purchaseOrderLineId: line.purchaseOrderLineId ?? grnLine?.purchaseOrderLineId ?? null,
      itemId: line.itemId ?? grnLine?.itemId ?? null,
      itemCodeSnapshot: line.itemCode?.trim() || grnLine?.itemCodeSnapshot || '',
      itemNameSnapshot: line.itemName?.trim() || grnLine?.itemNameSnapshot || '',
      inspectedQuantity: qiQty(line.inspectedQuantity),
      acceptedQuantity: qiQty(line.acceptedQuantity),
      rejectedQuantity: qiQty(line.rejectedQuantity),
      deviationQuantity: qiQty(line.deviationQuantity),
      remarks: line.remarks?.trim() || null,
    }
  })
}

async function linesFromGrn(tenantId: string, grn: NonNullable<Awaited<ReturnType<typeof loadGrn>>>, requiredCategories: string[]) {
  const itemIds = grn.lines.map((line) => line.itemId).filter(Boolean) as string[]
  const items = requiredCategories.length && itemIds.length
    ? await prisma.masterItem.findMany({ where: { tenantId, id: { in: itemIds }, deletedAt: null }, include: { category: { select: { code: true } } } })
    : []
  const categoryByItem = new Map(items.map((item) => [item.id, item.category?.code]))
  const source = grn.lines.filter((line) =>
    line.qcRequired || !requiredCategories.length || (line.itemId && requiredCategories.includes(categoryByItem.get(line.itemId) ?? '')))
  if (!source.length) throw new QualityInspectionValidationError('No GRN lines require inspection under the configured inspection categories.')
  return source.map((line, index) => ({
    lineNumber: index + 1, goodsReceiptLineId: line.id, purchaseOrderLineId: line.purchaseOrderLineId,
    itemId: line.itemId, itemCodeSnapshot: line.itemCodeSnapshot, itemNameSnapshot: line.itemNameSnapshot,
    inspectedQuantity: qiQty(line.acceptedForQcQuantity) || qiQty(line.receivedQuantity),
    acceptedQuantity: 0, rejectedQuantity: 0, deviationQuantity: 0, remarks: null,
  }))
}

export async function listQualityInspections(tenantId: string, query: ListQualityInspectionsQuery) {
  const result = await repo.findQualityInspections(tenantId, query)
  const items = await Promise.all(result.items.map((row) => toQiDto(tenantId, row)))
  return { ...result, items }
}
export async function getQualityInspection(tenantId: string, id: string) {
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function createQualityInspection(tenantId: string, actorId: string, input: CreateQualityInspectionInput) {
  const defaults = await resolveEffectivePurchaseDefaults(tenantId, input.plantId)
  const grn = await loadGrn(tenantId, input.goodsReceiptId)
  if (input.purchaseOrderId && grn && input.purchaseOrderId !== grn.purchaseOrderId) throw new QualityInspectionValidationError('Purchase order does not match the goods receipt.')
  const lines = input.lines
    ? buildQiLines(input.lines, grn?.lines)
    : await linesFromGrn(tenantId, grn!, defaults.inspectionRequiredCategories)
  if (grn) {
    const grnLineIds = new Set(grn.lines.map((line) => line.id))
    if (lines.some((line) => line.goodsReceiptLineId && !grnLineIds.has(line.goodsReceiptLineId))) throw new QualityInspectionValidationError('Inspection line does not belong to the selected goods receipt.')
  }
  const inspectedByName =
    input.inspectedByName?.trim() ||
    (await resolveInspectorName(tenantId, input.inspectedById?.trim() || actorId))
  const inspectionNumber = await nextCode(tenantId, 'QUALITY_INSPECTION')
  const firstItemCode = lines[0]?.itemCodeSnapshot || ''

  let planSnap: Awaited<ReturnType<typeof snapshotInspectionPlan>> | null = null
  if (input.inspectionPlanId) {
    planSnap = await snapshotInspectionPlan(tenantId, input.inspectionPlanId)
  }

  const parameterInputs = input.parameters?.length
    ? input.parameters
    : planSnap
      ? null
      : defaultQiParameters(firstItemCode)
  const parameters = parameterInputs
    ? buildQiParameters(parameterInputs)
    : planSnap!.parameters
  const inspectionPlan =
    planSnap?.inspectionPlanLabel ||
    input.inspectionPlan?.trim() ||
    (firstItemCode ? `Incoming inspection — ${firstItemCode}` : 'Incoming inspection')
  const assignNow = Boolean(input.inspectedById?.trim())
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.purchaseQualityInspection.create({ data: {
      tenantId, inspectionNumber, inspectionDate: qiDate(input.inspectionDate) ?? new Date(),
      goodsReceiptId: grn?.id ?? input.goodsReceiptId ?? null,
      purchaseOrderId: grn?.purchaseOrderId ?? input.purchaseOrderId ?? null,
      vendorId: grn?.vendorId ?? input.vendorId ?? null,
      warehouseId: grn?.warehouseId ?? input.warehouseId ?? defaults.defaultWarehouseId,
      status: 'DRAFT',
      priority: input.priority?.trim() || 'NORMAL',
      inspectionPlanId: planSnap?.inspectionPlanId ?? input.inspectionPlanId ?? null,
      inspectionPlanRevisionId: planSnap?.inspectionPlanRevisionId ?? null,
      planCodeSnapshot: planSnap?.planCodeSnapshot ?? null,
      planRevisionSnapshot: planSnap?.planRevisionSnapshot ?? null,
      inspectionPlan,
      remarks: input.remarks?.trim() || null,
      deviationRemarks: input.deviationRemarks?.trim() || null,
      inspectedById: input.inspectedById?.trim() || actorId,
      inspectedByName,
      assignedAt: assignNow ? new Date() : null,
      createdById: actorId, updatedById: actorId,
      lines: { create: lines.map((line) => ({ ...line, tenantId })) },
      parameters: { create: parameters.map((parameter) => ({ ...parameter, tenantId })) },
    }, include: repo.includeQualityInspection })
    await repo.addQiHistory(tenantId, row.id, row.inspectionNumber, 'QI_CREATED', null, 'DRAFT', actorId, undefined, tx)
    if (grn) await tx.goodsReceipt.updateMany({ where: { id: grn.id, tenantId, deletedAt: null }, data: { status: 'QC_PENDING', updatedById: actorId } })
    return row
  })
  return toQiDto(tenantId, created)
}

export async function updateQualityInspection(tenantId: string, id: string, actorId: string, input: UpdateQualityInspectionInput) {
  const existing = await loadOrThrow(tenantId, id); assertQiEditable(existing.status)
  const lines = input.lines ? buildQiLines(input.lines) : undefined
  if (lines && existing.goodsReceiptId) {
    const grn = await loadGrn(tenantId, existing.goodsReceiptId)
    const ids = new Set(grn!.lines.map((line) => line.id))
    if (lines.some((line) => line.goodsReceiptLineId && !ids.has(line.goodsReceiptLineId))) throw new QualityInspectionValidationError('Inspection line does not belong to its goods receipt.')
  }
  const parameters = input.parameters ? buildQiParameters(input.parameters) : undefined
  await prisma.$transaction(async (tx) => {
    if (lines) await repo.replaceQualityInspectionLines(tenantId, id, lines, tx)
    if (parameters) await repo.replaceQualityInspectionParameters(tenantId, id, parameters, tx)
    await repo.updateQualityInspection(tenantId, id, {
      status: existing.status === 'DRAFT' ? 'IN_PROGRESS' : existing.status, updatedById: actorId,
      ...(input.inspectionDate !== undefined ? { inspectionDate: qiDate(input.inspectionDate) ?? existing.inspectionDate } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
      ...(input.inspectedById !== undefined ? { inspectedById: input.inspectedById } : {}),
      ...(input.inspectedByName !== undefined ? { inspectedByName: input.inspectedByName } : {}),
      ...(input.inspectionPlan !== undefined ? { inspectionPlan: input.inspectionPlan?.trim() || null } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks?.trim() || null } : {}),
      ...(input.deviationRemarks !== undefined ? { deviationRemarks: input.deviationRemarks?.trim() || null } : {}),
    }, tx)
    await repo.addQiHistory(tenantId, id, existing.inspectionNumber, 'QI_UPDATED', existing.status, existing.status === 'DRAFT' ? 'IN_PROGRESS' : existing.status, actorId, undefined, tx)
  })
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function completeQualityInspection(
  tenantId: string, id: string, actorId: string,
  body: {
    outcome?: 'AUTO' | 'ACCEPT' | 'REJECT'
    decisionCode?: string
    decisionReason?: string
    remarks?: string
    deviationRemarks?: string
  } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  if (!['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(existing.status)) throw new QualityInspectionWorkflowError(`Quality inspection cannot be completed from ${existing.status}.`)
  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  let lines = existing.lines.map((line) => ({
    ...line, inspectedQuantity: qiQty(line.inspectedQuantity), acceptedQuantity: qiQty(line.acceptedQuantity),
    rejectedQuantity: qiQty(line.rejectedQuantity), deviationQuantity: qiQty(line.deviationQuantity),
  }))
  if (body.outcome === 'ACCEPT') lines = lines.map((line) => ({ ...line, acceptedQuantity: line.inspectedQuantity, rejectedQuantity: 0, deviationQuantity: 0 }))
  if (body.outcome === 'REJECT') lines = lines.map((line) => ({ ...line, acceptedQuantity: 0, rejectedQuantity: line.inspectedQuantity, deviationQuantity: 0 }))
  validateQiLines(lines)
  const rejected = lines.reduce((sum, line) => sum + line.rejectedQuantity, 0)
  const deviations = lines.reduce((sum, line) => sum + line.deviationQuantity, 0)
  if (deviations && !body.deviationRemarks?.trim() && !existing.deviationRemarks?.trim()) throw new QualityInspectionValidationError('Deviation remarks are required.')
  if (deviations && !defaults.allowAcceptanceUnderDeviation) {
    const role = defaults.deviationApproverRole ? ` Approval by ${defaults.deviationApproverRole} is required.` : ''
    await transitionQi(tenantId, existing, actorId, 'DEVIATION_PENDING', 'QI_DEVIATION_PENDING', `${body.remarks ?? ''}${role}`.trim())
    return toQiDto(tenantId, await loadOrThrow(tenantId, id))
  }
  if (rejected && defaults.allowRejectedStockInQuarantine && !defaults.defaultRejectedLocationId && !defaults.defaultQualityHoldLocationId) {
    throw new QualityInspectionValidationError('Configure a rejected or quality-hold location before quarantining rejected stock.')
  }
  const accepted = lines.reduce((sum, line) => sum + line.acceptedQuantity + (defaults.allowAcceptanceUnderDeviation ? line.deviationQuantity : 0), 0)
  const status: QualityInspectionStatus = rejected && accepted ? 'PARTIALLY_ACCEPTED' : rejected ? 'REJECTED' : 'ACCEPTED'
  let result = resultFromStatus(status)
  let decisionCode = body.decisionCode?.trim() || null
  if (!decisionCode) {
    if (status === 'ACCEPTED') decisionCode = deviations ? 'DEVIATION_ACCEPT' : 'ACCEPT'
    else if (status === 'PARTIALLY_ACCEPTED') decisionCode = 'PARTIAL'
    else decisionCode = 'REJECT'
  }
  if (decisionCode === 'QUARANTINE' || decisionCode === 'REWORK') result = 'HOLD'
  if (decisionCode === 'RETURN_TO_VENDOR' || decisionCode === 'REPLACEMENT_REQUIRED') result = 'REJECT'
  if (decisionCode === 'DEVIATION_ACCEPT') result = 'ACCEPT'
  const decisionReason =
    body.decisionReason?.trim() ||
    body.remarks?.trim() ||
    existing.remarks?.trim() ||
    ''
  if (!decisionReason) {
    throw new QualityInspectionValidationError('Decision reason is required for every quality disposition.')
  }
  const grn = existing.goodsReceiptId
    ? await prisma.goodsReceipt.findFirst({
        where: { id: existing.goodsReceiptId, tenantId, deletedAt: null },
        include: { lines: true },
      })
    : null
  const grnLineById = new Map(grn?.lines.map((line) => [line.id, line]) ?? [])
  const enrichment = await enrichmentForQi(tenantId, existing)
  const linesForPersist = lines.map((line) => {
    const fb = line.goodsReceiptLineId
      ? enrichment.lineItemFallbacks?.get(line.goodsReceiptLineId)
      : undefined
    return {
      id: line.id,
      lineNumber: line.lineNumber,
      goodsReceiptLineId: line.goodsReceiptLineId,
      purchaseOrderLineId: line.purchaseOrderLineId,
      itemId: line.itemId || fb?.itemId || null,
      itemCodeSnapshot: line.itemCodeSnapshot || fb?.itemCode || '',
      itemNameSnapshot: line.itemNameSnapshot || fb?.itemName || '',
      inspectedQuantity: line.inspectedQuantity,
      acceptedQuantity: line.acceptedQuantity,
      rejectedQuantity: line.rejectedQuantity,
      deviationQuantity: line.deviationQuantity,
      remarks: line.remarks,
    }
  })

  // Fail closed: QI completion, GRN line qtys, stock release, and GRN INVENTORY_POSTED
  // commit together — never mark inventory posted if stock movements fail.
  if (!grn) {
    await prisma.$transaction(async (tx) => {
      await repo.replaceQualityInspectionLines(
        tenantId,
        id,
        linesForPersist.map(({ id: _lineId, ...line }) => line),
        tx,
      )
      await repo.updateQualityInspection(tenantId, id, {
        status, result, decisionCode, decisionReason, completedAt: new Date(), updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
        deviationRemarks: body.deviationRemarks?.trim() || existing.deviationRemarks,
      }, tx)
      await repo.addQiHistory(tenantId, id, existing.inspectionNumber, 'QI_COMPLETED', existing.status, status, actorId, body.remarks, tx)
    })
    return toQiDto(tenantId, await loadOrThrow(tenantId, id))
  }

  let qiInwardMovements: Awaited<ReturnType<typeof postGrnStockInward>> = []
  try {
    qiInwardMovements = await prisma.$transaction(async (tx) => {
      await repo.replaceQualityInspectionLines(
        tenantId,
        id,
        linesForPersist.map(({ id: _lineId, ...line }) => line),
        tx,
      )
      await repo.updateQualityInspection(tenantId, id, {
        status, result, decisionCode, decisionReason, completedAt: new Date(), updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
        deviationRemarks: body.deviationRemarks?.trim() || existing.deviationRemarks,
      }, tx)
      for (const line of linesForPersist.filter((item) => item.goodsReceiptLineId)) {
        await tx.goodsReceiptLine.updateMany({ where: { id: line.goodsReceiptLineId!, tenantId }, data: {
          acceptedQuantity: line.acceptedQuantity + (defaults.allowAcceptanceUnderDeviation ? line.deviationQuantity : 0),
          rejectedQuantity: line.rejectedQuantity,
        } })
      }

      const inwardLines = grn.lines.map((gl) => {
        const qiLine = linesForPersist.find((l) => l.goodsReceiptLineId === gl.id)
        const holdQty = qiLine
          ? qiLine.inspectedQuantity
          : qiQty(gl.acceptedForQcQuantity) || qiQty(gl.receivedQuantity)
        return {
          ...gl,
          acceptedForQcQuantity: holdQty,
          acceptedQuantity: holdQty,
        }
      })
      const inwardMovements = await postGrnStockInward({
        tenantId,
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        warehouseId: grn.warehouseId,
        lines: inwardLines,
        useAcceptedQuantity: true,
        actorId,
        tx,
      })
      for (const line of linesForPersist) {
        if (!line.goodsReceiptLineId || !line.itemId) continue
        const source = grnLineById.get(line.goodsReceiptLineId)
        if (!source) continue
        const acceptedQty =
          line.acceptedQuantity +
          (defaults.allowAcceptanceUnderDeviation ? line.deviationQuantity : 0)
        if (acceptedQty > 0) {
          await InventoryPostingService.transferStatus({
            tenantId,
            itemId: line.itemId,
            warehouseId: grn.warehouseId,
            fromStockStatus: 'QC_HOLD',
            stockStatus: 'UNRESTRICTED',
            quantity: acceptedQty,
            referenceType: 'QUALITY_RELEASE',
            referenceNo: existing.inspectionNumber,
            remarks: `QI accepted from ${grn.grnNumber}`,
            idempotencyKey: `qi-release:${id}:${line.goodsReceiptLineId}`,
            batchNumber: source.batchNumber ?? undefined,
            serialNumber: source.serialNumber ?? undefined,
            createdBy: actorId,
          }, tx)
        }
        if (line.rejectedQuantity > 0) {
          await InventoryPostingService.transferStatus({
            tenantId,
            itemId: line.itemId,
            warehouseId: grn.warehouseId,
            fromStockStatus: 'QC_HOLD',
            stockStatus: 'REJECTED',
            quantity: line.rejectedQuantity,
            referenceType: 'QUALITY_REJECT',
            referenceNo: existing.inspectionNumber,
            remarks: `QI rejected from ${grn.grnNumber}`,
            idempotencyKey: `qi-reject:${id}:${line.goodsReceiptLineId}`,
            batchNumber: source.batchNumber ?? undefined,
            serialNumber: source.serialNumber ?? undefined,
            createdBy: actorId,
          }, tx)
        }
      }

      await tx.goodsReceipt.updateMany({
        where: { id: existing.goodsReceiptId!, tenantId, deletedAt: null },
        data: { status: 'INVENTORY_POSTED', updatedById: actorId },
      })
      await repo.addQiHistory(tenantId, id, existing.inspectionNumber, 'QI_COMPLETED', existing.status, status, actorId, body.remarks, tx)
      return inwardMovements
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('QI inventory posting failed — purchase completion rolled back', {
      qualityInspectionId: id,
      goodsReceiptId: grn.id,
      error: message,
    })
    throw new QualityInspectionWorkflowError(
      `Quality inspection could not release stock to inventory: ${message}`,
    )
  }

  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, qiInwardMovements, {
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: grn.id,
    narration: `GRN inward ${grn.grnNumber} (via QI ${existing.inspectionNumber})`,
    userId: actorId,
  })
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

async function transitionQi(tenantId: string, existing: Awaited<ReturnType<typeof loadOrThrow>>, actorId: string, status: QualityInspectionStatus, action: string, remarks?: string) {
  await prisma.$transaction(async (tx) => {
    await repo.updateQualityInspection(tenantId, existing.id, { status, updatedById: actorId, remarks: remarks?.trim() || existing.remarks }, tx)
    await repo.addQiHistory(tenantId, existing.id, existing.inspectionNumber, action, existing.status, status, actorId, remarks, tx)
  })
}
export async function holdQualityInspection(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id)
  if (!['DRAFT', 'PENDING', 'IN_PROGRESS'].includes(existing.status)) {
    throw new QualityInspectionWorkflowError(`Quality inspection cannot be put on hold from ${existing.status}.`)
  }
  await transitionQi(
    tenantId,
    existing,
    actorId,
    'DEVIATION_PENDING',
    'QI_HOLD',
    body.remarks?.trim() || existing.remarks || 'Held pending review',
  )
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function cancelQualityInspection(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id)
  if (!['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(existing.status)) {
    throw new QualityInspectionWorkflowError(`Quality inspection cannot be cancelled from ${existing.status}.`)
  }
  await transitionQi(tenantId, existing, actorId, 'CANCELLED', 'QI_CANCELLED', body.remarks)
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function assignQualityInspector(
  tenantId: string,
  id: string,
  actorId: string,
  body: { inspectedById: string; inspectedByName?: string; priority?: string },
) {
  const existing = await loadOrThrow(tenantId, id)
  if (!['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(existing.status)) {
    throw new QualityInspectionWorkflowError(`Cannot assign inspector from ${existing.status}.`)
  }
  const name =
    body.inspectedByName?.trim() ||
    (await resolveInspectorName(tenantId, body.inspectedById)) ||
    body.inspectedById
  await prisma.$transaction(async (tx) => {
    await repo.updateQualityInspection(
      tenantId,
      id,
      {
        inspectedById: body.inspectedById,
        inspectedByName: name,
        assignedAt: new Date(),
        priority: body.priority?.trim() || existing.priority || 'NORMAL',
        status: existing.status === 'DRAFT' ? 'PENDING' : existing.status,
        updatedById: actorId,
      },
      tx,
    )
    await repo.addQiHistory(
      tenantId,
      id,
      existing.inspectionNumber,
      'QI_ASSIGNED',
      existing.status,
      existing.status === 'DRAFT' ? 'PENDING' : existing.status,
      actorId,
      `Assigned to ${name}`,
      tx,
    )
  })
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function startQualityInspection(tenantId: string, id: string, actorId: string) {
  const existing = await loadOrThrow(tenantId, id)
  if (!['DRAFT', 'PENDING'].includes(existing.status)) {
    if (existing.status === 'IN_PROGRESS') return toQiDto(tenantId, existing)
    throw new QualityInspectionWorkflowError(`Cannot start inspection from ${existing.status}.`)
  }
  await prisma.$transaction(async (tx) => {
    await repo.updateQualityInspection(
      tenantId,
      id,
      {
        status: 'IN_PROGRESS',
        startedAt: existing.startedAt ?? new Date(),
        assignedAt: existing.assignedAt ?? new Date(),
        updatedById: actorId,
      },
      tx,
    )
    await repo.addQiHistory(
      tenantId,
      id,
      existing.inspectionNumber,
      'QI_STARTED',
      existing.status,
      'IN_PROGRESS',
      actorId,
      undefined,
      tx,
    )
  })
  return toQiDto(tenantId, await loadOrThrow(tenantId, id))
}

/** Prefill payload for Purchase Return from rejected QI quantities. */
export async function getPurchaseReturnPrefillFromQi(tenantId: string, id: string) {
  const qi = await loadOrThrow(tenantId, id)
  const { computeRemainingReturnable } = await import(
    '../returns/returnable-quantity.service.js'
  )
  const returnable = await computeRemainingReturnable(tenantId, {
    qualityInspectionId: qi.id,
    goodsReceiptId: qi.goodsReceiptId,
  })
  if (!returnable.lines.some((l) => l.remainingReturnableQuantity > 0)) {
    throw new QualityInspectionValidationError('No remaining rejected quantity available for purchase return.')
  }
  return {
    vendorId: qi.vendorId ?? returnable.vendorId,
    purchaseOrderId: qi.purchaseOrderId ?? returnable.purchaseOrderId,
    goodsReceiptId: qi.goodsReceiptId ?? returnable.goodsReceiptId,
    qualityInspectionId: qi.id,
    qualityInspectionNumber: qi.inspectionNumber,
    warehouseId: qi.warehouseId ?? returnable.warehouseId,
    returnType:
      qi.decisionCode === 'REPLACEMENT_REQUIRED' ? 'REPLACEMENT' : 'CREDIT',
    decisionCode: qi.decisionCode,
    reason: qi.decisionReason || qi.remarks || `Rejected on ${qi.inspectionNumber}`,
    totalRejected: returnable.totalRejected,
    totalReturned: returnable.totalReturned,
    totalRemaining: returnable.totalRemaining,
    lines: returnable.lines
      .filter((l) => l.remainingReturnableQuantity > 0)
      .map((l) => ({
        goodsReceiptLineId: l.goodsReceiptLineId,
        purchaseOrderLineId: l.purchaseOrderLineId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        returnQuantity: l.remainingReturnableQuantity,
        remainingReturnableQuantity: l.remainingReturnableQuantity,
        rate: l.rate,
        batchNumber: l.batchNumber,
        serialNumber: l.serialNumber,
      })),
    nextActions: {
      createPurchaseReturn: true,
      createNcr: ['REJECTED', 'PARTIALLY_ACCEPTED', 'DEVIATION_PENDING'].includes(qi.status),
      createBoth: true,
    },
  }
}

/**
 * Optional NCR from Purchase QI (user action — never auto-create on reject).
 */
export async function createNcrFromPurchaseQi(
  tenantId: string,
  id: string,
  actorId: string,
  body: { title?: string; description?: string; severity?: 'CRITICAL' | 'MAJOR' | 'MINOR'; itemId?: string } = {},
) {
  const qi = await loadOrThrow(tenantId, id)
  if (!['REJECTED', 'PARTIALLY_ACCEPTED', 'DEVIATION_PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(qi.status)) {
    throw new QualityInspectionWorkflowError(`Cannot open NCR from inspection status ${qi.status}.`)
  }
  const itemId =
    body.itemId ||
    qi.lines.find((l) => qiQty(l.rejectedQuantity) > 0)?.itemId ||
    qi.lines[0]?.itemId ||
    null
  const ncrNumber = await nextCode(tenantId, 'QUALITY_NCR')
  const ncr = await prisma.qualityNcr.create({
    data: {
      tenantId,
      ncrNumber,
      severity: body.severity ?? 'MAJOR',
      title: body.title?.trim() || `Incoming reject ${qi.inspectionNumber}`,
      description:
        body.description?.trim() ||
        qi.remarks ||
        qi.deviationRemarks ||
        `NCR from purchase quality inspection ${qi.inspectionNumber}`,
      itemId,
      supplierId: qi.vendorId,
      sourceType: 'PURCHASE_QI',
      sourceId: qi.id,
      goodsReceiptId: qi.goodsReceiptId,
      reportedByUserId: actorId,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
  return {
    id: ncr.id,
    ncrNumber: ncr.ncrNumber,
    status: ncr.status,
    sourceType: ncr.sourceType,
    sourceId: ncr.sourceId,
    goodsReceiptId: ncr.goodsReceiptId,
    supplierId: ncr.supplierId,
    itemId: ncr.itemId,
    href: `/quality/ncr/${ncr.id}`,
  }
}
