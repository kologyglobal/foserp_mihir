import { useBomStore } from '../store/bomStore'
import { useRoutingStore } from '../store/routingStore'
import { useWorkCenterStore } from '../store/workCenterStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import {
  collectReferencedMasterIds,
  repairMastersFromSeed,
} from '../utils/persistMigration'
import {
  mergeIntegrityReports,
  validateManufacturingIntegrity,
  validateRoutingWorkCenters,
  type IntegrityReport,
} from '../utils/integrityCheck'
import { ERP_STORAGE_KEYS, writePersistedJson } from '../store/persistConfig'
import { useInvoiceStore } from '../store/invoiceStore'
import { useMasterStore } from '../store/masterStore'
import { syncCompanyCustomerStatusFromInvoices } from '../utils/companyLabels'

type PersistStore = {
  persist: {
    hasHydrated: () => boolean
    onFinishHydration: (fn: () => void) => () => void
  }
}

const HYDRATION_STORES: PersistStore[] = [
  useWorkCenterStore,
  useBomStore,
  useRoutingStore,
  useWorkOrderStore,
]

export function waitForErpHydration(): Promise<void> {
  return Promise.all(
    HYDRATION_STORES.map(
      (store) =>
        new Promise<void>((resolve) => {
          if (store.persist.hasHydrated()) {
            resolve()
            return
          }
          store.persist.onFinishHydration(() => resolve())
        }),
    ),
  ).then(() => undefined)
}

export function runManufacturingIntegrityCheck(): IntegrityReport {
  const bom = useBomStore.getState()
  const routing = useRoutingStore.getState()
  const wc = useWorkCenterStore.getState()
  const wo = useWorkOrderStore.getState()

  const bomHeaderIds = new Set(bom.bomHeaders.map((h) => h.id))
  const routingHeaderIds = new Set(routing.routingHeaders.map((h) => h.id))
  const workCenterIds = new Set(wc.workCenters.map((w) => w.id))
  const routingOperationIds = new Set(routing.routingOperations.map((o) => o.id))

  const manufacturing = validateManufacturingIntegrity({
    workOrders: wo.workOrders,
    bomHeaderIds,
    routingHeaderIds,
    workCenterIds,
    routingOperationIds,
    productionOperations: wo.productionOperations,
  })

  const routingWc = validateRoutingWorkCenters(routing.routingOperations, workCenterIds)

  return mergeIntegrityReports(manufacturing, {
    ok: routingWc.filter((i) => i.severity === 'error').length === 0,
    errorCount: routingWc.filter((i) => i.severity === 'error').length,
    warningCount: routingWc.filter((i) => i.severity === 'warning').length,
    issues: routingWc,
    checkedAt: new Date().toISOString(),
  })
}

/** Repair missing BOM/routing/work-center rows from seed for IDs referenced by persisted WOs. */
export function repairAndPersistMastersFromSeed(): IntegrityReport {
  const wo = useWorkOrderStore.getState()
  const refs = collectReferencedMasterIds({
    workOrders: wo.workOrders,
    productionOperations: wo.productionOperations,
    routingOperations: useRoutingStore.getState().routingOperations,
  })

  const repaired = repairMastersFromSeed({
    bom: { bomHeaders: useBomStore.getState().bomHeaders, bomLines: useBomStore.getState().bomLines },
    routing: {
      routingHeaders: useRoutingStore.getState().routingHeaders,
      routingOperations: useRoutingStore.getState().routingOperations,
    },
    workCenters: { workCenters: useWorkCenterStore.getState().workCenters },
    referencedBomIds: refs.bomIds,
    referencedRoutingIds: refs.routingIds,
    referencedWorkCenterIds: refs.workCenterIds,
  })

  useBomStore.setState({ bomHeaders: repaired.bom.bomHeaders, bomLines: repaired.bom.bomLines })
  useRoutingStore.setState({
    routingHeaders: repaired.routing.routingHeaders,
    routingOperations: repaired.routing.routingOperations,
  })
  useWorkCenterStore.setState({ workCenters: repaired.workCenters.workCenters })

  writePersistedJson(ERP_STORAGE_KEYS.bom, {
    bomHeaders: repaired.bom.bomHeaders,
    bomLines: repaired.bom.bomLines,
  })
  writePersistedJson(ERP_STORAGE_KEYS.routing, {
    routingHeaders: repaired.routing.routingHeaders,
    routingOperations: repaired.routing.routingOperations,
  })
  writePersistedJson(ERP_STORAGE_KEYS.workCenters, {
    workCenters: repaired.workCenters.workCenters,
  })

  if (
    repaired.repair.bomHeadersAdded +
      repaired.repair.routingHeadersAdded +
      repaired.repair.workCentersAdded >
    0
  ) {
    console.info('[ERP] Repaired master references from seed', repaired.repair)
  }

  return runManufacturingIntegrityCheck()
}

export async function bootstrapErpStartup(): Promise<IntegrityReport> {
  await Promise.race([
    waitForErpHydration(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 8000)
    }),
  ])

  let report: IntegrityReport
  try {
    report = runManufacturingIntegrityCheck()
    if (!report.ok) {
      report = repairAndPersistMastersFromSeed()
    }
  } catch (e) {
    console.error('[ERP] Integrity check failed', e)
    report = {
      ok: false,
      errorCount: 1,
      warningCount: 0,
      issues: [],
      checkedAt: new Date().toISOString(),
    }
  }

  if (!report.ok) {
    console.error('[ERP] Manufacturing integrity check failed', report.issues)
  } else if (report.warningCount > 0) {
    console.warn('[ERP] Manufacturing integrity warnings', report.issues)
  }

  try {
    for (const h of useBomStore.getState().bomHeaders) {
      useBomStore.getState().refreshCosts(h.id)
    }
  } catch (e) {
    console.warn('[ERP] BOM cost refresh skipped', e)
  }

  try {
    syncCompanyCustomerStatusFromInvoices(
      useInvoiceStore.getState().invoices,
      useMasterStore.getState().markCompanyAsCustomer,
    )
  } catch (e) {
    console.warn('[ERP] Company customer status sync skipped', e)
  }

  return report
}

/** Exposed for UI banner */
export type { IntegrityReport }
