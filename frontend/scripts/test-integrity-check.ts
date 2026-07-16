/**
 * Validates manufacturing referential integrity across persisted store slices.
 */
import { createMemoryStorage, ERP_STORAGE_KEYS, readPersistedJson } from '../src/store/persistConfig.ts'
import { mergeBomWithSeed, mergeRoutingWithSeed, mergeWorkCentersWithSeed } from '../src/utils/persistMigration.ts'
import { mergeIntegrityReports, validateManufacturingIntegrity, validateRoutingWorkCenters } from '../src/utils/integrityCheck.ts'
import type { WorkOrder, WorkOrderProductionOperation } from '../src/types/workorder.ts'

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Manufacturing Integrity Check')
  console.log('═══════════════════════════════════════\n')

  const storage = createMemoryStorage({})
  const woSlice = readPersistedJson<{
    workOrders: WorkOrder[]
    productionOperations: WorkOrderProductionOperation[]
  }>(ERP_STORAGE_KEYS.workOrders, storage)

  const bom = mergeBomWithSeed(readPersistedJson(ERP_STORAGE_KEYS.bom, storage))
  const routing = mergeRoutingWithSeed(readPersistedJson(ERP_STORAGE_KEYS.routing, storage))
  const workCenters = mergeWorkCentersWithSeed(readPersistedJson(ERP_STORAGE_KEYS.workCenters, storage))

  check('Seed BOM present', bom.bomHeaders.some((h) => h.id === 'bom-bulker-a'))
  check('Seed routing present', routing.routingHeaders.some((h) => h.id === 'rtg-bulker-a'))
  check('Seed work centers present', workCenters.workCenters.length >= 10)

  const bomHeaderIds = new Set(bom.bomHeaders.map((h) => h.id))
  const routingHeaderIds = new Set(routing.routingHeaders.map((h) => h.id))
  const workCenterIds = new Set(workCenters.workCenters.map((w) => w.id))
  const routingOperationIds = new Set(routing.routingOperations.map((o) => o.id))

  const report = mergeIntegrityReports(
    validateManufacturingIntegrity({
      workOrders: woSlice?.workOrders ?? [],
      bomHeaderIds,
      routingHeaderIds,
      workCenterIds,
      routingOperationIds,
      productionOperations: woSlice?.productionOperations ?? [],
    }),
    {
      ok: true,
      errorCount: 0,
      warningCount: 0,
      issues: validateRoutingWorkCenters(routing.routingOperations, workCenterIds),
      checkedAt: new Date().toISOString(),
    },
  )

  check('Integrity report clean (no persisted WOs)', report.ok, `${report.errorCount} errors`)

  // Simulate orphan WO
  const orphanReport = validateManufacturingIntegrity({
    workOrders: [
      {
        id: 'wo-test',
        woNo: 'WO-TEST',
        bomHeaderId: 'missing-bom',
        routingHeaderId: 'missing-rtg',
      } as WorkOrder,
    ],
    bomHeaderIds,
    routingHeaderIds,
    workCenterIds,
    routingOperationIds,
    productionOperations: [],
  })

  check('Detects orphan BOM reference', orphanReport.issues.some((i) => i.code === 'WO_ORPHAN_BOM'))
  check('Detects orphan routing reference', orphanReport.issues.some((i) => i.code === 'WO_ORPHAN_ROUTING'))

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main()
