import { buildMatchPlan, planToPreviewDto } from './bank-reconciliation-match.service.js'
import type { MatchPreviewResultDto, PreviewMatchInput } from './bank-reconciliation.types.js'

/** Dry-run of a proposed match — validates every rule but persists nothing. */
export async function previewMatch(tenantId: string, input: PreviewMatchInput): Promise<MatchPreviewResultDto> {
  const plan = await buildMatchPlan(tenantId, input)
  return planToPreviewDto(plan)
}
