/**
 * Guided Fulfilment URL progress — same idea as CRM Guided Deal (`?step=`).
 */
import type { FulfilmentJourneyStepId } from './FulfilmentJourneyStrip'

export const FULFILMENT_JOURNEY_STEPS: FulfilmentJourneyStepId[] = [
  'produce',
  'quality',
  'stock',
  'dispatch',
]

export function parseFulfilmentJourneyStep(
  raw: string | null | undefined,
): FulfilmentJourneyStepId | null {
  if (!raw) return null
  return FULFILMENT_JOURNEY_STEPS.includes(raw as FulfilmentJourneyStepId)
    ? (raw as FulfilmentJourneyStepId)
    : null
}

export function fulfilmentJourneyPath(opts?: {
  step?: FulfilmentJourneyStepId | null
  woId?: string | null
  salesOrderId?: string | null
}): string {
  const params = new URLSearchParams()
  if (opts?.step) params.set('step', opts.step)
  if (opts?.woId) params.set('woId', opts.woId)
  if (opts?.salesOrderId) params.set('salesOrderId', opts.salesOrderId)
  const q = params.toString()
  return q ? `/manufacturing/guided-fulfilment?${q}` : '/manufacturing/guided-fulfilment'
}
