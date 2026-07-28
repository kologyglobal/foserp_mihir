import { prisma } from '../../../config/database.js'

export type GrniReportRow = {
  goodsReceiptId: string
  grnNumber: string
  receiptDate: string
  ageDays: number
  purchaseOrderId: string
  purchaseOrderNumber: string
  vendorId: string
  vendorName: string
  goodsReceiptLineId: string
  itemCode: string
  itemName: string
  acceptedQty: number
  invoicedQty: number
  openQty: number
  openValue: number
  grnStatus: string
}

function num(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0
  return Number(v)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * Goods received not invoiced (qty recon) — accepted/received GRN lines with open qty vs
 * non-cancelled purchase invoice lines linked by goodsReceiptLineId.
 */
export async function listGrniRows(
  tenantId: string,
  filters: { vendorId?: string; dateFrom?: string; dateTo?: string } = {},
): Promise<{ rows: GrniReportRow[]; openValueTotal: number }> {
  const grns = await prisma.goodsReceipt.findMany({
    where: {
      tenantId,
      status: { notIn: ['DRAFT', 'CANCELLED', 'REVERSED'] },
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            receiptDate: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      lines: true,
    },
    orderBy: { receiptDate: 'asc' },
  })

  const lineIds = grns.flatMap((g) => g.lines.map((l) => l.id))
  const invoicedByLine = new Map<string, number>()
  if (lineIds.length) {
    const invLines = await prisma.purchaseInvoiceLine.findMany({
      where: {
        tenantId,
        goodsReceiptLineId: { in: lineIds },
        purchaseInvoice: {
          tenantId,
          status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] },
        },
      },
      select: { goodsReceiptLineId: true, quantity: true },
    })
    for (const row of invLines) {
      if (!row.goodsReceiptLineId) continue
      invoicedByLine.set(
        row.goodsReceiptLineId,
        (invoicedByLine.get(row.goodsReceiptLineId) ?? 0) + num(row.quantity),
      )
    }
  }

  const today = new Date()
  const rows: GrniReportRow[] = []
  for (const grn of grns) {
    for (const line of grn.lines) {
      const accepted =
        num(line.acceptedQuantity) > 0 ? num(line.acceptedQuantity) : num(line.receivedQuantity)
      if (accepted <= 0) continue
      const invoicedQty = invoicedByLine.get(line.id) ?? 0
      const openQty = Number((accepted - invoicedQty).toFixed(4))
      if (openQty <= 0.0001) continue
      const openValue = Number((openQty * num(line.rate)).toFixed(2))
      rows.push({
        goodsReceiptId: grn.id,
        grnNumber: grn.grnNumber,
        receiptDate: isoDate(grn.receiptDate),
        ageDays: daysBetween(grn.receiptDate, today),
        purchaseOrderId: grn.purchaseOrderId,
        purchaseOrderNumber: grn.purchaseOrderNumber,
        vendorId: grn.vendorId,
        vendorName: grn.vendorNameSnapshot,
        goodsReceiptLineId: line.id,
        itemCode: line.itemCodeSnapshot,
        itemName: line.itemNameSnapshot,
        acceptedQty: Number(accepted.toFixed(4)),
        invoicedQty: Number(invoicedQty.toFixed(4)),
        openQty,
        openValue,
        grnStatus: grn.status,
      })
    }
  }

  const openValueTotal = Number(rows.reduce((s, r) => s + r.openValue, 0).toFixed(2))
  return { rows, openValueTotal }
}
