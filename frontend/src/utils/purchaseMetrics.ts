import { usePurchaseStore } from '../store/purchaseStore'
import type { PurchaseDashboardMetrics } from '../types/purchase'

export function buildPurchaseDashboardMetrics(): PurchaseDashboardMetrics {
  const { requisitions, rfqs, purchaseOrders, grns, vendorQuotations } = usePurchaseStore.getState()
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const openPrs = requisitions.filter((p) => !['converted', 'cancelled'].includes(p.status)).length
  const prPendingApproval = requisitions.filter((p) => p.status === 'submitted').length
  const rfqsOpen = rfqs.filter((r) => ['draft', 'sent', 'quoted'].includes(r.status)).length
  const vendorQuotationsPending = vendorQuotations.filter((v) => v.status === 'draft' || v.status === 'submitted').length
  const poPendingApproval = purchaseOrders.filter((p) => p.status === 'submitted').length

  const openPos = purchaseOrders.filter((p) => ['approved', 'released', 'sent', 'partial'].includes(p.status))
  const openPoValue = openPos.reduce(
    (s, po) => s + po.lines.reduce((ls, l) => ls + l.qty * l.rate, 0),
    0,
  )

  const poDueThisWeek = openPos.filter((p) => p.expectedDate >= today && p.expectedDate <= weekEnd).length
  const grnPending = grns.filter((g) => g.status === 'draft').length
  const qcPending = grns.filter((g) => g.status === 'pending_qc').length
  const lateDeliveries = usePurchaseStore.getState().getDelayedPoReport().length

  const perf = usePurchaseStore.getState().getVendorPerformanceReport()
  const vendorOnTimePct =
    perf.length > 0 ? Math.round(perf.reduce((s, v) => s + v.onTimePct, 0) / perf.length) : 100

  const purchaseSavings = rfqs.reduce((s, rfq) => {
    const cmp = usePurchaseStore.getState().getVendorComparison(rfq.id)
    if (cmp.length < 2) return s
    const rates = cmp.map((c) => c.landedCostPerUnit).sort((a, b) => a - b)
    return s + Math.max(0, (rates[rates.length - 1]! - rates[0]!) * 10)
  }, 0)

  return {
    openPrs,
    prPendingApproval,
    rfqsOpen,
    vendorQuotationsPending,
    poPendingApproval,
    openPoValue,
    poDueThisWeek,
    grnPending,
    qcPending,
    lateDeliveries,
    purchaseSavings: Math.round(purchaseSavings),
    vendorOnTimePct,
  }
}
