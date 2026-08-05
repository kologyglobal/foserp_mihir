export type GrnReceivingCondition =
  | 'NORMAL'
  | 'SHORT'
  | 'EXCESS'
  | 'DAMAGE'
  | 'REJECTED'
  | 'QUALITY_HOLD'

export const GRN_RECEIVING_CONDITION_LABELS: Record<GrnReceivingCondition, string> = {
  NORMAL: 'Normal',
  SHORT: 'Short',
  EXCESS: 'Excess',
  DAMAGE: 'Damage',
  REJECTED: 'Rejected',
  QUALITY_HOLD: 'Quality hold',
}

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
