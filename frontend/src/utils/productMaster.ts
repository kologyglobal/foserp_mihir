import type {
  ProductAttachment,
  ProductAttachmentCategory,
  ProductChangeLogEntry,
  ProductFamily,
  ProductManufacturingControl,
  ProductQualityControl,
  ProductRevisionRecord,
  ProductSalesControl,
  ProductStandardCost,
  ProductStatus,
} from '../types/productMaster'
import { LEGACY_LIFECYCLE_TO_STATUS, PRODUCT_STATUS_FLOW } from '../types/productMaster'
import type { Product } from '../types/master'
import { getSessionUser } from './permissions'

const LABOR_RATE_PER_HOUR = 450
const MACHINE_RATE_PER_HOUR = 280

export function defaultManufacturing(): ProductManufacturingControl {
  return {
    defaultWorkCenterIds: [],
    standardProductionDays: 45,
    standardLaborHours: 186,
    releasedBomHeaderId: null,
    releasedRoutingHeaderId: null,
  }
}

export function defaultStandardCost(): ProductStandardCost {
  return {
    materialCost: 0,
    laborCost: 0,
    machineCost: 0,
    overheadCost: 0,
    totalCost: 0,
    costOverride: false,
    overrideApprovedBy: null,
    overrideApprovedAt: null,
    derivedAt: null,
  }
}

export function defaultQuality(): ProductQualityControl {
  return {
    qcPlanId: null,
    qcPlanName: '',
    finalInspectionPlanId: null,
    finalInspectionPlanName: '',
    testCertificateTemplate: 'TC-STD-001',
    customerApprovalRequired: false,
  }
}

export function defaultSales(): ProductSalesControl {
  return {
    salesCategory: 'domestic',
    defaultWarrantyMonths: 12,
    taxCategory: 'gst_18',
    productBrochure: '',
    specificationSheet: '',
  }
}

export function defaultProductMasterFields(
  overrides: Partial<
    Pick<
      Product,
      | 'productFamily'
      | 'status'
      | 'productRevision'
      | 'drawingRevision'
      | 'bomRevision'
      | 'routingRevision'
      | 'engineeringOwner'
      | 'effectiveFrom'
      | 'effectiveTo'
      | 'revisionReason'
      | 'revisions'
      | 'manufacturing'
      | 'standardCost'
      | 'quality'
      | 'sales'
      | 'attachments'
      | 'changeLog'
    >
  > = {},
): Pick<
  Product,
  | 'productFamily'
  | 'status'
  | 'productRevision'
  | 'drawingRevision'
  | 'bomRevision'
  | 'routingRevision'
  | 'engineeringOwner'
  | 'effectiveFrom'
  | 'effectiveTo'
  | 'revisionReason'
  | 'revisions'
  | 'manufacturing'
  | 'standardCost'
  | 'quality'
  | 'sales'
  | 'attachments'
  | 'changeLog'
> {
  return {
    productFamily: 'bulker_trailer',
    status: 'draft',
    productRevision: 'Rev-0',
    drawingRevision: 'DWG-TBD',
    bomRevision: '—',
    routingRevision: '—',
    engineeringOwner: 'Unassigned',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
    revisionReason: 'Initial creation',
    revisions: [],
    manufacturing: defaultManufacturing(),
    standardCost: defaultStandardCost(),
    quality: defaultQuality(),
    sales: defaultSales(),
    attachments: [],
    changeLog: [],
    ...overrides,
  }
}

function mapLegacyLifecycle(raw: Record<string, unknown>): ProductStatus {
  const legacy = raw.lifecycle as string | undefined
  if (legacy && legacy in LEGACY_LIFECYCLE_TO_STATUS) {
    return LEGACY_LIFECYCLE_TO_STATUS[legacy as keyof typeof LEGACY_LIFECYCLE_TO_STATUS]
  }
  return (raw.status as ProductStatus) ?? 'draft'
}

/** Backfill persisted products from prior schema versions */
export function migrateProductMaster(persisted: Record<string, unknown>, seed?: Product): Product {
  const base = seed ? ({ ...seed } as Product) : ({ ...defaultProductMasterFields() } as unknown as Product)
  const merged = { ...base, ...persisted } as Product & Record<string, unknown>

  const effectiveFrom =
    (merged.effectiveFrom as string) ??
    (merged.effectiveDate as string | undefined) ??
    base.effectiveFrom

  const effectiveTo =
    merged.effectiveTo !== undefined
      ? (merged.effectiveTo as string | null)
      : (merged as Record<string, unknown>).status === 'obsolete' || (merged as Record<string, unknown>).lifecycle === 'obsolete'
        ? ((merged.obsoleteDate as string | null) ?? null)
        : ((merged.obsoleteDate as string | null) ?? base.effectiveTo)

  return {
    ...(merged as Product),
    productFamily: (merged.productFamily as ProductFamily) ?? base.productFamily,
    status: mapLegacyLifecycle(merged),
    productRevision: (merged.productRevision as string) ?? base.productRevision,
    drawingRevision: (merged.drawingRevision as string) ?? base.drawingRevision,
    bomRevision: (merged.bomRevision as string) ?? base.bomRevision,
    routingRevision: (merged.routingRevision as string) ?? base.routingRevision,
    engineeringOwner: (merged.engineeringOwner as string) ?? base.engineeringOwner,
    effectiveFrom,
    effectiveTo,
    revisionReason: (merged.revisionReason as string) ?? base.revisionReason,
    revisions: (merged.revisions as ProductRevisionRecord[]) ?? base.revisions,
    manufacturing: { ...defaultManufacturing(), ...(merged.manufacturing as ProductManufacturingControl | undefined) },
    standardCost: { ...defaultStandardCost(), ...(merged.standardCost as ProductStandardCost | undefined) },
    quality: { ...defaultQuality(), ...(merged.quality as ProductQualityControl | undefined) },
    sales: { ...defaultSales(), ...(merged.sales as ProductSalesControl | undefined) },
    attachments: (merged.attachments as ProductAttachment[]) ?? base.attachments,
    changeLog: (merged.changeLog as ProductChangeLogEntry[]) ?? base.changeLog,
  }
}

export function productStatusColor(
  status: ProductStatus,
): 'blue' | 'purple' | 'green' | 'orange' | 'gray' {
  switch (status) {
    case 'draft':
      return 'blue'
    case 'engineering_review':
      return 'purple'
    case 'approved':
      return 'orange'
    case 'released':
      return 'green'
    case 'obsolete':
      return 'gray'
    default:
      return 'gray'
  }
}

/** @deprecated use productStatusColor */
export const lifecycleColor = productStatusColor

export function appendChangeLog(
  product: Product,
  entries: Omit<ProductChangeLogEntry, 'id' | 'changedAt' | 'changedByName'>[],
): ProductChangeLogEntry[] {
  const user = getSessionUser()
  const ts = new Date().toISOString()
  const newEntries = entries.map((e) => ({
    ...e,
    id: `pcl-${crypto.randomUUID().slice(0, 8)}`,
    changedAt: ts,
    changedByName: user.name,
  }))
  return [...newEntries, ...product.changeLog].slice(0, 200)
}

export function deriveCostsFromBomAndRouting(input: {
  bomTotalCost: number
  routingStdHours: number
  overheadPct?: number
}): ProductStandardCost {
  const overheadPct = input.overheadPct ?? 12
  const materialCost = Math.round(input.bomTotalCost * 100) / 100
  const laborCost = Math.round(input.routingStdHours * LABOR_RATE_PER_HOUR * 100) / 100
  const machineCost = Math.round(input.routingStdHours * MACHINE_RATE_PER_HOUR * 100) / 100
  const subtotal = materialCost + laborCost + machineCost
  const overheadCost = Math.round(subtotal * (overheadPct / 100) * 100) / 100
  const totalCost = Math.round((subtotal + overheadCost) * 100) / 100
  return {
    materialCost,
    laborCost,
    machineCost,
    overheadCost,
    totalCost,
    costOverride: false,
    overrideApprovedBy: null,
    overrideApprovedAt: null,
    derivedAt: new Date().toISOString(),
  }
}

export function canAdvanceStatus(from: ProductStatus, to: ProductStatus): boolean {
  return PRODUCT_STATUS_FLOW[from]?.includes(to) ?? false
}

export function isProductSellable(product: Product): boolean {
  return product.status === 'released' && product.isActive
}

export function isProductObsolete(product: Product): boolean {
  return product.status === 'obsolete'
}

export function createInitialRevision(product: Product): ProductRevisionRecord {
  const user = getSessionUser()
  return {
    id: `prev-${crypto.randomUUID().slice(0, 8)}`,
    revisionNo: product.productRevision,
    drawingRevision: product.drawingRevision,
    bomRevision: product.bomRevision,
    routingRevision: product.routingRevision,
    effectiveFrom: product.effectiveFrom,
    effectiveTo: new Date().toISOString().slice(0, 10),
    revisionReason: product.revisionReason,
    engineeringOwner: product.engineeringOwner,
    locked: true,
    createdAt: new Date().toISOString(),
    createdByName: user.name,
  }
}

export function makeAttachment(name: string, category: ProductAttachmentCategory): ProductAttachment {
  return {
    id: `patt-${crypto.randomUUID().slice(0, 8)}`,
    name,
    category,
    uploadedAt: new Date().toISOString(),
    uploadedByName: getSessionUser().name,
  }
}
