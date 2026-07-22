/**
 * Fixed Assets dual-mode helpers — resolve default legal entity for API calls.
 */
import { listLegalEntities } from '@/services/bridges/financeApiBridge'
import type { LegalEntity } from '@/types/financeSetup'

export async function resolveDefaultLegalEntity(): Promise<LegalEntity> {
  const entities = await listLegalEntities()
  const active = entities.filter((e) => e.isActive)
  const preferred = active.find((e) => e.isDefault) ?? active[0] ?? entities[0]
  if (!preferred) {
    throw new Error('No legal entity available for Fixed Assets. Configure Finance › Legal Entities first.')
  }
  return preferred
}
