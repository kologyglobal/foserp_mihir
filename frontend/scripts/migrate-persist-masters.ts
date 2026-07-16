/**
 * Migrates / repairs persisted BOM, Routing, and Work Center slices in localStorage.
 *
 * Usage (browser devtools or Node with exported storage JSON):
 *   npx tsx scripts/migrate-persist-masters.ts
 *
 * Simulates split-brain: WO references seed BOM/routing while master slices empty.
 */
import { createMemoryStorage, ERP_STORAGE_KEYS, readPersistedJson, writePersistedJson } from '../src/store/persistConfig.ts'
import {
  collectReferencedMasterIds,
  mergeBomWithSeed,
  mergeRoutingWithSeed,
  mergeWorkCentersWithSeed,
  repairMastersFromSeed,
} from '../src/utils/persistMigration.ts'
import { mergeIntegrityReports, validateManufacturingIntegrity, validateRoutingWorkCenters } from '../src/utils/integrityCheck.ts'
import type { WorkOrder } from '../src/types/workorder.ts'

function loadBrowserLocalStorage(): Record<string, string> {
  if (typeof globalThis.localStorage === 'undefined') return {}
  const out: Record<string, string> = {}
  for (const key of Object.values(ERP_STORAGE_KEYS)) {
    const val = globalThis.localStorage.getItem(key)
    if (val) out[key] = val
  }
  return out
}

function main() {
  const snapshot = loadBrowserLocalStorage()
  const storage = createMemoryStorage(snapshot)

  const woSlice = readPersistedJson<{ workOrders: WorkOrder[]; productionOperations: Array<{ id: string; workOrderId: string; workCenterId: string; routingOperationId: string }> }>(
    ERP_STORAGE_KEYS.workOrders,
    storage,
  )

  let bom = mergeBomWithSeed(readPersistedJson(ERP_STORAGE_KEYS.bom, storage))
  let routing = mergeRoutingWithSeed(readPersistedJson(ERP_STORAGE_KEYS.routing, storage))
  let workCenters = mergeWorkCentersWithSeed(readPersistedJson(ERP_STORAGE_KEYS.workCenters, storage))

  console.log('── Migrate Persisted Masters ──')
  console.log(`Work orders in storage: ${woSlice?.workOrders?.length ?? 0}`)
  console.log(`BOM headers before: ${bom.bomHeaders.length}`)
  console.log(`Routing headers before: ${routing.routingHeaders.length}`)
  console.log(`Work centers before: ${workCenters.workCenters.length}`)

  if (!woSlice?.workOrders?.length) {
    console.log('No persisted work orders — writing merged seed masters only.')
    writePersistedJson(ERP_STORAGE_KEYS.bom, bom, storage)
    writePersistedJson(ERP_STORAGE_KEYS.routing, routing, storage)
    writePersistedJson(ERP_STORAGE_KEYS.workCenters, workCenters, storage)
    console.log('Done.')
    return
  }

  const refs = collectReferencedMasterIds({
    workOrders: woSlice.workOrders,
    productionOperations: woSlice.productionOperations ?? [],
    routingOperations: routing.routingOperations,
  })

  const repaired = repairMastersFromSeed({
    bom,
    routing,
    workCenters,
    referencedBomIds: refs.bomIds,
    referencedRoutingIds: refs.routingIds,
    referencedWorkCenterIds: refs.workCenterIds,
  })

  bom = repaired.bom
  routing = repaired.routing
  workCenters = repaired.workCenters

  const bomHeaderIds = new Set(bom.bomHeaders.map((h) => h.id))
  const routingHeaderIds = new Set(routing.routingHeaders.map((h) => h.id))
  const workCenterIds = new Set(workCenters.workCenters.map((w) => w.id))
  const routingOperationIds = new Set(routing.routingOperations.map((o) => o.id))

  const report = mergeIntegrityReports(
    validateManufacturingIntegrity({
      workOrders: woSlice.workOrders,
      bomHeaderIds,
      routingHeaderIds,
      workCenterIds,
      routingOperationIds,
      productionOperations: woSlice.productionOperations ?? [],
    }),
    {
      ok: true,
      errorCount: 0,
      warningCount: 0,
      issues: validateRoutingWorkCenters(routing.routingOperations, workCenterIds),
      checkedAt: new Date().toISOString(),
    },
  )

  writePersistedJson(ERP_STORAGE_KEYS.bom, bom, storage)
  writePersistedJson(ERP_STORAGE_KEYS.routing, routing, storage)
  writePersistedJson(ERP_STORAGE_KEYS.workCenters, workCenters, storage)

  console.log('Repair summary:', repaired.repair)
  console.log(`BOM headers after: ${bom.bomHeaders.length}`)
  console.log(`Routing headers after: ${routing.routingHeaders.length}`)
  console.log(`Work centers after: ${workCenters.workCenters.length}`)
  console.log(`Integrity: ${report.ok ? 'OK' : 'FAILED'} (${report.errorCount} errors, ${report.warningCount} warnings)`)
  if (!report.ok) {
    for (const issue of report.issues.filter((i) => i.severity === 'error')) {
      console.error(`  • ${issue.message}`)
    }
    process.exitCode = 1
  }
}

main()
