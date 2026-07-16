import type {
  EngineeringProductType,
  InventoryPostingType,
  ItemCodeSeriesMode,
} from './taxMaster'

export type {
  EngineeringProductType,
  GstGoodsType,
  GstGroupCode,
  GstRate,
  HsnMaster,
  InventoryPostingType,
  ItemCodeSeriesMode,
} from './taxMaster'

export {
  ENGINEERING_PRODUCT_TYPE_LABELS,
  GST_GOODS_TYPE_LABELS,
  INVENTORY_POSTING_TYPE_LABELS,
  QUALITY_TEST_GROUP_OPTIONS,
} from './taxMaster'

export type UomType = 'integer' | 'weight' | 'length' | 'volume'
export type ItemType = 'raw' | 'bought_out' | 'consumable' | 'sub_assembly' | 'finished_good'
/** Sub-assembly planning rule — applies when itemType = sub_assembly */
export type SubAssemblyRule = 'phantom' | 'manufactured' | 'purchased' | 'subcontracted'
export type CustomerType = 'corporate' | 'dealer' | 'government'
export type VendorType = 'manufacturer' | 'trader' | 'service'

/** GST vendor classification — BC India localization */
export type GstVendorType = 'registered' | 'composite' | 'unregistered' | 'import' | 'exempted' | 'sez'

export type PanStatus = 'pan_applied' | 'pan_not_available'

export const GST_VENDOR_TYPE_LABELS: Record<GstVendorType, string> = {
  registered: 'Registered',
  composite: 'Composite',
  unregistered: 'Unregistered',
  import: 'Import',
  exempted: 'Exempted',
  sez: 'Sez',
}

export const PAN_STATUS_LABELS: Record<PanStatus, string> = {
  pan_applied: 'PAN APPLIED',
  pan_not_available: 'PANNOTAVBL',
}

export const VENDOR_PAYMENT_METHODS = [
  'Bank Transfer',
  'NEFT',
  'RTGS',
  'Cheque',
  'Cash',
  'UPI',
] as const

export type VendorPaymentMethod = (typeof VENDOR_PAYMENT_METHODS)[number]
export type WarehouseType = 'main' | 'sub' | 'wip' | 'fg' | 'quarantine'
export type ProductType =
  | 'bulker'
  | 'iso_tank'
  | 'side_wall'
  | 'tank'
  | 'semi_trailer'
  | 'trailer'
  | 'process_equipment'
  | 'body_building'

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  bulker: 'Bulker',
  iso_tank: 'ISO Tank',
  side_wall: 'Side Wall',
  tank: 'Tank',
  semi_trailer: 'Semi Trailer',
  trailer: 'Trailer',
  process_equipment: 'Process Equipment',
  body_building: 'Body Building',
}

/** GST registration category for a location / branch */
export type LocationRegisteredType =
  | 'regular_taxpayer'
  | 'composition_scheme'
  | 'sez_unit'
  | 'unregistered'
  | 'casual_taxable'

export const LOCATION_REGISTERED_TYPE_LABELS: Record<LocationRegisteredType, string> = {
  regular_taxpayer: 'Regular Taxpayer',
  composition_scheme: 'Composition Scheme',
  sez_unit: 'SEZ Unit',
  unregistered: 'Unregistered',
  casual_taxable: 'Casual Taxable Person',
}

/** BC-style inventory location — used on sales, purchase, production & stock documents */
export interface Location extends MasterRecordAudit {
  id: string
  /** BC Location Code (max 10) */
  locationCode: string
  locationName: string
  name2?: string
  /** Linked warehouse for stock ledger posting */
  warehouseId: string | null
  address: string
  address2?: string
  city: string
  state: string
  postCode: string
  country: string
  contactName: string
  phone: string
  email: string
  /** Tax registration — PAN (10 chars) */
  pan?: string
  /** GST registration category */
  registeredType?: LocationRegisteredType
  /** GST identification number (15 chars) */
  gstin?: string
  /** Legacy TIN / VAT registration number */
  tin?: string
  /** BC: Use As In-Transit */
  useAsInTransit: boolean
  requireShipment: boolean
  requireReceive: boolean
  allowSales: boolean
  allowPurchase: boolean
  allowProduction: boolean
  /** Default location for new documents */
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

export type {
  ProductAttachment,
  ProductChangeLogEntry,
  ProductFamily,
  ProductManufacturingControl,
  ProductQualityControl,
  ProductRevisionRecord,
  ProductSalesControl,
  ProductStandardCost,
  ProductStatus,
} from './productMaster'

export {
  PRODUCT_FAMILY_LABELS,
  PRODUCT_STATUS_FLOW,
  PRODUCT_STATUS_LABELS,
} from './productMaster'
export type SalesTerritory = 'West' | 'North' | 'South' | 'East'

/** Who/when audit columns on master registers */
export interface MasterRecordAudit {
  createdById?: string
  createdByName?: string
  modifiedById?: string | null
  modifiedByName?: string | null
  modifiedAt?: string | null
}

/** Fields auto-stamped by masterStore on create/update */
export type MasterAutoStampFields =
  | 'id'
  | 'createdAt'
  | 'createdById'
  | 'createdByName'
  | 'modifiedById'
  | 'modifiedByName'
  | 'modifiedAt'

export interface Uom extends MasterRecordAudit {
  id: string
  uomCode: string
  uomName: string
  /** Display description — defaults to uomName when empty */
  description?: string
  uomType: UomType
  decimalPlaces: number
  isBaseUnit?: boolean
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface ItemCategory extends MasterRecordAudit {
  id: string
  categoryCode: string
  categoryName: string
  parentId: string | null
  level: number
  defaultWarehouseId: string | null
  isActive: boolean
  createdAt: string
}

export interface Item extends MasterRecordAudit {
  id: string
  itemCode: string
  itemName: string
  itemName2?: string
  itemDescription: string
  categoryId: string
  baseUomId: string
  itemType: ItemType
  /** Engineering product type (BC-style) */
  productType?: EngineeringProductType
  /** Inventory posting type */
  inventoryType?: InventoryPostingType
  codeSeriesMode?: ItemCodeSeriesMode
  materialGrade: string
  hsnCode: string
  hsnId?: string | null
  gstGroupId?: string | null
  reorderLevel: number
  reorderQty: number
  standardRate: number
  isPurchasable: boolean
  isStockable: boolean
  isBlocked?: boolean
  isActive: boolean
  quantityPerUom?: number
  purchaseUomId?: string | null
  purchaseQtyPerUom?: number
  /** Read-only inventory snapshot fields */
  inventoryQty?: number
  qtyOnPurchaseOrder?: number
  qtyOnProductionOrder?: number
  qtyOnSalesOrder?: number
  qcRequired?: boolean
  qualityTestGroupCode?: string | null
  productionBomId?: string | null
  routingNo?: string | null
  drawingNo?: string | null
  /** Sub-assembly MRP/BOM behaviour — required when itemType = sub_assembly */
  subAssemblyRule: SubAssemblyRule | null
  createdAt: string
  updatedAt: string
}

export interface Customer extends MasterRecordAudit {
  id: string
  customerCode: string
  customerName: string
  customerType: CustomerType
  industry?: string
  addressLine1: string
  addressLine2?: string
  /** Delivery site / plant address line — when different from billing */
  shippingAddress?: string
  shippingAddressLine2?: string
  shippingCity?: string
  shippingState?: string
  shippingPincode?: string
  shippingCountry?: string
  /** Plant / dispatch delivery site — when different from shipping */
  deliveryAddress?: string
  deliveryAddressLine2?: string
  deliveryCity?: string
  deliveryState?: string
  deliveryPincode?: string
  deliveryCountry?: string
  city: string
  state: string
  pincode: string
  /** Billing country — defaults to India for domestic customers */
  country?: string
  gstin: string
  /** Permanent Account Number — typically embedded in GSTIN (chars 3–12) */
  pan?: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  creditDays: number
  /** Approved credit limit in INR — used for AR exposure checks */
  creditLimit?: number
  salesTerritory: SalesTerritory
  isActive: boolean
  /** CRM account owner (user id) */
  ownerId?: string | null
  ownerName?: string | null
  /** True only after the first sales invoice is posted for this company. */
  isCustomer?: boolean
  firstInvoicedAt?: string | null
  createdAt: string
}

export interface CustomerContact extends MasterRecordAudit {
  id: string
  customerId: string
  contactName: string
  designation: string
  mobile: string
  email: string
  department: string
  isActive: boolean
  createdAt: string
}

export interface Transporter extends MasterRecordAudit {
  id: string
  transporterName: string
  contactPerson: string
  mobile: string
  vehicleType: string
  gstin: string
  city: string
  isActive: boolean
  createdAt: string
}

export interface CommercialTerm extends MasterRecordAudit {
  id: string
  termType: 'payment' | 'tax' | 'delivery'
  code: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
}

export interface Vendor extends MasterRecordAudit {
  id: string
  vendorCode: string
  vendorName: string
  /** BC Search Name — fast lookup on documents */
  searchName?: string
  /** BC Blocked — cannot post purchase documents */
  isBlocked?: boolean
  address?: string
  address2?: string
  city: string
  state: string
  pincode?: string
  country?: string
  countryId?: string
  stateId?: string
  cityId?: string
  email?: string
  gstin: string
  /** GST vendor type for India tax posting */
  gstVendorType?: GstVendorType
  pan?: string
  panStatus?: PanStatus
  paymentMethod?: VendorPaymentMethod | string
  /** Free-text bank account / IFSC details */
  bankDetails?: string
  vendorType: VendorType
  contactPerson: string
  contactPhone: string
  paymentTermsDays: number
  defaultLeadTimeDays: number
  suppliedCategories: string[]
  rating: number
  isActive: boolean
  createdAt: string
}

export interface ItemVendorMap {
  id: string
  itemId: string
  vendorId: string
  isPreferred: boolean
  leadTimeDays: number
  lastRate: number
}

export interface Warehouse extends MasterRecordAudit {
  id: string
  warehouseCode: string
  warehouseName: string
  warehouseType: WarehouseType
  plantCode: string
  address: string
  isActive: boolean
  createdAt: string
}

import type {
  ProductAttachment,
  ProductChangeLogEntry,
  ProductCategory,
  ProductFamily,
  ProductManufacturingControl,
  ProductQualityControl,
  ProductRevisionRecord,
  ProductSalesControl,
  ProductStandardCost,
  ProductStatus,
} from './productMaster'

export interface Product {
  id: string
  productCode: string
  productName: string
  productFamily: ProductFamily
  productType: ProductType
  /** Finished Goods Item — inventory / stock / dispatch identity */
  fgItemId: string
  capacity: string
  axleConfig: string
  tareWeightKg: number
  gvwKg: number
  standardPrice: number
  standardLeadDays: number
  baseUomId: string
  hsnCode: string
  specifications: string
  isActive: boolean
  /** Lifecycle: Draft → Engineering Review → Approved → Released → Obsolete */
  status: ProductStatus
  productRevision: string
  drawingRevision: string
  bomRevision: string
  routingRevision: string
  engineeringOwner: string
  effectiveFrom: string
  effectiveTo: string | null
  revisionReason: string
  revisions: ProductRevisionRecord[]
  manufacturing: ProductManufacturingControl
  standardCost: ProductStandardCost
  quality: ProductQualityControl
  sales: ProductSalesControl
  attachments: ProductAttachment[]
  changeLog: ProductChangeLogEntry[]
  /** Portfolio category (details.productCategory) */
  productCategory?: ProductCategory | string
  material?: string
  application?: string
  parentProductCode?: string | null
  isVariant?: boolean
  isConfigurableParent?: boolean
  vehicleGvwLabel?: string
  createdAt: string
  updatedAt: string
}

export type MasterEntity =
  | 'uom'
  | 'itemCategory'
  | 'item'
  | 'customer'
  | 'vendor'
  | 'warehouse'
  | 'location'
  | 'product'
