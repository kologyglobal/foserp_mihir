import type { ManufacturingQualityInspectionStatus } from '@prisma/client'
import { prisma } from '../../config/database.js'

const PENDING_STATUSES: ManufacturingQualityInspectionStatus[] = ['PENDING', 'REWORK', 'READY', 'IN_PROGRESS']
const OPEN_QI_STATUSES = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'] as const

function isMissingTable(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2021'
  )
}

async function countGrnQcPending(tenantId: string): Promise<number> {
  try {
    return await prisma.goodsReceipt.count({
      where: { tenantId, deletedAt: null, status: 'QC_PENDING' },
    })
  } catch (err) {
    if (isMissingTable(err)) return 0
    throw err
  }
}

async function countOpenPurchaseQi(tenantId: string): Promise<number> {
  try {
    return await prisma.qualityInspection.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [...OPEN_QI_STATUSES] },
      },
    })
  } catch (err) {
    if (isMissingTable(err)) return 0
    throw err
  }
}

export async function getWorkspaceSummary(tenantId: string) {
  const pendingFilter = { in: PENDING_STATUSES }
  const [
    incomingFromGrn,
    incomingFromPurchaseQi,
    inProcessPending,
    finalPending,
    jobWorkPending,
    openNcrs,
    certificatesMissing,
  ] = await Promise.all([
    countGrnQcPending(tenantId),
    countOpenPurchaseQi(tenantId),
    prisma.manufacturingQualityInspection.count({
      where: { tenantId, category: 'IN_PROCESS', status: pendingFilter },
    }),
    prisma.manufacturingQualityInspection.count({
      where: { tenantId, category: 'FINAL', status: pendingFilter },
    }),
    prisma.manufacturingQualityInspection.count({
      where: { tenantId, category: 'SUBCONTRACT_RETURN', status: pendingFilter },
    }),
    prisma.qualityNcr.count({
      where: { tenantId, status: { notIn: ['CLOSED', 'CANCELLED'] } },
    }),
    prisma.manufacturingQualityInspection.count({
      where: {
        tenantId,
        certificateRequired: true,
        status: pendingFilter,
        OR: [{ certificateStatus: null }, { certificateStatus: { not: 'VERIFIED' } }],
      },
    }),
  ])

  const incomingPending = incomingFromGrn + incomingFromPurchaseQi
  return {
    incomingPending,
    incomingNote:
      incomingPending > 0
        ? 'Incoming QC is driven by Purchase GRN (QC_PENDING) and purchase quality inspections. Open /purchase/quality-inspections or complete GRN QC.'
        : 'No pending incoming GRN QC. Manufacturing plans/NCR remain on the shared Quality engine.',
    incomingGrnPending: incomingFromGrn,
    incomingPurchaseQiPending: incomingFromPurchaseQi,
    inProcessPending,
    finalPending,
    jobWorkPending,
    openNcrs,
    certificatesMissing,
  }
}

/** @deprecated Prefer getIncomingQueue — kept for callers expecting the readiness shape. */
export function incomingNotReady() {
  return {
    ready: true,
    code: 'PURCHASE_INCOMING_QC_AVAILABLE' as const,
    message:
      'Incoming QC uses Purchase GRN + purchase quality inspections. Shared Quality plans/NCR/release remain the manufacturing engine.',
  }
}

export type IncomingQueueRow =
  | {
      kind: 'GRN'
      id: string
      number: string
      status: string
      vendorName: string | null
      warehouseId: string | null
      receivedDate: string | null
      href: string
    }
  | {
      kind: 'PURCHASE_QI'
      id: string
      number: string
      status: string
      grnId: string | null
      grnNumber: string | null
      vendorName: string | null
      href: string
    }

/**
 * Live Incoming QC work queue — Purchase GRN rows waiting for QC plus open purchase QI docs.
 * Manufacturing INCOMING category inspections are not used for GRN material; that path is Purchase QI.
 * Missing purchase tables (migration not applied) return an empty ready queue instead of 500.
 */
export async function getIncomingQueue(tenantId: string): Promise<{
  ready: true
  code: 'PURCHASE_INCOMING_QC_AVAILABLE'
  message: string
  items: IncomingQueueRow[]
  counts: { grnPending: number; purchaseQiPending: number; total: number }
}> {
  let grns: Array<{
    id: string
    grnNumber: string
    status: string
    warehouseId: string
    receiptDate: Date
    vendorNameSnapshot: string
  }> = []
  let qis: Array<{
    id: string
    inspectionNumber: string
    status: string
    goodsReceiptId: string | null
  }> = []

  try {
    grns = await prisma.goodsReceipt.findMany({
      where: { tenantId, deletedAt: null, status: 'QC_PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        grnNumber: true,
        status: true,
        warehouseId: true,
        receiptDate: true,
        vendorNameSnapshot: true,
      },
    })
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }

  try {
    qis = await prisma.qualityInspection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [...OPEN_QI_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        inspectionNumber: true,
        status: true,
        goodsReceiptId: true,
      },
    })
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }

  const qiGrnIds = [...new Set(qis.map((q) => q.goodsReceiptId).filter(Boolean))] as string[]
  let qiGrnById = new Map<string, { id: string; grnNumber: string; vendorNameSnapshot: string }>()
  if (qiGrnIds.length) {
    try {
      const qiGrns = await prisma.goodsReceipt.findMany({
        where: { tenantId, id: { in: qiGrnIds }, deletedAt: null },
        select: { id: true, grnNumber: true, vendorNameSnapshot: true },
      })
      qiGrnById = new Map(qiGrns.map((g) => [g.id, g]))
    } catch (err) {
      if (!isMissingTable(err)) throw err
    }
  }

  const items: IncomingQueueRow[] = [
    ...grns.map((g) => ({
      kind: 'GRN' as const,
      id: g.id,
      number: g.grnNumber,
      status: g.status,
      vendorName: g.vendorNameSnapshot || null,
      warehouseId: g.warehouseId,
      receivedDate: g.receiptDate.toISOString().slice(0, 10),
      href: `/purchase/grn/${g.id}`,
    })),
    ...qis.map((q) => {
      const grn = q.goodsReceiptId ? qiGrnById.get(q.goodsReceiptId) : undefined
      return {
        kind: 'PURCHASE_QI' as const,
        id: q.id,
        number: q.inspectionNumber,
        status: q.status,
        grnId: q.goodsReceiptId,
        grnNumber: grn?.grnNumber ?? null,
        vendorName: grn?.vendorNameSnapshot || null,
        href: `/purchase/quality-inspections/${q.id}`,
      }
    }),
  ]

  return {
    ready: true,
    code: 'PURCHASE_INCOMING_QC_AVAILABLE',
    message:
      'Incoming QC uses Purchase GRN (QC_PENDING) and purchase quality inspections. Open a row to inspect or release stock.',
    items,
    counts: {
      grnPending: grns.length,
      purchaseQiPending: qis.length,
      total: items.length,
    },
  }
}
