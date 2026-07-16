/** Manufacturing-grade product master — engineering, costing, quality, lifecycle */

/** High-level portfolio category (stored in details.productCategory). */
export type ProductCategory =
  | 'tanks'
  | 'semi_trailers'
  | 'trailers'
  | 'process_equipment'
  | 'body_building_works'

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  tanks: 'Tanks',
  semi_trailers: 'Semi Trailers',
  trailers: 'Trailers',
  process_equipment: 'Process Equipment',
  body_building_works: 'Body Building Works',
}

export type ProductFamily =
  | 'bulker_trailer'
  | 'iso_tank'
  | 'side_wall_trailer'
  | 'cement_bulker'
  | 'fuel_tanks'
  | 'gas_tanks'
  | 'bulk_liquid_tanks'
  | 'dry_bulk_non_tipping_tanks'
  | 'tipping_tanks'
  | 'storage_tanks'
  | 'gas_tank_semi_trailers'
  | 'dry_bulk_non_tipping_semi_trailers'
  | 'tipping_tanker_semi_trailers'
  | 'bulk_liquid_tank_semi_trailers'
  | 'bulker_semi_trailers'
  | 'liquid_tank_trailers'
  | 'tanker_trailers'
  | 'custom_transport_trailers'
  | 'asme_process_equipment'
  | 'smpv_process_equipment'
  | 'custom_process_equipment'
  | 'commercial_vehicle_body_building'
  | 'custom_body_building_works'
  | 'other'

export type ProductStatus = 'draft' | 'engineering_review' | 'approved' | 'released' | 'obsolete'

export type ProductAttachmentCategory =
  | 'drawing'
  | 'technical_spec'
  | 'customer_approved_drawing'
  | 'manual'
  | 'certificate'

export type SalesCategory = 'domestic' | 'export' | 'oem' | 'aftermarket'
export type TaxCategory = 'gst_18' | 'gst_12' | 'exempt'

export const PRODUCT_STATUS_FLOW: Record<ProductStatus, ProductStatus[]> = {
  draft: ['engineering_review'],
  engineering_review: ['approved'],
  approved: ['released'],
  released: ['obsolete'],
  obsolete: [],
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  engineering_review: 'Engineering Review',
  approved: 'Approved',
  released: 'Released',
  obsolete: 'Obsolete',
}

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  bulker_trailer: 'Bulker Trailer',
  iso_tank: 'ISO Tank',
  side_wall_trailer: 'Side Wall Trailer',
  cement_bulker: 'Cement Bulker',
  fuel_tanks: 'Fuel Tanks',
  gas_tanks: 'Gas Tanks',
  bulk_liquid_tanks: 'Bulk Liquid Tanks',
  dry_bulk_non_tipping_tanks: 'Dry Bulk Non-Tipping Tanks',
  tipping_tanks: 'Tipping Tanks',
  storage_tanks: 'Storage Tanks',
  gas_tank_semi_trailers: 'Gas Tank Semi Trailers',
  dry_bulk_non_tipping_semi_trailers: 'Dry Bulk Non-Tipping Semi Trailers',
  tipping_tanker_semi_trailers: 'Tipping Tanker Semi Trailers',
  bulk_liquid_tank_semi_trailers: 'Bulk Liquid Tank Semi Trailers',
  bulker_semi_trailers: 'Bulker Semi Trailers',
  liquid_tank_trailers: 'Liquid Tank Trailers',
  tanker_trailers: 'Tanker Trailers',
  custom_transport_trailers: 'Custom Transport Trailers',
  asme_process_equipment: 'ASME Process Equipment',
  smpv_process_equipment: 'SMPV(U) Process Equipment',
  custom_process_equipment: 'Custom Process Equipment',
  commercial_vehicle_body_building: 'Commercial Vehicle Body Building',
  custom_body_building_works: 'Custom Body Building Works',
  other: 'Other',
}

export const PRODUCT_FAMILY_CATEGORY: Partial<Record<ProductFamily, ProductCategory>> = {
  fuel_tanks: 'tanks',
  gas_tanks: 'tanks',
  bulk_liquid_tanks: 'tanks',
  dry_bulk_non_tipping_tanks: 'tanks',
  tipping_tanks: 'tanks',
  storage_tanks: 'tanks',
  iso_tank: 'tanks',
  gas_tank_semi_trailers: 'semi_trailers',
  dry_bulk_non_tipping_semi_trailers: 'semi_trailers',
  tipping_tanker_semi_trailers: 'semi_trailers',
  bulk_liquid_tank_semi_trailers: 'semi_trailers',
  bulker_semi_trailers: 'semi_trailers',
  bulker_trailer: 'semi_trailers',
  cement_bulker: 'semi_trailers',
  liquid_tank_trailers: 'trailers',
  tanker_trailers: 'trailers',
  custom_transport_trailers: 'trailers',
  side_wall_trailer: 'trailers',
  asme_process_equipment: 'process_equipment',
  smpv_process_equipment: 'process_equipment',
  custom_process_equipment: 'process_equipment',
  commercial_vehicle_body_building: 'body_building_works',
  custom_body_building_works: 'body_building_works',
}

export const ATTACHMENT_CATEGORY_LABELS: Record<ProductAttachmentCategory, string> = {
  drawing: 'Drawing',
  technical_spec: 'Technical Spec',
  customer_approved_drawing: 'Customer Approved Drawing',
  manual: 'Manual',
  certificate: 'Certificate',
}

export interface ProductAttachment {
  id: string
  name: string
  category: ProductAttachmentCategory
  uploadedAt: string
  uploadedByName: string
}

export interface ProductRevisionRecord {
  id: string
  revisionNo: string
  drawingRevision: string
  bomRevision: string
  routingRevision: string
  effectiveFrom: string
  effectiveTo: string | null
  revisionReason: string
  engineeringOwner: string
  locked: boolean
  createdAt: string
  createdByName: string
}

export interface ProductChangeLogEntry {
  id: string
  field: string
  oldValue: string
  newValue: string
  changedByName: string
  changedAt: string
  reason: string
}

export interface ProductStandardCost {
  materialCost: number
  laborCost: number
  machineCost: number
  overheadCost: number
  totalCost: number
  costOverride: boolean
  overrideApprovedBy: string | null
  overrideApprovedAt: string | null
  derivedAt: string | null
}

export interface ProductQualityControl {
  qcPlanId: string | null
  qcPlanName: string
  finalInspectionPlanId: string | null
  finalInspectionPlanName: string
  testCertificateTemplate: string
  customerApprovalRequired: boolean
}

export interface ProductSalesControl {
  salesCategory: SalesCategory
  defaultWarrantyMonths: number
  taxCategory: TaxCategory
  productBrochure: string
  specificationSheet: string
}

export interface ProductManufacturingControl {
  defaultWorkCenterIds: string[]
  standardProductionDays: number
  standardLaborHours: number
  releasedBomHeaderId: string | null
  releasedRoutingHeaderId: string | null
}

/** Legacy lifecycle → new status */
export const LEGACY_LIFECYCLE_TO_STATUS: Record<string, ProductStatus> = {
  development: 'draft',
  pilot: 'engineering_review',
  production: 'released',
  maintenance: 'approved',
  obsolete: 'obsolete',
}

export type ProductMasterExtension = {
  productFamily: ProductFamily
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
}
