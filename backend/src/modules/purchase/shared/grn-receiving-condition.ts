import type { GrnReceivingCondition } from '@prisma/client'

export const GRN_RECEIVING_CONDITIONS = [
  'NORMAL',
  'SHORT',
  'EXCESS',
  'DAMAGE',
  'REJECTED',
  'QUALITY_HOLD',
] as const satisfies readonly GrnReceivingCondition[]

export type GrnReceivingConditionInput = (typeof GRN_RECEIVING_CONDITIONS)[number]

export function suggestReceivingCondition(input: {
  openQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  rejectedQuantity: number
  qcRequired: boolean
  shortCloseRequested: boolean
}): GrnReceivingCondition {
  const open = Math.max(0, input.openQuantity)
  const received = Math.max(0, input.receivedQuantity)
  const damaged = Math.max(0, input.damagedQuantity)
  const rejected = Math.max(0, input.rejectedQuantity)

  if (received <= 0 && !input.shortCloseRequested) return 'NORMAL'
  if (input.qcRequired && received > 0) return 'QUALITY_HOLD'
  if (rejected >= received && received > 0) return 'REJECTED'
  if (damaged > 0) return 'DAMAGE'
  if (received > open) return 'EXCESS'
  if (received < open || input.shortCloseRequested) return 'SHORT'
  return 'NORMAL'
}

export function resolveReceivingCondition(input: {
  openQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  rejectedQuantity: number
  qcRequired: boolean
  shortCloseRequested: boolean
  userCondition?: GrnReceivingConditionInput | null
}): GrnReceivingCondition {
  const suggested = suggestReceivingCondition(input)
  if (!input.userCondition) return suggested
  return input.userCondition
}
