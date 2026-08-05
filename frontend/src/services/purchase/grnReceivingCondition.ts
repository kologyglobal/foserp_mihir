export type GrnReceivingCondition =
  | 'NORMAL'
  | 'SHORT'
  | 'EXCESS'
  | 'DAMAGE'
  | 'REJECTED'
  | 'QUALITY_HOLD'

export const GRN_RECEIVING_CONDITION_LABELS: Record<GrnReceivingCondition, string> = {
  NORMAL: 'Normal',
  SHORT: 'Short received',
  EXCESS: 'Excess received',
  DAMAGE: 'Damaged material',
  REJECTED: 'Fully rejected',
  QUALITY_HOLD: 'Quality hold',
}

/** Plain-language help — not tolerance; explains why received qty differs from PO. */
export const GRN_RECEIVING_CONDITION_DESCRIPTIONS: Record<GrnReceivingCondition, string> = {
  NORMAL: 'Qty matches PO pending (within normal receipt).',
  SHORT: 'Vendor delivered less than pending — balance stays open for a later GRN unless you close open.',
  EXCESS: 'Vendor delivered more than pending — check tolerance; outside band needs Purchase Manager approval.',
  DAMAGE: 'Qty arrived but part is unusable — enter rejected qty; only accepted qty becomes good stock.',
  REJECTED: 'Entire line rejected at receipt — nothing goes to good stock.',
  QUALITY_HOLD: 'QC required — stock stays on hold until inspection accepts or rejects.',
}

export const GRN_LINES_RECEIVING_GUIDE = {
  intro:
    'Receiving condition is why qty differs from the PO — it is separate from tolerance % and from accepted/rejected stock split.',
  columns: [
    {
      term: 'Received',
      meaning: 'Physical qty on the vendor challan / at gate now (0 = not received this time).',
    },
    {
      term: 'Accepted',
      meaning: 'Qty that will become good inventory after this GRN (or after QC if inspection is on).',
    },
    {
      term: 'Rejected',
      meaning: 'Damaged or failed qty — does not enter good stock (old “Dmg” field). Use when material arrived but is not usable.',
    },
    {
      term: 'Short (condition)',
      meaning: 'Received is less than pending — vendor short-shipped; remaining qty stays on the PO.',
    },
    {
      term: 'Excess (condition)',
      meaning: 'Received is more than pending — vendor over-shipped; tolerance % decides if approval is needed.',
    },
    {
      term: 'Damage (condition)',
      meaning: 'Full qty received but quality is bad — pair with Rejected qty so accepted + rejected = received.',
    },
    {
      term: 'Qty Tol % / Status',
      meaning: 'System tolerance check on quantity variance — not the business reason (use Condition for that).',
    },
    {
      term: 'Close open',
      meaning: 'Stop expecting remaining PO qty (short-close) — requires a reason; may need approval.',
    },
  ],
} as const

export const GRN_SHORT_CLOSE_REASONS = [
  { value: 'SHORT_SUPPLY_ACCEPTED', label: 'Short supply accepted' },
  { value: 'VENDOR_CANCELLED', label: 'Vendor cancelled' },
  { value: 'NO_REQUIREMENT', label: 'No requirement' },
  { value: 'OTHER', label: 'Other' },
] as const

export function suggestReceivingCondition(input: {
  pendingQty: number
  receivedQty: number
  rejectedQty: number
  damagedQty: number
  qcRequired: boolean
  shortCloseRequested: boolean
}): GrnReceivingCondition {
  const open = Math.max(0, input.pendingQty)
  const received = Math.max(0, input.receivedQty)
  const damaged = Math.max(0, input.damagedQty)
  const rejected = Math.max(0, input.rejectedQty)

  if (received <= 0 && !input.shortCloseRequested) return 'NORMAL'
  if (input.qcRequired && received > 0) return 'QUALITY_HOLD'
  if (rejected >= received && received > 0) return 'REJECTED'
  if (damaged > 0) return 'DAMAGE'
  if (received > open) return 'EXCESS'
  if (received < open || input.shortCloseRequested) return 'SHORT'
  return 'NORMAL'
}

export function resolveReceivingCondition(input: {
  pendingQty: number
  receivedQty: number
  rejectedQty: number
  damagedQty: number
  qcRequired: boolean
  shortCloseRequested: boolean
  userCondition?: GrnReceivingCondition | null
}): GrnReceivingCondition {
  if (!input.userCondition) return suggestReceivingCondition(input)
  return input.userCondition
}
