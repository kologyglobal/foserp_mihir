import { createHash, randomUUID } from 'node:crypto'
import type { CorrectionImpactPreview } from './correction.types.js'

export function makePreviewToken(parts: Record<string, unknown>): string {
  const payload = JSON.stringify(parts)
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

export function makeSourceVersion(updatedAt: Date | string | null | undefined, extra = ''): string {
  const ts = updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt ?? '')
  return `${ts}:${extra}`
}

export function emptyPreview(
  partial: Partial<CorrectionImpactPreview> & Pick<CorrectionImpactPreview, 'headline' | 'original' | 'proposed' | 'sourceVersion'>,
): CorrectionImpactPreview {
  return {
    warnings: [],
    blockers: [],
    followUpActions: [],
    approvalRequired: false,
    riskLevel: 'MEDIUM',
    dependencies: [],
    previewToken: makePreviewToken({ ...partial.original, v: partial.sourceVersion }),
    ...partial,
  }
}

export function newIdempotencySuffix() {
  return randomUUID().slice(0, 8)
}
