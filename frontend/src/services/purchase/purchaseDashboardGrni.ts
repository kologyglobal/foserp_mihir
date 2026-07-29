import {
  GRN_DOMAIN_STATUS_LABELS,
  type GoodsReceiptNote,
  type PurchaseDashboardGrniRow,
  type PurchaseInvoice,
} from '../../types/purchaseDomain'

function round2(n: number): number {
  return Number(n.toFixed(2))
}

function money(n: number): number {
  return Number(n.toFixed(2))
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`)
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

/** Aggregate line-level GRNI into header rows for the purchase dashboard. */
export function buildPurchaseDashboardGrniRows(
  grns: GoodsReceiptNote[],
  invoices: PurchaseInvoice[],
  options?: { today?: string; limit?: number },
): PurchaseDashboardGrniRow[] {
  const today = options?.today ?? new Date().toISOString().slice(0, 10)
  const limit = options?.limit ?? 15

  const invoicedByGrnLine = new Map<string, number>()
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue
    for (const line of inv.lines) {
      if (!line.goodsReceiptLineId) continue
      invoicedByGrnLine.set(
        line.goodsReceiptLineId,
        (invoicedByGrnLine.get(line.goodsReceiptLineId) ?? 0) + Number(line.quantity || 0),
      )
    }
  }

  const rows: PurchaseDashboardGrniRow[] = []
  for (const grn of grns) {
    if (grn.status === 'draft' || grn.status === 'cancelled') continue

    let acceptedQty = 0
    let invoicedQty = 0
    let openQty = 0
    let openValue = 0
    let openLineCount = 0

    for (const line of grn.lines) {
      const accepted = line.acceptedQty > 0 ? line.acceptedQty : line.receivedQty
      if (accepted <= 0) continue
      const invQty = invoicedByGrnLine.get(line.id) ?? 0
      const open = accepted - invQty
      acceptedQty += accepted
      invoicedQty += invQty
      if (open > 0.0001) {
        openQty += open
        openValue += open * Number(line.rate || 0)
        openLineCount += 1
      }
    }

    if (openLineCount === 0) continue

    rows.push({
      id: grn.id,
      grnNumber: grn.documentNumber,
      receiptDate: grn.documentDate,
      ageDays: daysBetween(grn.documentDate, today),
      vendorName: grn.vendor.name,
      purchaseOrderId: grn.purchaseOrderId,
      purchaseOrderNumber: grn.purchaseOrderNumber,
      openLineCount,
      acceptedQty: round2(acceptedQty),
      invoicedQty: round2(invoicedQty),
      openQty: round2(openQty),
      openValue: money(openValue),
      status: grn.status,
      statusLabel: GRN_DOMAIN_STATUS_LABELS[grn.status] ?? grn.status,
      href: `/purchase/grn/${grn.id}`,
      createInvoiceHref: `/purchase/invoices/new?fromGrn=${encodeURIComponent(grn.id)}`,
    })
  }

  return rows
    .sort((a, b) => b.ageDays - a.ageDays || a.grnNumber.localeCompare(b.grnNumber))
    .slice(0, limit)
}

export type GrniReportApiRow = {
  goodsReceiptId: string
  grnNumber: string
  receiptDate: string
  ageDays: number
  purchaseOrderId: string
  purchaseOrderNumber: string
  vendorName: string
  acceptedQty: number
  invoicedQty: number
  openQty: number
  openValue: number
  grnStatus: string
}

/** Collapse backend GRNI line rows into dashboard header rows. */
export function aggregateGrniReportToDashboardRows(
  reportRows: GrniReportApiRow[],
  options?: { limit?: number },
): PurchaseDashboardGrniRow[] {
  const limit = options?.limit ?? 15
  const byGrn = new Map<string, PurchaseDashboardGrniRow>()

  for (const row of reportRows) {
    const existing = byGrn.get(row.goodsReceiptId)
    if (!existing) {
      const statusKey = String(row.grnStatus || '').toLowerCase()
      const statusLabel =
        GRN_DOMAIN_STATUS_LABELS[statusKey as keyof typeof GRN_DOMAIN_STATUS_LABELS] ??
        String(row.grnStatus || 'Received').replace(/_/g, ' ')
      byGrn.set(row.goodsReceiptId, {
        id: row.goodsReceiptId,
        grnNumber: row.grnNumber,
        receiptDate: row.receiptDate,
        ageDays: row.ageDays,
        vendorName: row.vendorName,
        purchaseOrderId: row.purchaseOrderId,
        purchaseOrderNumber: row.purchaseOrderNumber,
        openLineCount: 1,
        acceptedQty: round2(row.acceptedQty),
        invoicedQty: round2(row.invoicedQty),
        openQty: round2(row.openQty),
        openValue: money(row.openValue),
        status: statusKey as PurchaseDashboardGrniRow['status'],
        statusLabel,
        href: `/purchase/grn/${row.goodsReceiptId}`,
        createInvoiceHref: `/purchase/invoices/new?fromGrn=${encodeURIComponent(row.goodsReceiptId)}`,
      })
      continue
    }
    existing.openLineCount += 1
    existing.acceptedQty = round2(existing.acceptedQty + row.acceptedQty)
    existing.invoicedQty = round2(existing.invoicedQty + row.invoicedQty)
    existing.openQty = round2(existing.openQty + row.openQty)
    existing.openValue = money(existing.openValue + row.openValue)
    existing.ageDays = Math.max(existing.ageDays, row.ageDays)
  }

  return [...byGrn.values()]
    .sort((a, b) => b.ageDays - a.ageDays || a.grnNumber.localeCompare(b.grnNumber))
    .slice(0, limit)
}
