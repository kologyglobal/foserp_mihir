/**
 * Canonical procurement process — UX source of truth.
 * Purchase remains demo-only transactional ERP; coverage reflects frontend screens only.
 */

export type PurchaseWorkflowCoverage = 'exists' | 'partial' | 'deferred'

export type PurchaseWorkflowStep = {
  step: number
  /** Exact canonical wording */
  label: string
  /** Compact label for strips / chips */
  shortLabel: string
  coverage: PurchaseWorkflowCoverage
  /** Deep link when a screen exists */
  href?: string
  /** Demo notes for tooltips / planned copy */
  note?: string
}

/** Full 20-step procurement lifecycle (canonical). */
export const PURCHASE_WORKFLOW_STEPS: PurchaseWorkflowStep[] = [
  {
    step: 1,
    label: 'Demand Generated',
    shortLabel: 'Demand',
    coverage: 'partial',
    href: '/purchase/requisitions',
    note: 'PR sources (MRP, manual, reorder, WO). No standalone demand register.',
  },
  {
    step: 2,
    label: 'Stock and Incoming Quantity Checked',
    shortLabel: 'Stock check',
    coverage: 'deferred',
    note: 'Inventory availability / open PO inbound check — planned with inventory backend.',
  },
  {
    step: 3,
    label: 'Purchase Requisition Created',
    shortLabel: 'PR created',
    coverage: 'exists',
    href: '/purchase/requisitions',
  },
  {
    step: 4,
    label: 'Requisition Approved',
    shortLabel: 'PR approved',
    coverage: 'exists',
    href: '/purchase/requisitions',
  },
  {
    step: 5,
    label: 'RFQ Sent to Approved Vendors',
    shortLabel: 'RFQ sent',
    coverage: 'exists',
    href: '/purchase/rfqs',
  },
  {
    step: 6,
    label: 'Vendor Quotations Received',
    shortLabel: 'Quotes in',
    coverage: 'exists',
    href: '/purchase/vendor-quotations',
  },
  {
    step: 7,
    label: 'Technical and Commercial Comparison',
    shortLabel: 'Compare',
    coverage: 'exists',
    href: '/purchase/comparison',
  },
  {
    step: 8,
    label: 'Vendor Selected',
    shortLabel: 'Vendor selected',
    coverage: 'partial',
    href: '/purchase/comparison',
    note: 'RFQ recommendation + PO vendor pick. No formal award document.',
  },
  {
    step: 9,
    label: 'Purchase Order Created',
    shortLabel: 'PO created',
    coverage: 'exists',
    href: '/purchase/orders',
  },
  {
    step: 10,
    label: 'Purchase Order Approved and Released',
    shortLabel: 'PO released',
    coverage: 'exists',
    href: '/purchase/orders',
  },
  {
    step: 11,
    label: 'Vendor Confirmation Received',
    shortLabel: 'Vendor ack',
    coverage: 'partial',
    href: '/purchase/orders',
    note: 'Demo uses PO Sent status as proxy — no separate vendor acknowledgement object.',
  },
  {
    step: 12,
    label: 'Material Delivered',
    shortLabel: 'Delivered',
    coverage: 'partial',
    href: '/purchase/orders',
    note: 'Inferred from GRN / partial receive. No ASN / delivery note register.',
  },
  {
    step: 13,
    label: 'Gate Entry and GRN',
    shortLabel: 'Gate / GRN',
    coverage: 'partial',
    href: '/purchase/grn',
    note: 'GRN demo is live; gate entry fields are stub / planned.',
  },
  {
    step: 14,
    label: 'Quality Inspection',
    shortLabel: 'QC',
    coverage: 'partial',
    href: '/quality/incoming',
    note: 'GRN pending_qc + link into Quality incoming. Not a purchase-owned QC ledger.',
  },
  {
    step: 15,
    label: 'Accepted Stock Posted to Inventory',
    shortLabel: 'Stock posted',
    coverage: 'partial',
    href: '/purchase/grn',
    note: 'GRN Posted simulates stock posting in demo — no inventory ledger API.',
  },
  {
    step: 16,
    label: 'Vendor Invoice Received',
    shortLabel: 'Invoice in',
    coverage: 'deferred',
    note: 'Accounts payable — planned with finance.',
  },
  {
    step: 17,
    label: 'PO–GRN–Invoice Matching',
    shortLabel: '3-way match',
    coverage: 'deferred',
    note: 'Three-way match — planned with finance.',
  },
  {
    step: 18,
    label: 'Invoice Approved and Posted',
    shortLabel: 'Invoice posted',
    coverage: 'deferred',
    note: 'AP posting — planned with finance.',
  },
  {
    step: 19,
    label: 'Vendor Payment',
    shortLabel: 'Payment',
    coverage: 'deferred',
    note: 'Vendor payment — planned with finance.',
  },
  {
    step: 20,
    label: 'Purchase Order Closed',
    shortLabel: 'PO closed',
    coverage: 'exists',
    href: '/purchase/orders',
  },
]

/** Primary operable stages for the dashboard strip (skips pure deferred AP steps as secondary). */
export const PURCHASE_WORKFLOW_NAV_STEPS = PURCHASE_WORKFLOW_STEPS.filter(
  (s) => s.coverage !== 'deferred' || [2, 16].includes(s.step),
)

export function purchaseWorkflowStep(n: number): PurchaseWorkflowStep | undefined {
  return PURCHASE_WORKFLOW_STEPS.find((s) => s.step === n)
}

export function purchaseWorkflowCoverageLabel(c: PurchaseWorkflowCoverage): string {
  if (c === 'exists') return 'Available'
  if (c === 'partial') return 'Partial'
  return 'Planned'
}
