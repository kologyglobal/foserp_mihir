import { clearErpLocalStorage, markDemoLoaded } from '../demoStorage'
import { resetDemoBaseline } from '../resetDemoBaseline'
import { runGoLiveScenario } from '../scenarios/goLiveScenario'
import { runDemoScenarioExtensions } from '../scenarios/scenarioExtensions'
import { runDemoBulkSeed } from '../demoBulkSeed'
import { seedDemoMastersPhase, seedDemoTransactionalPhase, runDemoSaturationTransactional } from '../demoSaturationSeed'
import { persistAllDemoStores } from '../persistDemoStores'
import { useBomStore } from '../../store/bomStore'
import { validateDemoDataCounts, type DemoDataValidationReport } from '../validateDemoData'
import type { LoadDemoDataResult } from '../demoTypes'
import { setSessionUserForTests } from '../../utils/permissions'

export type { DemoDataValidationReport }

/** Orchestrator — seeds full connected factory demo in dependency order */
export function seedFullFactoryDemoData(): LoadDemoDataResult {
  try {
    setSessionUserForTests({ role: 'admin', name: 'Demo Seed' })
    clearErpLocalStorage()
    resetDemoBaseline()
    seedDemoMastersPhase()

    for (const h of useBomStore.getState().bomHeaders) {
      useBomStore.getState().refreshCosts(h.id)
    }

    const goLive = runGoLiveScenario()
    if (!goLive.ok) {
      return { ok: false, error: goLive.error ?? 'Go-live scenario failed' }
    }

    const { warnings: extWarnings } = runDemoScenarioExtensions()
    const { warnings: bulkWarnings } = runDemoBulkSeed()
    const { warnings: satWarnings } = runDemoSaturationTransactional()
    persistAllDemoStores()
    markDemoLoaded()

    return { ok: true, warnings: [...extWarnings, ...bulkWarnings, ...satWarnings] }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Validate seeded demo data counts and orphan rules */
export function validateDemoData(): DemoDataValidationReport {
  return validateDemoDataCounts()
}

/** Clear all local demo data without reloading */
export function clearDemoData(): void {
  clearErpLocalStorage()
}

export { seedDemoMastersPhase, seedDemoTransactionalPhase }
