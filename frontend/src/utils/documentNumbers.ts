/**
 * @deprecated Use getNextCode from services/codeSeriesService instead.
 */
import { entityTypeFromLegacyPrefix, getNextCode } from '../services/codeSeriesService'

export function nextDocumentNo(prefix: string, existing: string[]): string {
  const entityType = entityTypeFromLegacyPrefix(prefix)
  if (entityType) {
    return getNextCode(entityType, { existingNumbers: existing })
  }
  const nums = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  const max = nums.reduce((m, n) => (n > m ? n : m), 0)
  const next = max + 1
  const pad = prefix.startsWith('GP-') || prefix.startsWith('QC-') ? 5 : 4
  return `${prefix}${String(next).padStart(pad, '0')}`
}
