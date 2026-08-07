/**
 * Incoming Quality operational queue — line-level work items for /quality/incoming.
 * Purchase owns write APIs; this is read + assign orchestration that reuses Purchase QI services.
 */
import { prisma } from '../../../config/prisma.js'
import { z } from 'zod'
import * as purchaseQi from '../../purchase/quality-inspections/quality-inspection.service.js'

const OPEN_QI = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'] as const
const OPEN_QI_SET = new Set<string>(OPEN_QI)

export const incomingQueueQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  status: z.string().trim().max(40).optional(),
  inspectorId: z.string().trim().max(36).optional(),
  ageingMinDays: z.coerce.number().min(0).optional(),
  ageingMaxDays: z.coerce.number().min(0).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  priority: z.string().trim().max(16).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type IncomingQueueQuery = z.infer<typeof incomingQueueQuerySchema>

export type IncomingQueueWorkItem = {
  id: string
  kind: 'GRN_LINE' | 'PURCHASE_QI_LINE'
  goodsReceiptId: string
  goodsReceiptNumber: string
  goodsReceiptLineId: string | null
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  vendorId: string | null
  vendorName: string | null
  warehouseId: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  receivedQuantity: number
  qcHoldQuantity: number
  qualityInspectionId: string | null
  qualityInspectionNumber: string | null
  inspectionStatus: string
  result: string | null
  priority: string
  inspectorId: string | null
  inspectorName: string | null
  assignedAt: string | null
  startedAt: string | null
  completedAt: string | null
  receivedDate: string | null
  ageingDays: number
  ageingBand: '0-1' | '2-3' | '4-7' | '8+'
  hrefGrn: string
  hrefQi: string | null
  hrefCreateQi: string
  allowedActions: string[]
}

function ageingBand(days: number): IncomingQueueWorkItem['ageingBand'] {
  if (days <= 1) return '0-1'
  if (days <= 3) return '2-3'
  if (days <= 7) return '4-7'
  return '8+'
}

function ageingDays(from: Date, now = new Date()): number {
  const ms = now.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

function isMissingTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2021'
}

export async function getIncomingWorkbench(
  tenantId: string,
  query: IncomingQueueQuery,
): Promise<{
  ready: true
  code: 'PURCHASE_INCOMING_QC_AVAILABLE'
  message: string
  summary: {
    total: number
    openQi: number
    grnAwaitingQi: number
    ageingHot: number
    qcHoldQty: number
  }
  items: IncomingQueueWorkItem[]
  page: number
  limit: number
  total: number
}> {
  const now = new Date()
  let grns: Array<{
    id: string
    grnNumber: string
    status: string
    warehouseId: string
    receiptDate: Date
    vendorId: string | null
    vendorNameSnapshot: string
    purchaseOrderId: string | null
    purchaseOrderNumber: string
    createdAt: Date
    lines: Array<{
      id: string
      itemId: string | null
      itemCodeSnapshot: string
      itemNameSnapshot: string
      receivedQuantity: unknown
      acceptedQuantity: unknown
      rejectedQuantity: unknown
      acceptedForQcQuantity: unknown
      qcRequired: boolean
    }>
  }> = []

  try {
    grns = await prisma.goodsReceipt.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['QC_PENDING', 'SUBMITTED', 'RECEIVING_COMPLETED', 'INVENTORY_POSTED'] },
        OR: [
          { status: 'QC_PENDING' },
          {
            id: {
              in: (
                await prisma.purchaseQualityInspection.findMany({
                  where: {
                    tenantId,
                    deletedAt: null,
                    status: { in: [...OPEN_QI] },
                    goodsReceiptId: { not: null },
                  },
                  select: { goodsReceiptId: true },
                  take: 500,
                })
              )
                .map((q) => q.goodsReceiptId)
                .filter(Boolean) as string[],
            },
          },
        ],
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              receiptDate: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { receiptDate: 'asc' },
      take: 200,
      include: {
        lines: {
          where: query.itemId ? { itemId: query.itemId } : undefined,
        },
      },
    })
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }

  // Always include open QI without matching filter edge cases
  let openQis: Array<{
    id: string
    inspectionNumber: string
    status: string
    result: string | null
    priority: string
    goodsReceiptId: string | null
    warehouseId: string | null
    vendorId: string | null
    inspectedById: string | null
    inspectedByName: string | null
    assignedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    inspectionDate: Date
    lines: Array<{
      id: string
      goodsReceiptLineId: string | null
      itemId: string | null
      itemCodeSnapshot: string
      itemNameSnapshot: string
      inspectedQuantity: unknown
      acceptedQuantity: unknown
      rejectedQuantity: unknown
    }>
  }> = []

  // Phase 2 hardening: once a QI reaches a terminal disposition it belongs on
  // the Completed QC register (`/purchase/quality-inspections`), not this
  // working queue — so the default view here is open work only. A caller may
  // still explicitly ask for one closed status (e.g. the queue's own "Rejected"
  // filter) with no arbitrary time window.
  const explicitStatus = query.status && query.status !== 'ALL' ? query.status : null
  try {
    openQis = await prisma.purchaseQualityInspection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: explicitStatus ? (explicitStatus as never) : { in: [...OPEN_QI] },
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.inspectorId ? { inspectedById: query.inspectorId } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { lines: true },
    }) as typeof openQis
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }

  const qiByGrn = new Map<string, (typeof openQis)[0]>()
  for (const qi of openQis) {
    if (qi.goodsReceiptId && (!qiByGrn.has(qi.goodsReceiptId) || OPEN_QI_SET.has(qi.status))) {
      qiByGrn.set(qi.goodsReceiptId, qi)
    }
  }

  const grnIdsMissing = openQis
    .map((q) => q.goodsReceiptId)
    .filter((id): id is string => Boolean(id) && !grns.some((g) => g.id === id))
  if (grnIdsMissing.length) {
    try {
      const extra = await prisma.goodsReceipt.findMany({
        where: { tenantId, id: { in: grnIdsMissing }, deletedAt: null },
        include: { lines: true },
      })
      grns = [...grns, ...extra]
    } catch (err) {
      if (!isMissingTable(err)) throw err
    }
  }

  const grnById = new Map(grns.map((g) => [g.id, g]))
  const items: IncomingQueueWorkItem[] = []

  // Open QI lines first (operational focus)
  for (const qi of openQis) {
    if (query.itemId && !qi.lines.some((l) => l.itemId === query.itemId)) continue
    const grn = qi.goodsReceiptId ? grnById.get(qi.goodsReceiptId) : undefined
    const ageBase = qi.startedAt ?? qi.assignedAt ?? qi.createdAt
    const days = ageingDays(ageBase, now)
    if (query.ageingMinDays != null && days < query.ageingMinDays) continue
    if (query.ageingMaxDays != null && days > query.ageingMaxDays) continue

    const lineSources = qi.lines.length
      ? qi.lines
      : [
          {
            id: qi.id,
            goodsReceiptLineId: null,
            itemId: null,
            itemCodeSnapshot: '',
            itemNameSnapshot: '',
            inspectedQuantity: 0,
            acceptedQuantity: 0,
            rejectedQuantity: 0,
          },
        ]

    for (const line of lineSources) {
      if (query.itemId && line.itemId !== query.itemId) continue
      const grnLine = line.goodsReceiptLineId
        ? grn?.lines.find((gl) => gl.id === line.goodsReceiptLineId)
        : undefined
      const received = grnLine
        ? Number(grnLine.receivedQuantity) || 0
        : Number(line.inspectedQuantity) || 0
      const statusOpen = OPEN_QI_SET.has(qi.status)
      const qcHold = statusOpen ? received : 0
      const actions: string[] = ['OPEN_GRN', 'OPEN_QI', 'VIEW_STOCK']
      if (statusOpen) {
        actions.push('ASSIGN', 'START', 'COMPLETE')
        if (['PARTIALLY_ACCEPTED', 'REJECTED', 'ACCEPTED', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(qi.status)) {
          actions.push('CREATE_NCR')
        }
      }
      if (['PARTIALLY_ACCEPTED', 'REJECTED'].includes(qi.status) || Number(line.rejectedQuantity) > 0) {
        actions.push('CREATE_RETURN')
      }

      items.push({
        id: `qi:${qi.id}:line:${line.id}`,
        kind: 'PURCHASE_QI_LINE',
        goodsReceiptId: grn?.id ?? qi.goodsReceiptId ?? '',
        goodsReceiptNumber: grn?.grnNumber ?? '—',
        goodsReceiptLineId: line.goodsReceiptLineId,
        purchaseOrderId: grn?.purchaseOrderId ?? null,
        purchaseOrderNumber: grn?.purchaseOrderNumber ?? null,
        vendorId: qi.vendorId ?? grn?.vendorId ?? null,
        vendorName: grn?.vendorNameSnapshot ?? null,
        warehouseId: qi.warehouseId ?? grn?.warehouseId ?? null,
        itemId: line.itemId,
        itemCode: line.itemCodeSnapshot || grnLine?.itemCodeSnapshot || '',
        itemName: line.itemNameSnapshot || grnLine?.itemNameSnapshot || '',
        receivedQuantity: received,
        qcHoldQuantity: qcHold,
        qualityInspectionId: qi.id,
        qualityInspectionNumber: qi.inspectionNumber,
        inspectionStatus: qi.status,
        result: qi.result,
        priority: qi.priority || 'NORMAL',
        inspectorId: qi.inspectedById,
        inspectorName: qi.inspectedByName,
        assignedAt: qi.assignedAt?.toISOString() ?? null,
        startedAt: qi.startedAt?.toISOString() ?? null,
        completedAt: qi.completedAt?.toISOString() ?? null,
        receivedDate: grn?.receiptDate?.toISOString().slice(0, 10) ?? qi.inspectionDate.toISOString().slice(0, 10),
        ageingDays: days,
        ageingBand: ageingBand(days),
        hrefGrn: grn ? `/purchase/grn/${grn.id}` : '/purchase/grn',
        hrefQi: `/purchase/quality-inspections/${qi.id}`,
        hrefCreateQi: grn ? `/purchase/quality-inspections/new?grnId=${grn.id}` : '/purchase/quality-inspections/new',
        allowedActions: actions,
      })
    }
  }

  // GRN QC_PENDING without open QI
  for (const grn of grns.filter((g) => g.status === 'QC_PENDING' && !qiByGrn.has(g.id))) {
    for (const line of grn.lines) {
      if (query.itemId && line.itemId !== query.itemId) continue
      if (query.search) {
        const s = query.search.toLowerCase()
        const hay = `${grn.grnNumber} ${grn.vendorNameSnapshot} ${line.itemCodeSnapshot} ${line.itemNameSnapshot}`.toLowerCase()
        if (!hay.includes(s)) continue
      }
      const days = ageingDays(grn.receiptDate ?? grn.createdAt, now)
      if (query.ageingMinDays != null && days < query.ageingMinDays) continue
      if (query.ageingMaxDays != null && days > query.ageingMaxDays) continue
      if (query.inspectorId) continue
      if (query.status && query.status !== 'ALL' && query.status !== 'QC_PENDING' && query.status !== 'AWAITING_QI') continue

      const received = Number(line.receivedQuantity) || 0
      items.push({
        id: `grn:${grn.id}:line:${line.id}`,
        kind: 'GRN_LINE',
        goodsReceiptId: grn.id,
        goodsReceiptNumber: grn.grnNumber,
        goodsReceiptLineId: line.id,
        purchaseOrderId: grn.purchaseOrderId,
        purchaseOrderNumber: grn.purchaseOrderNumber,
        vendorId: grn.vendorId,
        vendorName: grn.vendorNameSnapshot,
        warehouseId: grn.warehouseId,
        itemId: line.itemId,
        itemCode: line.itemCodeSnapshot,
        itemName: line.itemNameSnapshot,
        receivedQuantity: received,
        qcHoldQuantity: received,
        qualityInspectionId: null,
        qualityInspectionNumber: null,
        inspectionStatus: 'AWAITING_QI',
        result: null,
        priority: days >= 4 ? 'HIGH' : 'NORMAL',
        inspectorId: null,
        inspectorName: null,
        assignedAt: null,
        startedAt: null,
        completedAt: null,
        receivedDate: grn.receiptDate.toISOString().slice(0, 10),
        ageingDays: days,
        ageingBand: ageingBand(days),
        hrefGrn: `/purchase/grn/${grn.id}`,
        hrefQi: null,
        hrefCreateQi: `/purchase/quality-inspections/new?grnId=${grn.id}`,
        allowedActions: ['OPEN_GRN', 'CREATE_QI', 'VIEW_STOCK'],
      })
    }
  }

  // Search filter for QI items
  let filtered = items
  if (query.search) {
    const s = query.search.toLowerCase()
    filtered = items.filter((row) =>
      `${row.goodsReceiptNumber} ${row.qualityInspectionNumber ?? ''} ${row.vendorName ?? ''} ${row.itemCode} ${row.itemName}`
        .toLowerCase()
        .includes(s),
    )
  }

  filtered.sort((a, b) => b.ageingDays - a.ageingDays || a.goodsReceiptNumber.localeCompare(b.goodsReceiptNumber))

  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const total = filtered.length
  const pageItems = filtered.slice((page - 1) * limit, page * limit)

  const openQiCount = new Set(
    filtered.filter((r) => r.qualityInspectionId && OPEN_QI_SET.has(r.inspectionStatus)).map((r) => r.qualityInspectionId),
  ).size
  const grnAwaiting = new Set(filtered.filter((r) => r.kind === 'GRN_LINE').map((r) => r.goodsReceiptId)).size

  return {
    ready: true,
    code: 'PURCHASE_INCOMING_QC_AVAILABLE',
    message:
      'Incoming QC command center — Purchase GRN + Purchase QI with shared stock status. Writes use purchase.qi.* APIs.',
    summary: {
      total,
      openQi: openQiCount,
      grnAwaitingQi: grnAwaiting,
      ageingHot: filtered.filter((r) => r.ageingDays >= 4).length,
      qcHoldQty: filtered.reduce((s, r) => s + r.qcHoldQuantity, 0),
    },
    items: pageItems,
    page,
    limit,
    total,
  }
}

/** Legacy thin queue shape (kept for older clients). */
export async function getIncomingQueueLegacy(tenantId: string) {
  const wb = await getIncomingWorkbench(tenantId, { page: 1, limit: 100 })
  return {
    ready: true as const,
    code: 'PURCHASE_INCOMING_QC_AVAILABLE' as const,
    message: wb.message,
    items: wb.items.map((row) =>
      row.qualityInspectionId
        ? {
            kind: 'PURCHASE_QI' as const,
            id: row.qualityInspectionId,
            number: row.qualityInspectionNumber!,
            status: row.inspectionStatus,
            grnId: row.goodsReceiptId || null,
            grnNumber: row.goodsReceiptNumber,
            vendorName: row.vendorName,
            href: row.hrefQi!,
          }
        : {
            kind: 'GRN' as const,
            id: row.goodsReceiptId,
            number: row.goodsReceiptNumber,
            status: row.inspectionStatus,
            vendorName: row.vendorName,
            warehouseId: row.warehouseId,
            receivedDate: row.receivedDate,
            href: row.hrefGrn,
          },
    ),
    counts: {
      grnPending: wb.summary.grnAwaitingQi,
      purchaseQiPending: wb.summary.openQi,
      total: wb.summary.total,
    },
    summary: wb.summary,
    workItems: wb.items,
  }
}

export async function assignIncomingInspector(
  tenantId: string,
  actorId: string,
  body: { qualityInspectionId: string; inspectedById: string; inspectedByName?: string; priority?: string },
) {
  return purchaseQi.assignQualityInspector(tenantId, body.qualityInspectionId, actorId, {
    inspectedById: body.inspectedById,
    inspectedByName: body.inspectedByName,
    priority: body.priority,
  })
}

export async function startIncomingInspection(
  tenantId: string,
  actorId: string,
  body: { qualityInspectionId: string },
) {
  return purchaseQi.startQualityInspection(tenantId, body.qualityInspectionId, actorId)
}
