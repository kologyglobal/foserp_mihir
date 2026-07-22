import type { PaymentAccountMapping } from '@prisma/client'
import { PaymentAccountMappingAmbiguousError, PaymentAccountMappingNoMatchError } from '../treasury.errors.js'
import * as repo from './payment-account-mapping.repository.js'
import type { ResolvePaymentAccountMappingInput } from './payment-account-mapping.schemas.js'

/**
 * Resolution priority (highest wins), evaluated in order:
 *   1. Exact branch match beats branch-agnostic (branchId = null).
 *   2. Exact currency match beats currency-agnostic (currencyCode = null).
 *   3. An exact direction match (RECEIPT/PAYMENT) beats a BOTH-direction mapping.
 *   4. Lower `priority` number wins (explicit tie-break).
 *   5. `isDefault = true` wins over `isDefault = false`.
 * If more than one candidate remains tied after all five rules, resolution is
 * rejected as PAYMENT_ACCOUNT_MAPPING_AMBIGUOUS rather than guessing.
 */
function specificityScore(mapping: PaymentAccountMapping, input: ResolvePaymentAccountMappingInput): number {
  const branchExact = mapping.branchId != null && mapping.branchId === (input.branchId ?? null)
  const currencyExact = mapping.currencyCode != null && mapping.currencyCode === (input.currencyCode ?? null)
  const directionExact = mapping.direction === input.direction
  return (branchExact ? 4 : 0) + (currencyExact ? 2 : 0) + (directionExact ? 1 : 0)
}

export async function resolvePaymentAccountMapping(
  tenantId: string,
  input: ResolvePaymentAccountMappingInput,
): Promise<PaymentAccountMapping> {
  const candidates = await repo.findCandidatesForResolve(
    tenantId,
    input.legalEntityId,
    input.paymentMethod,
    input.useCase,
    input.direction,
  )

  // Branch/currency must either match exactly or be branch-/currency-agnostic (null) on the mapping.
  const eligible = candidates.filter((mapping) => {
    const branchOk = mapping.branchId == null || mapping.branchId === (input.branchId ?? null)
    const currencyOk = mapping.currencyCode == null || mapping.currencyCode === (input.currencyCode ?? null)
    return branchOk && currencyOk
  })

  if (eligible.length === 0) throw new PaymentAccountMappingNoMatchError()
  if (eligible.length === 1) return eligible[0]

  const scored = eligible.map((mapping) => ({ mapping, score: specificityScore(mapping, input) }))
  const maxScore = Math.max(...scored.map((s) => s.score))
  let winners = scored.filter((s) => s.score === maxScore).map((s) => s.mapping)
  if (winners.length === 1) return winners[0]

  const minPriority = Math.min(...winners.map((m) => m.priority))
  const priorityWinners = winners.filter((m) => m.priority === minPriority)
  if (priorityWinners.length === 1) return priorityWinners[0]
  winners = priorityWinners

  const defaultWinners = winners.filter((m) => m.isDefault)
  if (defaultWinners.length === 1) return defaultWinners[0]

  throw new PaymentAccountMappingAmbiguousError()
}
