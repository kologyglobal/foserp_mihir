import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Customer,
  CustomerContact,
  Item,
  ItemCategory,
  ItemVendorMap,
  Product,
  Transporter,
  Uom,
  Vendor,
  Warehouse,
  Location,
} from '../types/master'
import type { GstGroupCode, GstRate, HsnMaster } from '../types/taxMaster'
import type { PaymentMethod } from '../types/paymentMaster'
import type { VendorOrderAddress } from '../types/orderAddressMaster'
import type { Bank, BankAccount } from '../types/bankMaster'
import type { GeoCity, GeoCountry, GeoState } from '../types/geography'
import {
  seedCategories,
  seedCustomers,
  seedItems,
  seedItemVendorMaps,
  seedProducts,
  seedUoms,
  seedVendors,
  seedWarehouses,
  seedLocations,
} from '../data/masters/seed'
import { seedGstGroups, seedGstRates, seedHsnMasters } from '../data/masters/taxMasterSeed'
import { seedPaymentMethods } from '../data/masters/paymentMethodSeed'
import { seedVendorOrderAddresses } from '../data/masters/orderAddressSeed'
import { seedBanks } from '../data/masters/bankSeed'
import { seedBankAccounts } from '../data/masters/bankAccountSeed'
import {
  seedCustomerContacts,
  seedTransporters,
} from '../data/masters/referenceSeed'
import { seedGeoCities, seedGeoCountries, seedGeoStates } from '../data/masters/geographySeed'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { mergeMastersWithSeed, type MasterPersistSlice } from '../utils/persistMigration'
import { isApiMode } from '../config/apiConfig'
import type { StoreActionResult, StoreAction } from './storeAction'
import type { MaybePromise } from './storeAction'
import { defaultProductMasterFields } from '../utils/productMaster'
import { enrichItemWithDefaults } from '../utils/itemMasterDefaults'
import { stampMasterCreated, stampMasterModified } from '../utils/masterAudit'
import type { MasterAutoStampFields, MasterRecordAudit } from '../types/master'
import { registerMasterStore } from './storeBridge'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function withMasterCreate<T>(data: T, id: string) {
  const stamp = stampMasterCreated()
  return { ...data, id, ...stamp }
}

function withMasterCreateUpdated<T>(data: T, id: string) {
  const stamp = stampMasterCreated()
  return { ...data, id, ...stamp, updatedAt: stamp.createdAt }
}

function withMasterUpdate<T extends MasterRecordAudit>(existing: T, patch: Partial<T>): T {
  return { ...existing, ...patch, ...stampMasterModified(existing) }
}

function withMasterUpdateUpdated<T extends MasterRecordAudit & { updatedAt?: string }>(
  existing: T,
  patch: Partial<T>,
): T {
  return { ...existing, ...patch, ...stampMasterModified(existing), updatedAt: new Date().toISOString() }
}

interface MasterState {
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

  // UOM CRUD
  addUom: (data: Omit<Uom, MasterAutoStampFields | 'updatedAt'>) => MaybePromise<string>
  updateUom: (id: string, data: Partial<Uom>) => MaybePromise<void>
  deleteUom: (id: string) => MaybePromise<void>
  activateUom: (id: string) => MaybePromise<void>
  deactivateUom: (id: string) => MaybePromise<void>
  getUom: (id: string) => Uom | undefined

  // Category CRUD
  addCategory: (data: Omit<ItemCategory, MasterAutoStampFields>) => MaybePromise<string>
  updateCategory: (id: string, data: Partial<ItemCategory>) => MaybePromise<void>
  deleteCategory: (id: string) => MaybePromise<void>
  activateCategory: (id: string) => MaybePromise<void>
  deactivateCategory: (id: string) => MaybePromise<void>
  getCategory: (id: string) => ItemCategory | undefined

  // Item CRUD
  addItem: (data: Omit<Item, MasterAutoStampFields | 'updatedAt'>) => MaybePromise<string>
  updateItem: (id: string, data: Partial<Item>) => MaybePromise<void>
  deleteItem: (id: string) => MaybePromise<void>
  activateItem: (id: string) => MaybePromise<void>
  deactivateItem: (id: string) => MaybePromise<void>
  getItem: (id: string) => Item | undefined

  // Customer CRUD
  addCustomer: (data: Omit<Customer, MasterAutoStampFields | 'isCustomer' | 'firstInvoicedAt'> & Partial<Pick<Customer, 'isCustomer' | 'firstInvoicedAt'>>) => StoreAction<StoreActionResult & { customerId?: string }> | string
  updateCustomer: (id: string, data: Partial<Customer>) => StoreAction<StoreActionResult>
  deleteCustomer: (id: string) => StoreAction<StoreActionResult>
  getCustomer: (id: string) => Customer | undefined
  markCompanyAsCustomer: (id: string, invoicedAt: string) => void

  // Vendor CRUD
  addVendor: (data: Omit<Vendor, MasterAutoStampFields>) => MaybePromise<string>
  updateVendor: (id: string, data: Partial<Vendor>) => MaybePromise<void>
  deleteVendor: (id: string) => MaybePromise<void>
  activateVendor: (id: string) => MaybePromise<void>
  deactivateVendor: (id: string) => MaybePromise<void>
  getVendor: (id: string) => Vendor | undefined

  // Warehouse CRUD
  addWarehouse: (data: Omit<Warehouse, MasterAutoStampFields>) => MaybePromise<string>
  updateWarehouse: (id: string, data: Partial<Warehouse>) => MaybePromise<void>
  deleteWarehouse: (id: string) => MaybePromise<void>
  activateWarehouse: (id: string) => MaybePromise<void>
  deactivateWarehouse: (id: string) => MaybePromise<void>
  getWarehouse: (id: string) => Warehouse | undefined

  // Location CRUD
  addLocation: (data: Omit<Location, MasterAutoStampFields>) => MaybePromise<string>
  updateLocation: (id: string, data: Partial<Location>) => MaybePromise<void>
  deleteLocation: (id: string) => MaybePromise<void>
  activateLocation: (id: string) => MaybePromise<void>
  deactivateLocation: (id: string) => MaybePromise<void>
  getLocation: (id: string) => Location | undefined

  // Product CRUD
  addProduct: (data: Partial<Product> & Pick<Product, 'productCode' | 'productName' | 'fgItemId'>) => MaybePromise<string>
  updateProduct: (id: string, data: Partial<Product>) => MaybePromise<void>
  getProduct: (id: string) => Product | undefined
  getProductByFgItem: (fgItemId: string) => Product | undefined
  getFgItems: () => Item[]
  getFgItemsLinkedToProduct: () => Item[]
  isFgItemLinkedToProduct: (fgItemId: string) => boolean

  // Lookups
  getUomByCode: (code: string) => Uom | undefined
  getCategoryName: (id: string) => string
  getUomName: (id: string) => string
  getWarehouseName: (id: string) => string
  getLocationName: (id: string) => string
  getLocationByCode: (code: string) => Location | undefined
  getItemCountByCategory: (categoryId: string) => number
  getVendorMapsForItem: (itemId: string) => ItemVendorMap[]
  getLeafCategories: () => ItemCategory[]

  // HSN CRUD
  addHsn: (data: Omit<HsnMaster, 'id' | 'createdAt' | 'updatedAt'>) => MaybePromise<string>
  updateHsn: (id: string, data: Partial<HsnMaster>) => MaybePromise<void>
  deleteHsn: (id: string) => MaybePromise<void>
  activateHsn: (id: string) => MaybePromise<void>
  deactivateHsn: (id: string) => MaybePromise<void>
  getHsn: (id: string) => HsnMaster | undefined
  getHsnByCode: (code: string) => HsnMaster | undefined

  // GST Group CRUD
  addGstGroup: (data: Omit<GstGroupCode, 'id' | 'createdAt' | 'updatedAt'>) => MaybePromise<string>
  updateGstGroup: (id: string, data: Partial<GstGroupCode>) => MaybePromise<void>
  deleteGstGroup: (id: string) => MaybePromise<void>
  activateGstGroup: (id: string) => MaybePromise<void>
  deactivateGstGroup: (id: string) => MaybePromise<void>
  getGstGroup: (id: string) => GstGroupCode | undefined
  getGstGroupByCode: (code: string) => GstGroupCode | undefined

  // GST Rate CRUD
  addGstRate: (data: Omit<GstRate, 'id' | 'createdAt' | 'updatedAt'>) => MaybePromise<string>
  updateGstRate: (id: string, data: Partial<GstRate>) => MaybePromise<void>
  deleteGstRate: (id: string) => MaybePromise<void>
  activateGstRate: (id: string) => MaybePromise<void>
  deactivateGstRate: (id: string) => MaybePromise<void>
  getGstRate: (id: string) => GstRate | undefined

  // Payment Method CRUD
  addPaymentMethod: (data: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>) => string
  updatePaymentMethod: (id: string, data: Partial<PaymentMethod>) => void
  getPaymentMethod: (id: string) => PaymentMethod | undefined
  getPaymentMethodByCode: (code: string) => PaymentMethod | undefined

  // Vendor Order Address CRUD
  addVendorOrderAddress: (data: Omit<VendorOrderAddress, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateVendorOrderAddress: (id: string, data: Partial<VendorOrderAddress>) => void
  getVendorOrderAddress: (id: string) => VendorOrderAddress | undefined
  getVendorOrderAddressesForVendor: (vendorId: string) => VendorOrderAddress[]

  // Bank CRUD
  addBank: (data: Omit<Bank, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateBank: (id: string, data: Partial<Bank>) => void
  getBank: (id: string) => Bank | undefined
  getBankByCode: (code: string) => Bank | undefined

  // Bank Account CRUD
  addBankAccount: (data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateBankAccount: (id: string, data: Partial<BankAccount>) => void
  getBankAccount: (id: string) => BankAccount | undefined
  getBankAccountByCode: (code: string) => BankAccount | undefined

  addItemVendorMap: (data: Omit<ItemVendorMap, 'id'>) => string
  getItemVendorMap: (id: string) => ItemVendorMap | undefined

  addCustomerContact: (data: Omit<CustomerContact, 'id' | 'createdAt'>) => string
  updateCustomerContact: (id: string, data: Partial<CustomerContact>) => void
  getCustomerContact: (id: string) => CustomerContact | undefined
  getContactsForCustomer: (customerId: string) => CustomerContact[]

  addTransporter: (data: Omit<Transporter, 'id' | 'createdAt'>) => string
  updateTransporter: (id: string, data: Partial<Transporter>) => void
  getTransporter: (id: string) => Transporter | undefined

  addGeoCountry: (data: Omit<GeoCountry, 'id'>) => MaybePromise<string>
  updateGeoCountry: (id: string, data: Partial<GeoCountry>) => MaybePromise<void>
  deleteGeoCountry: (id: string) => MaybePromise<void>
  activateGeoCountry: (id: string) => MaybePromise<void>
  deactivateGeoCountry: (id: string) => MaybePromise<void>
  getGeoCountry: (id: string) => GeoCountry | undefined
  addGeoState: (data: Omit<GeoState, 'id'>) => MaybePromise<string>
  updateGeoState: (id: string, data: Partial<GeoState>) => MaybePromise<void>
  deleteGeoState: (id: string) => MaybePromise<void>
  activateGeoState: (id: string) => MaybePromise<void>
  deactivateGeoState: (id: string) => MaybePromise<void>
  getGeoState: (id: string) => GeoState | undefined
  addGeoCity: (data: Omit<GeoCity, 'id'>) => MaybePromise<string>
  updateGeoCity: (id: string, data: Partial<GeoCity>) => MaybePromise<void>
  deleteGeoCity: (id: string) => MaybePromise<void>
  activateGeoCity: (id: string) => MaybePromise<void>
  deactivateGeoCity: (id: string) => MaybePromise<void>
  getGeoCity: (id: string) => GeoCity | undefined
  getGeoStateByName: (stateName: string) => GeoState | undefined
  getCitiesByStateName: (stateName: string) => GeoCity[]
  getCitiesByStateId: (stateId: string) => GeoCity[]
}

export const useMasterStore = create<MasterState>()(
  persist(
    (set, get) => ({
  uoms: seedUoms,
  categories: seedCategories,
  items: seedItems,
  customers: seedCustomers,
  vendors: seedVendors,
  itemVendorMaps: seedItemVendorMaps,
  warehouses: seedWarehouses,
  locations: seedLocations,
  products: isApiMode() ? [] : seedProducts,
  customerContacts: seedCustomerContacts,
  transporters: seedTransporters,
  geoCountries: seedGeoCountries,
  geoStates: seedGeoStates,
  geoCities: seedGeoCities,
  hsnMasters: seedHsnMasters,
  gstGroups: seedGstGroups,
  gstRates: seedGstRates,
  paymentMethods: seedPaymentMethods,
  vendorOrderAddresses: seedVendorOrderAddresses,
  banks: seedBanks,
  bankAccounts: seedBankAccounts,

  addUom: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateUom(data))
    const id = genId('uom')
    set((s) => ({
      uoms: [...s.uoms, withMasterCreateUpdated(data, id)],
    }))
    return id
  },
  updateUom: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateUom(id, data))
    set((s) => ({
      uoms: s.uoms.map((u) => (u.id === id ? withMasterUpdateUpdated(u, data) : u)),
    }))
  },
  deleteUom: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeleteUom(id))
    set((s) => ({ uoms: s.uoms.filter((u) => u.id !== id) }))
  },
  activateUom: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiActivateUom(id))
    set((s) => ({ uoms: s.uoms.map((u) => (u.id === id ? { ...u, isActive: true } : u)) }))
  },
  deactivateUom: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeactivateUom(id))
    set((s) => ({ uoms: s.uoms.map((u) => (u.id === id ? { ...u, isActive: false } : u)) }))
  },
  getUom: (id) => get().uoms.find((u) => u.id === id),

  addCategory: (data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiCreateCategory(data))
    const id = genId('cat')
    set((s) => ({
      categories: [...s.categories, withMasterCreate(data, id)],
    }))
    return id
  },
  updateCategory: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiUpdateCategory(id, data))
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? withMasterUpdate(c, data) : c)),
    }))
  },
  deleteCategory: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeleteCategory(id))
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
  },
  activateCategory: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiActivateCategory(id))
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, isActive: true } : c)) }))
  },
  deactivateCategory: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeactivateCategory(id))
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, isActive: false } : c)) }))
  },
  getCategory: (id) => get().categories.find((c) => c.id === id),

  addItem: (data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiCreateItem(data))
    const id = genId('item')
    set((s) => ({
      items: [...s.items, withMasterCreateUpdated(data, id)],
    }))
    return id
  },
  updateItem: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiUpdateItem(id, data))
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? withMasterUpdateUpdated(i, data) : i)),
    }))
  },
  deleteItem: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeleteItem(id))
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },
  activateItem: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiActivateItem(id))
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, isActive: true } : i)) }))
  },
  deactivateItem: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeactivateItem(id))
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, isActive: false } : i)) }))
  },
  getItem: (id) => {
    const item = get().items.find((i) => i.id === id)
    return item ? enrichItemWithDefaults(item) : undefined
  },

  addCustomer: (data) => {
    if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateCompany(data))
    const id = genId('cust')
    set((s) => ({
      customers: [
        ...s.customers,
        {
          ...withMasterCreate(data, id),
          isCustomer: data.isCustomer ?? false,
          firstInvoicedAt: data.firstInvoicedAt ?? null,
        },
      ],
    }))
    void import('../utils/contactSync').then((m) =>
      m.syncCustomerFieldsToPrimaryContact(id, {
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
      }),
    )
    return id
  },
  updateCustomer: (id, data) => {
    if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateCompany(id, data))
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? withMasterUpdate(c, data) : c)),
    }))
    if (
      data.contactPerson !== undefined
      || data.contactPhone !== undefined
      || data.contactEmail !== undefined
    ) {
      const customer = get().getCustomer(id)
      void import('../utils/contactSync').then((m) =>
        m.syncCustomerFieldsToPrimaryContact(id, {
          contactPerson: data.contactPerson ?? customer?.contactPerson,
          contactPhone: data.contactPhone ?? customer?.contactPhone,
          contactEmail: data.contactEmail ?? customer?.contactEmail,
        }),
      )
    }
    return { ok: true }
  },
  deleteCustomer: (id) => {
    if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteCompany(id))
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }))
    return { ok: true }
  },
  getCustomer: (id) => get().customers.find((c) => c.id === id),
  markCompanyAsCustomer: (id, invoicedAt) => {
    const existing = get().getCustomer(id)
    if (!existing || existing.isCustomer) return
    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === id ? { ...c, isCustomer: true, firstInvoicedAt: invoicedAt } : c,
      ),
    }))
  },

  addVendor: (data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiCreateVendor(data))
    const id = genId('vend')
    set((s) => ({
      vendors: [...s.vendors, withMasterCreate(data, id)],
    }))
    return id
  },
  updateVendor: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiUpdateVendor(id, data))
    set((s) => ({
      vendors: s.vendors.map((v) => (v.id === id ? withMasterUpdate(v, data) : v)),
    }))
  },
  deleteVendor: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeleteVendor(id))
    set((s) => ({ vendors: s.vendors.filter((v) => v.id !== id) }))
  },
  activateVendor: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiActivateVendor(id))
    set((s) => ({ vendors: s.vendors.map((v) => (v.id === id ? { ...v, isActive: true } : v)) }))
  },
  deactivateVendor: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeactivateVendor(id))
    set((s) => ({ vendors: s.vendors.map((v) => (v.id === id ? { ...v, isActive: false } : v)) }))
  },
  getVendor: (id) => get().vendors.find((v) => v.id === id),

  addWarehouse: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateWarehouse(data))
    const id = genId('wh')
    set((s) => ({
      warehouses: [...s.warehouses, withMasterCreate(data, id)],
    }))
    return id
  },
  updateWarehouse: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateWarehouse(id, data))
    set((s) => ({
      warehouses: s.warehouses.map((w) => (w.id === id ? withMasterUpdate(w, data) : w)),
    }))
  },
  deleteWarehouse: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeleteWarehouse(id))
    set((s) => ({ warehouses: s.warehouses.filter((w) => w.id !== id) }))
  },
  activateWarehouse: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiActivateWarehouse(id))
    set((s) => ({ warehouses: s.warehouses.map((w) => (w.id === id ? { ...w, isActive: true } : w)) }))
  },
  deactivateWarehouse: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeactivateWarehouse(id))
    set((s) => ({ warehouses: s.warehouses.map((w) => (w.id === id ? { ...w, isActive: false } : w)) }))
  },
  getWarehouse: (id) => get().warehouses.find((w) => w.id === id),

  addLocation: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateLocation(data))
    const id = genId('loc')
    set((s) => {
      const clearDefault = data.isDefault
        ? s.locations.map((l) => (l.isDefault ? { ...l, isDefault: false } : l))
        : s.locations
      return {
        locations: [...clearDefault, withMasterCreate(data, id)],
      }
    })
    return id
  },
  updateLocation: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateLocation(id, data))
    set((s) => {
      const clearDefault = data.isDefault
        ? s.locations.map((l) => (l.id !== id && l.isDefault ? { ...l, isDefault: false } : l))
        : s.locations
      return {
        locations: clearDefault.map((l) => (l.id === id ? withMasterUpdate(l, data) : l)),
      }
    })
  },
  deleteLocation: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeleteLocation(id))
    set((s) => ({ locations: s.locations.filter((l) => l.id !== id) }))
  },
  activateLocation: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiActivateLocation(id))
    set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, isActive: true } : l)) }))
  },
  deactivateLocation: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeactivateLocation(id))
    set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, isActive: false } : l)) }))
  },
  getLocation: (id) => get().locations.find((l) => l.id === id),

  addProduct: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateProduct(data))
    const id = genId('prod')
    const ts = new Date().toISOString()
    const product = { ...defaultProductMasterFields(), ...data, id, createdAt: ts, updatedAt: ts } as Product
    set((s) => ({
      products: [...s.products, product],
    }))
    return id
  },
  updateProduct: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateProduct(id, data))
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p,
      ),
    }))
  },
  getProduct: (id) => get().products.find((p) => p.id === id),
  getProductByFgItem: (fgItemId) => get().products.find((p) => p.fgItemId === fgItemId),
  getFgItems: () => get().items.filter((i) => i.itemType === 'finished_good'),
  getFgItemsLinkedToProduct: () => {
    const linkedIds = new Set(get().products.map((p) => p.fgItemId))
    return get().items.filter((i) => i.itemType === 'finished_good' && linkedIds.has(i.id))
  },
  isFgItemLinkedToProduct: (fgItemId) => get().products.some((p) => p.fgItemId === fgItemId),

  getUomByCode: (code) => get().uoms.find((u) => u.uomCode === code),
  getCategoryName: (id) => get().categories.find((c) => c.id === id)?.categoryName ?? '—',
  getUomName: (id) => {
    const u = get().uoms.find((u) => u.id === id)
    return u ? `${u.uomCode} (${u.uomName})` : '—'
  },
  getWarehouseName: (id) =>
    get().warehouses.find((w) => w.id === id)?.warehouseName ?? '—',
  getLocationName: (id) => {
    const loc = get().locations.find((l) => l.id === id)
    return loc ? `${loc.locationCode} — ${loc.locationName}` : '—'
  },
  getLocationByCode: (code) => get().locations.find((l) => l.locationCode === code),
  getItemCountByCategory: (categoryId) =>
    get().items.filter((i) => i.categoryId === categoryId).length,
  getVendorMapsForItem: (itemId) =>
    get().itemVendorMaps.filter((m) => m.itemId === itemId),
  getLeafCategories: () => {
    const cats = get().categories
    return cats.filter((c) => !cats.some((child) => child.parentId === c.id))
  },

  addHsn: (data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiCreateHsn(data))
    const id = genId('hsn')
    set((s) => ({ hsnMasters: [...s.hsnMasters, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updateHsn: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiUpdateHsn(id, data))
    set((s) => ({
      hsnMasters: s.hsnMasters.map((h) => (h.id === id ? withMasterUpdateUpdated(h, data) : h)),
    }))
  },
  deleteHsn: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeleteHsn(id))
    set((s) => ({ hsnMasters: s.hsnMasters.filter((h) => h.id !== id) }))
  },
  activateHsn: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiActivateHsn(id))
    set((s) => ({ hsnMasters: s.hsnMasters.map((h) => (h.id === id ? { ...h, isActive: true } : h)) }))
  },
  deactivateHsn: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeactivateHsn(id))
    set((s) => ({ hsnMasters: s.hsnMasters.map((h) => (h.id === id ? { ...h, isActive: false } : h)) }))
  },
  getHsn: (id) => get().hsnMasters.find((h) => h.id === id),
  getHsnByCode: (code) => get().hsnMasters.find((h) => h.code === code),

  addGstGroup: (data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiCreateGstGroup(data))
    const id = genId('gstg')
    set((s) => ({ gstGroups: [...s.gstGroups, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updateGstGroup: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiUpdateGstGroup(id, data))
    set((s) => ({
      gstGroups: s.gstGroups.map((g) => (g.id === id ? withMasterUpdateUpdated(g, data) : g)),
    }))
  },
  deleteGstGroup: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeleteGstGroup(id))
    set((s) => ({ gstGroups: s.gstGroups.filter((g) => g.id !== id) }))
  },
  activateGstGroup: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiActivateGstGroup(id))
    set((s) => ({ gstGroups: s.gstGroups.map((g) => (g.id === id ? { ...g, isActive: true } : g)) }))
  },
  deactivateGstGroup: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeactivateGstGroup(id))
    set((s) => ({ gstGroups: s.gstGroups.map((g) => (g.id === id ? { ...g, isActive: false } : g)) }))
  },
  getGstGroup: (id) => get().gstGroups.find((g) => g.id === id),
  getGstGroupByCode: (code) => get().gstGroups.find((g) => g.code === code),

  addGstRate: (data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiCreateGstRate(data))
    const id = genId('gstr')
    set((s) => ({ gstRates: [...s.gstRates, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updateGstRate: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiUpdateGstRate(id, data))
    set((s) => ({
      gstRates: s.gstRates.map((r) => (r.id === id ? withMasterUpdateUpdated(r, data) : r)),
    }))
  },
  deleteGstRate: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeleteGstRate(id))
    set((s) => ({ gstRates: s.gstRates.filter((r) => r.id !== id) }))
  },
  activateGstRate: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiActivateGstRate(id))
    set((s) => ({ gstRates: s.gstRates.map((r) => (r.id === id ? { ...r, isActive: true } : r)) }))
  },
  deactivateGstRate: (id) => {
    if (isApiMode()) return import('../services/bridges/masterBatchApiBridge').then((m) => m.apiDeactivateGstRate(id))
    set((s) => ({ gstRates: s.gstRates.map((r) => (r.id === id ? { ...r, isActive: false } : r)) }))
  },
  getGstRate: (id) => get().gstRates.find((r) => r.id === id),

  addPaymentMethod: (data) => {
    const id = genId('pay')
    set((s) => ({ paymentMethods: [...s.paymentMethods, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updatePaymentMethod: (id, data) =>
    set((s) => ({
      paymentMethods: s.paymentMethods.map((p) => (p.id === id ? withMasterUpdateUpdated(p, data) : p)),
    })),
  getPaymentMethod: (id) => get().paymentMethods.find((p) => p.id === id),
  getPaymentMethodByCode: (code) => get().paymentMethods.find((p) => p.code === code),

  addVendorOrderAddress: (data) => {
    const id = genId('voa')
    set((s) => ({ vendorOrderAddresses: [...s.vendorOrderAddresses, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updateVendorOrderAddress: (id, data) =>
    set((s) => ({
      vendorOrderAddresses: s.vendorOrderAddresses.map((a) => (a.id === id ? withMasterUpdateUpdated(a, data) : a)),
    })),
  getVendorOrderAddress: (id) => get().vendorOrderAddresses.find((a) => a.id === id),
  getVendorOrderAddressesForVendor: (vendorId) =>
    get().vendorOrderAddresses.filter((a) => a.vendorId === vendorId && a.isActive),

  addBank: (data) => {
    const id = genId('bank')
    set((s) => ({ banks: [...s.banks, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updateBank: (id, data) =>
    set((s) => ({
      banks: s.banks.map((b) => (b.id === id ? withMasterUpdateUpdated(b, data) : b)),
    })),
  getBank: (id) => get().banks.find((b) => b.id === id),
  getBankByCode: (code) => get().banks.find((b) => b.code === code),

  addBankAccount: (data) => {
    const id = genId('ba')
    set((s) => ({ bankAccounts: [...s.bankAccounts, withMasterCreateUpdated(data, id)] }))
    return id
  },
  updateBankAccount: (id, data) =>
    set((s) => ({
      bankAccounts: s.bankAccounts.map((a) => (a.id === id ? withMasterUpdateUpdated(a, data) : a)),
    })),
  getBankAccount: (id) => get().bankAccounts.find((a) => a.id === id),
  getBankAccountByCode: (code) => get().bankAccounts.find((a) => a.code === code),

  addItemVendorMap: (data) => {
    const id = genId('ivm')
    set((s) => ({
      itemVendorMaps: [...s.itemVendorMaps, { ...data, id }],
    }))
    return id
  },
  getItemVendorMap: (id) => get().itemVendorMaps.find((m) => m.id === id),

  addCustomerContact: (data) => {
    const id = genId('cct')
    set((s) => ({
      customerContacts: [...s.customerContacts, withMasterCreate(data, id)],
    }))
    return id
  },
  updateCustomerContact: (id, data) =>
    set((s) => ({
      customerContacts: s.customerContacts.map((c) => (c.id === id ? withMasterUpdate(c, data) : c)),
    })),
  getCustomerContact: (id) => get().customerContacts.find((c) => c.id === id),
  getContactsForCustomer: (customerId) =>
    get().customerContacts.filter((c) => c.customerId === customerId && c.isActive),

  addTransporter: (data) => {
    const id = genId('trans')
    set((s) => ({
      transporters: [...s.transporters, withMasterCreate(data, id)],
    }))
    return id
  },
  updateTransporter: (id, data) =>
    set((s) => ({
      transporters: s.transporters.map((t) => (t.id === id ? withMasterUpdate(t, data) : t)),
    })),
  getTransporter: (id) => get().transporters.find((t) => t.id === id),

  getGeoStateByName: (stateName) => get().geoStates.find((s) => s.stateName === stateName),
  getCitiesByStateName: (stateName) => {
    const st = get().geoStates.find((s) => s.stateName === stateName)
    if (!st) return []
    return get().geoCities.filter((c) => c.stateId === st.id && c.isActive)
  },
  getCitiesByStateId: (stateId) =>
    get().geoCities.filter((c) => c.stateId === stateId && c.isActive),
  addGeoCountry: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateCountry(data))
    const id = genId('geo-cn')
    set((s) => ({ geoCountries: [...s.geoCountries, { ...data, id }] }))
    return id
  },
  updateGeoCountry: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateCountry(id, data))
    set((s) => ({
      geoCountries: s.geoCountries.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }))
  },
  deleteGeoCountry: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeleteCountry(id))
    set((s) => ({ geoCountries: s.geoCountries.filter((c) => c.id !== id) }))
  },
  activateGeoCountry: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiActivateCountry(id))
    set((s) => ({ geoCountries: s.geoCountries.map((c) => (c.id === id ? { ...c, isActive: true } : c)) }))
  },
  deactivateGeoCountry: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeactivateCountry(id))
    set((s) => ({ geoCountries: s.geoCountries.map((c) => (c.id === id ? { ...c, isActive: false } : c)) }))
  },
  getGeoCountry: (id) => get().geoCountries.find((c) => c.id === id),
  addGeoState: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateState(data))
    const id = genId('geo-st')
    set((s) => ({ geoStates: [...s.geoStates, { ...data, id }] }))
    return id
  },
  updateGeoState: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateState(id, data))
    set((s) => ({
      geoStates: s.geoStates.map((st) => (st.id === id ? { ...st, ...data } : st)),
    }))
  },
  deleteGeoState: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeleteState(id))
    set((s) => ({ geoStates: s.geoStates.filter((st) => st.id !== id) }))
  },
  activateGeoState: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiActivateState(id))
    set((s) => ({ geoStates: s.geoStates.map((st) => (st.id === id ? { ...st, isActive: true } : st)) }))
  },
  deactivateGeoState: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeactivateState(id))
    set((s) => ({ geoStates: s.geoStates.map((st) => (st.id === id ? { ...st, isActive: false } : st)) }))
  },
  getGeoState: (id) => get().geoStates.find((s) => s.id === id),
  addGeoCity: (data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiCreateCity(data))
    const id = genId('geo-ct')
    set((s) => ({ geoCities: [...s.geoCities, { ...data, id }] }))
    return id
  },
  updateGeoCity: (id, data) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiUpdateCity(id, data))
    set((s) => ({
      geoCities: s.geoCities.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }))
  },
  deleteGeoCity: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeleteCity(id))
    set((s) => ({ geoCities: s.geoCities.filter((c) => c.id !== id) }))
  },
  activateGeoCity: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiActivateCity(id))
    set((s) => ({ geoCities: s.geoCities.map((c) => (c.id === id ? { ...c, isActive: true } : c)) }))
  },
  deactivateGeoCity: (id) => {
    if (isApiMode()) return import('../services/bridges/masterApiBridge').then((m) => m.apiDeactivateCity(id))
    set((s) => ({ geoCities: s.geoCities.map((c) => (c.id === id ? { ...c, isActive: false } : c)) }))
  },
  getGeoCity: (id) => get().geoCities.find((c) => c.id === id),
    }),
    {
      name: ERP_STORAGE_KEYS.masters,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        uoms: isApiMode() ? [] : s.uoms,
        categories: isApiMode() ? [] : s.categories,
        items: isApiMode() ? [] : s.items,
        customers: isApiMode() ? [] : s.customers,
        vendors: isApiMode() ? [] : s.vendors,
        itemVendorMaps: s.itemVendorMaps,
        warehouses: isApiMode() ? [] : s.warehouses,
        locations: isApiMode() ? [] : s.locations,
        products: isApiMode() ? [] : s.products,
        customerContacts: isApiMode() ? [] : s.customerContacts,
        transporters: isApiMode() ? [] : s.transporters,
        geoCountries: isApiMode() ? [] : s.geoCountries,
        geoStates: isApiMode() ? [] : s.geoStates,
        geoCities: isApiMode() ? [] : s.geoCities,
        hsnMasters: isApiMode() ? [] : s.hsnMasters,
        gstGroups: isApiMode() ? [] : s.gstGroups,
        gstRates: isApiMode() ? [] : s.gstRates,
        paymentMethods: s.paymentMethods,
        vendorOrderAddresses: s.vendorOrderAddresses,
        banks: s.banks,
        bankAccounts: s.bankAccounts,
      }),
      merge: (persisted, current) => {
        if (isApiMode()) {
          const p = persisted as Partial<MasterState> | undefined
          return {
            ...current,
            ...p,
            customers: current.customers ?? [],
            uoms: current.uoms ?? [],
            warehouses: current.warehouses ?? [],
            locations: current.locations ?? [],
            geoCountries: current.geoCountries ?? [],
            geoStates: current.geoStates ?? [],
            geoCities: current.geoCities ?? [],
            categories: current.categories ?? [],
            items: current.items ?? [],
            vendors: current.vendors ?? [],
            hsnMasters: current.hsnMasters ?? [],
            gstGroups: current.gstGroups ?? [],
            gstRates: current.gstRates ?? [],
            products: [],
            customerContacts: [],
            transporters: [],
            paymentMethods: [],
            vendorOrderAddresses: [],
            banks: [],
            bankAccounts: [],
            itemVendorMaps: [],
          }
        }
        const merged = mergeMastersWithSeed(persisted as Partial<MasterPersistSlice> | undefined)
        return { ...current, ...merged }
      },
    },
  ),
)

registerMasterStore(() => useMasterStore.getState())
