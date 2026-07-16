import { seedDemoCustomers } from './seeds/demoCustomersSeed'
import { seedDemoVendors } from './seeds/demoVendorsSeed'
import { seedDemoItems, seedDemoProducts } from './seeds/demoItemsSeed'
import { seedDemoBoms } from './seeds/demoBomSeed'
import { seedDemoRoutings } from './seeds/demoRoutingSeed'
import { seedDemoInventory } from './seeds/demoInventorySeed'
import { seedDemoDispatch, seedDemoFinance } from './seeds/demoDispatchSeed'
import { seedDemoEngineering } from './seeds/demoEngineeringSeed'
import { seedDemoTraceability } from './seeds/demoTraceabilitySeed'
import { seedDemoDocuments } from './seeds/demoDocumentsSeed'
import { seedDemoApprovals } from './seeds/demoApprovalsSeed'
import { seedDemoActivity } from './seeds/demoActivitySeed'
import { seedDemoPurchaseRequisitions, seedDemoPurchasePipeline } from './seeds/demoPurchaseSeed'
import { seedDemoJobWorkOrders } from './seeds/demoJobWorkSeed'
import { seedDemoSaturationSupplement } from './seeds/demoSaturationSupplement'
import { useBomStore } from '../store/bomStore'

/** Phase 1 — masters after baseline, before transactional scenarios */
export function seedDemoMastersPhase(): void {
  seedDemoCustomers()
  seedDemoVendors()
  seedDemoItems()
  seedDemoProducts()
  seedDemoBoms()
  seedDemoRoutings()
  for (const h of useBomStore.getState().bomHeaders) {
    useBomStore.getState().refreshCosts(h.id)
  }
}

/** Phase 2 — post bulk seed transactional top-up */
export function seedDemoTransactionalPhase(): void {
  seedDemoInventory()
  seedDemoDispatch()
  seedDemoFinance()
  seedDemoPurchaseRequisitions()
  seedDemoPurchasePipeline()
  seedDemoJobWorkOrders()
  seedDemoEngineering()
  seedDemoTraceability()
  seedDemoDocuments()
  seedDemoApprovals()
  seedDemoActivity()
  seedDemoSaturationSupplement()
}

/** Transactional saturation only — call after bulk seed */
export function runDemoSaturationTransactional(): { warnings: string[] } {
  const warnings: string[] = []
  try {
    seedDemoTransactionalPhase()
  } catch (e) {
    warnings.push(`Transactional saturation: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { warnings }
}

/** Full saturation pass — masters + transactional */
export function runDemoSaturationSeed(): { warnings: string[] } {
  const warnings: string[] = []
  try {
    seedDemoMastersPhase()
  } catch (e) {
    warnings.push(`Masters saturation: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    seedDemoTransactionalPhase()
  } catch (e) {
    warnings.push(`Transactional saturation: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { warnings }
}
