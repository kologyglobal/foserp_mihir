import type { BomHeader, BomLine } from '../types/bom'
import type { RoutingHeader, RoutingOperation } from '../types/routing'
import type { WorkCenter } from '../types/workcenter'
import type { QcChecklistItem } from '../types/qc'
import type {
  Customer,
  CustomerContact,
  GstGroupCode,
  GstRate,
  HsnMaster,
  Item,
  ItemCategory,
  ItemVendorMap,
  Location,
  Product,
  Transporter,
  Uom,
  Vendor,
  Warehouse,
} from '../types/master'
import type { GeoCountry, GeoState, GeoCity } from '../types/geography'
import type { PaymentMethod } from '../types/paymentMaster'
import type { VendorOrderAddress } from '../types/orderAddressMaster'
import type { Bank, BankAccount } from '../types/bankMaster'
import { seedBomHeaders, seedBomLines } from '../data/bom/seed'
import { seedRoutingHeaders, seedRoutingOperations } from '../data/routing/seed'
import { seedWorkCenters } from '../data/routing/seedWorkCenters'
import {
  seedCategories,
  seedCustomers,
  seedItems,
  seedItemVendorMaps,
  seedLocations,
  seedProducts,
  seedUoms,
  seedVendors,
  seedWarehouses,
} from '../data/masters/seed'
import { seedCustomerContacts, seedTransporters } from '../data/masters/referenceSeed'
import { seedGeoCountries, seedGeoStates, seedGeoCities } from '../data/masters/geographySeed'
import { seedHsnMasters, seedGstGroups, seedGstRates } from '../data/masters/taxMasterSeed'
import { seedPaymentMethods } from '../data/masters/paymentMethodSeed'
import { seedVendorOrderAddresses } from '../data/masters/orderAddressSeed'
import { seedBanks } from '../data/masters/bankSeed'
import { seedBankAccounts } from '../data/masters/bankAccountSeed'
import { getDefaultQcChecklist } from '../data/routing/qcChecklists'
import { migrateProductMaster } from './productMaster'
import { migrateCustomerRecord } from './companyLabels'
import { mergeMasterAuditArrays } from './masterAudit'

export interface BomPersistSlice {
  bomHeaders: BomHeader[]
  bomLines: BomLine[]
}

export interface RoutingPersistSlice {
  routingHeaders: RoutingHeader[]
  routingOperations: RoutingOperation[]
}

export interface WorkCenterPersistSlice {
  workCenters: WorkCenter[]
}

export interface MasterPersistSlice {
  uoms: Uom[]
  categories: ItemCategory[]
  items: Item[]
  customers: Customer[]
  vendors: Vendor[]
  itemVendorMaps: ItemVendorMap[]
  warehouses: Warehouse[]
  locations: Location[]
  products: Product[]
  customerContacts: CustomerContact[]
  transporters: Transporter[]
  geoCountries: GeoCountry[]
  geoStates: GeoState[]
  geoCities: GeoCity[]
  hsnMasters: HsnMaster[]
  gstGroups: GstGroupCode[]
  gstRates: GstRate[]
  paymentMethods: PaymentMethod[]
  vendorOrderAddresses: VendorOrderAddress[]
  banks: Bank[]
  bankAccounts: BankAccount[]
}

function mergeEntityById<T extends { id: string }>(seed: T[], persisted: T[] | undefined): T[] {
  const map = new Map<string, T>()
  for (const row of seed) map.set(row.id, clone(row))
  for (const row of persisted ?? []) map.set(row.id, clone(row))
  return [...map.values()]
}

function mergeProductsWithSeed(seed: Product[], persisted: Product[] | undefined): Product[] {
  const seedMap = new Map(seed.map((p) => [p.id, clone(p)]))
  const map = new Map<string, Product>()
  for (const p of seed) map.set(p.id, clone(p))
  for (const row of persisted ?? []) {
    const seedRow = seedMap.get(row.id)
    map.set(row.id, migrateProductMaster({ ...seedRow, ...clone(row) } as Record<string, unknown>, seedRow))
  }
  return [...map.values()]
}

/** Merge persisted master rows with seed — seed fills gaps, persisted wins on ID conflict. */
export function mergeMastersWithSeed(
  persisted: Partial<MasterPersistSlice> | null | undefined,
): MasterPersistSlice {
  return {
    uoms: mergeMasterAuditArrays(mergeEntityById(seedUoms, persisted?.uoms)),
    categories: mergeMasterAuditArrays(mergeEntityById(seedCategories, persisted?.categories)),
    items: mergeMasterAuditArrays(mergeEntityById(seedItems, persisted?.items)),
    customers: mergeMasterAuditArrays(mergeEntityById(seedCustomers, persisted?.customers).map(migrateCustomerRecord)),
    vendors: mergeMasterAuditArrays(mergeEntityById(seedVendors, persisted?.vendors)),
    itemVendorMaps: mergeEntityById(seedItemVendorMaps, persisted?.itemVendorMaps),
    warehouses: mergeMasterAuditArrays(mergeEntityById(seedWarehouses, persisted?.warehouses)),
    locations: mergeMasterAuditArrays(mergeEntityById(seedLocations, persisted?.locations)),
    products: mergeProductsWithSeed(seedProducts, persisted?.products),
    customerContacts: mergeMasterAuditArrays(mergeEntityById(seedCustomerContacts, persisted?.customerContacts)),
    transporters: mergeMasterAuditArrays(mergeEntityById(seedTransporters, persisted?.transporters)),
    geoCountries: mergeEntityById(seedGeoCountries, persisted?.geoCountries),
    geoStates: mergeEntityById(seedGeoStates, persisted?.geoStates),
    geoCities: mergeEntityById(seedGeoCities, persisted?.geoCities),
    hsnMasters: mergeMasterAuditArrays(mergeEntityById(seedHsnMasters, persisted?.hsnMasters)),
    gstGroups: mergeMasterAuditArrays(mergeEntityById(seedGstGroups, persisted?.gstGroups)),
    gstRates: mergeMasterAuditArrays(mergeEntityById(seedGstRates, persisted?.gstRates)),
    paymentMethods: mergeMasterAuditArrays(mergeEntityById(seedPaymentMethods, persisted?.paymentMethods)),
    vendorOrderAddresses: mergeMasterAuditArrays(mergeEntityById(seedVendorOrderAddresses, persisted?.vendorOrderAddresses)),
    banks: mergeMasterAuditArrays(mergeEntityById(seedBanks, persisted?.banks)),
    bankAccounts: mergeMasterAuditArrays(mergeEntityById(seedBankAccounts, persisted?.bankAccounts)),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Merge persisted rows with seed — seed fills gaps, persisted wins on ID conflict. */
export function mergeBomWithSeed(persisted: Partial<BomPersistSlice> | null | undefined): BomPersistSlice {
  const headers = new Map<string, BomHeader>()
  const lines: BomLine[] = []

  for (const h of seedBomHeaders) headers.set(h.id, clone(h))
  for (const h of persisted?.bomHeaders ?? []) headers.set(h.id, clone(h))

  const lineIds = new Set<string>()
  for (const l of seedBomLines) {
    lines.push(clone(l))
    lineIds.add(l.id)
  }
  for (const l of persisted?.bomLines ?? []) {
    if (!lineIds.has(l.id)) {
      lines.push(clone(l))
      lineIds.add(l.id)
    }
  }

  return { bomHeaders: [...headers.values()], bomLines: lines }
}

export function mergeRoutingWithSeed(
  persisted: Partial<RoutingPersistSlice> | null | undefined,
): RoutingPersistSlice {
  const headers = new Map<string, RoutingHeader>()
  for (const h of seedRoutingHeaders) headers.set(h.id, clone(h))
  for (const h of persisted?.routingHeaders ?? []) headers.set(h.id, clone(h))

  const ops = new Map<string, RoutingOperation>()
  for (const o of seedRoutingOperations) ops.set(o.id, migrateRoutingOperation(o))
  for (const o of persisted?.routingOperations ?? []) ops.set(o.id, migrateRoutingOperation(o))

  return {
    routingHeaders: [...headers.values()],
    routingOperations: [...ops.values()],
  }
}

export function mergeWorkCentersWithSeed(
  persisted: Partial<WorkCenterPersistSlice> | null | undefined,
): WorkCenterPersistSlice {
  const seedMap = new Map(seedWorkCenters.map((w) => [w.id, clone(w)]))
  const map = new Map<string, WorkCenter>()
  for (const w of seedWorkCenters) map.set(w.id, clone(w))
  for (const w of persisted?.workCenters ?? []) {
    const seed = seedMap.get(w.id)
    map.set(w.id, {
      ...clone(w),
      inputWarehouseCode: w.inputWarehouseCode ?? seed?.inputWarehouseCode ?? null,
      wipWarehouseCode: w.wipWarehouseCode ?? seed?.wipWarehouseCode ?? null,
      outputWarehouseCode: w.outputWarehouseCode ?? seed?.outputWarehouseCode ?? null,
    })
  }
  return { workCenters: [...map.values()] }
}

export function migrateRoutingOperation(op: RoutingOperation): RoutingOperation {
  const checklist: QcChecklistItem[] =
    op.qcChecklist ??
    (op.qcRequired ? getDefaultQcChecklist(op.operationName) : [])
  return { ...op, qcChecklist: checklist }
}

export interface RepairResult {
  bomHeadersAdded: number
  bomLinesAdded: number
  routingHeadersAdded: number
  routingOperationsAdded: number
  workCentersAdded: number
}

/** Restore seed master rows referenced by IDs but missing from persisted slices. */
export function repairMastersFromSeed(input: {
  bom: BomPersistSlice
  routing: RoutingPersistSlice
  workCenters: WorkCenterPersistSlice
  referencedBomIds: string[]
  referencedRoutingIds: string[]
  referencedWorkCenterIds: string[]
}): { bom: BomPersistSlice; routing: RoutingPersistSlice; workCenters: WorkCenterPersistSlice; repair: RepairResult } {
  const repair: RepairResult = {
    bomHeadersAdded: 0,
    bomLinesAdded: 0,
    routingHeadersAdded: 0,
    routingOperationsAdded: 0,
    workCentersAdded: 0,
  }

  const bomHeaderIds = new Set(input.bom.bomHeaders.map((h) => h.id))
  const bomLineIds = new Set(input.bom.bomLines.map((l) => l.id))
  const routingHeaderIds = new Set(input.routing.routingHeaders.map((h) => h.id))
  const routingOpIds = new Set(input.routing.routingOperations.map((o) => o.id))
  const wcIds = new Set(input.workCenters.workCenters.map((w) => w.id))

  const bom = { bomHeaders: [...input.bom.bomHeaders], bomLines: [...input.bom.bomLines] }
  const routing = {
    routingHeaders: [...input.routing.routingHeaders],
    routingOperations: [...input.routing.routingOperations],
  }
  const workCenters = { workCenters: [...input.workCenters.workCenters] }

  for (const id of input.referencedBomIds) {
    if (bomHeaderIds.has(id)) continue
    const seedHeader = seedBomHeaders.find((h) => h.id === id)
    if (!seedHeader) continue
    bom.bomHeaders.push(clone(seedHeader))
    bomHeaderIds.add(id)
    repair.bomHeadersAdded += 1
    for (const line of seedBomLines.filter((l) => l.bomHeaderId === id)) {
      if (!bomLineIds.has(line.id)) {
        bom.bomLines.push(clone(line))
        bomLineIds.add(line.id)
        repair.bomLinesAdded += 1
      }
    }
  }

  for (const id of input.referencedRoutingIds) {
    if (routingHeaderIds.has(id)) continue
    const seedHeader = seedRoutingHeaders.find((h) => h.id === id)
    if (!seedHeader) continue
    routing.routingHeaders.push(clone(seedHeader))
    routingHeaderIds.add(id)
    repair.routingHeadersAdded += 1
    for (const op of seedRoutingOperations.filter((o) => o.routingHeaderId === id)) {
      if (!routingOpIds.has(op.id)) {
        routing.routingOperations.push(migrateRoutingOperation(clone(op)))
        routingOpIds.add(op.id)
        repair.routingOperationsAdded += 1
      }
    }
  }

  for (const id of input.referencedWorkCenterIds) {
    if (wcIds.has(id)) continue
    const seedWc = seedWorkCenters.find((w) => w.id === id)
    if (!seedWc) continue
    workCenters.workCenters.push(clone(seedWc))
    wcIds.add(id)
    repair.workCentersAdded += 1
  }

  return { bom, routing, workCenters, repair }
}

export function collectReferencedMasterIds(input: {
  workOrders: Array<{ bomHeaderId: string; routingHeaderId: string | null }>
  productionOperations: Array<{ workCenterId: string; routingOperationId: string }>
  routingOperations: RoutingOperation[]
}): {
  bomIds: string[]
  routingIds: string[]
  workCenterIds: string[]
} {
  const bomIds = new Set<string>()
  const routingIds = new Set<string>()
  const workCenterIds = new Set<string>()

  for (const wo of input.workOrders) {
    if (wo.bomHeaderId) bomIds.add(wo.bomHeaderId)
    if (wo.routingHeaderId) routingIds.add(wo.routingHeaderId)
  }

  for (const op of input.productionOperations) {
    workCenterIds.add(op.workCenterId)
  }

  for (const id of routingIds) {
    for (const op of input.routingOperations.filter((o) => o.routingHeaderId === id)) {
      workCenterIds.add(op.workCenterId)
    }
  }

  return {
    bomIds: [...bomIds],
    routingIds: [...routingIds],
    workCenterIds: [...workCenterIds],
  }
}
