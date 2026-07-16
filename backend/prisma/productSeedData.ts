/** Seed commercial product catalog for CRM / sales (API mode). */

import {
  VASANT_PRODUCT_SEED_ROWS,
  type ProductSeedRow as VasantProductSeedRow,
} from './vasantProductPortfolio.js'

export type ProductSeedRow = VasantProductSeedRow & {
  /** Resolved at seed time from fgItemCode → MasterItem.id */
  fgItemId?: string | null
}

/** Legacy catalog rows — preserved for existing tenants / quotations. */
const LEGACY_PRODUCT_SEED_ROWS: ProductSeedRow[] = [
  {
    code: 'FG-45M3-BULKER',
    name: '45 M3 Bulker Trailer',
    productFamily: 'bulker_trailer',
    productType: 'bulker',
    fgItemCode: 'FG-45M3-BULKER',
    capacity: '45 m³',
    axleConfig: '3-Axle Air Suspension',
    tareWeightKg: 6800,
    gvwKg: 42000,
    standardPrice: 2850000,
    standardLeadDays: 45,
    baseUomId: null,
    hsnCode: '8716',
    specifications:
      'Tank: MS IS 2062 E350, 16mm shell. Discharge: 4" pneumatic butterfly valve. Landing gear: 2× 24T JOST.',
    productStatus: 'released',
    details: {
      productCategory: 'semi_trailers',
      productCategoryLabel: 'Semi Trailers',
      application: 'Cement',
      material: 'Mild Steel',
      parentProductCode: null,
      isVariant: false,
      isConfigurableParent: false,
      productRevision: 'Rev-3',
      drawingRevision: 'DWG-45M3-Rev-C',
      bomRevision: 'Rev-A',
      routingRevision: 'Rev-A',
      engineeringOwner: 'Arun Nair',
      effectiveFrom: '2026-04-01',
      effectiveTo: null,
      revisionReason: 'Production release — western region cement bulker',
      revisions: [],
      manufacturing: {
        defaultWorkCenterIds: [],
        standardProductionDays: 45,
        standardLaborHours: 186,
        releasedBomHeaderId: null,
        releasedRoutingHeaderId: null,
      },
      standardCost: {
        materialCost: 0,
        laborCost: 0,
        machineCost: 0,
        overheadCost: 0,
        totalCost: 0,
        costOverride: false,
        overrideApprovedBy: null,
        overrideApprovedAt: null,
        derivedAt: null,
      },
      quality: {
        finalInspectionPlanId: null,
        finalInspectionPlanName: null,
        customerApprovalRequired: true,
      },
      sales: {
        salesCategory: 'domestic',
        defaultWarrantyMonths: 12,
        taxCategory: 'gst_18',
        productBrochure: '45M3-Bulker-Brochure.pdf',
        specificationSheet: '45M3-Spec-Sheet.pdf',
      },
      attachments: [],
      changeLog: [],
    },
  },
  {
    code: 'FG-ISO-TANK-26K',
    name: '26 KL ISO Tank',
    productFamily: 'iso_tank',
    productType: 'iso_tank',
    fgItemCode: 'FG-ISO-TANK-26K',
    capacity: '26,000 L',
    axleConfig: '2-Axle BPW',
    tareWeightKg: 5200,
    gvwKg: 36000,
    standardPrice: 4200000,
    standardLeadDays: 60,
    baseUomId: null,
    hsnCode: '8716',
    specifications: 'Design code: ADR / UN portable tank. Shell: SS 316L. Insulation: Optional.',
    productStatus: 'released',
    details: {
      productCategory: 'tanks',
      productCategoryLabel: 'Tanks',
      application: 'Liquid Chemicals',
      material: 'Stainless Steel',
      parentProductCode: null,
      isVariant: false,
      isConfigurableParent: false,
      productRevision: 'Rev-1',
      drawingRevision: 'DWG-ISO26K-Rev-A',
      bomRevision: 'Rev-A',
      routingRevision: 'Rev-A',
      engineeringOwner: 'Kavita Rao',
      effectiveFrom: '2026-05-01',
      effectiveTo: null,
      revisionReason: 'Initial ISO tank engineering package',
      revisions: [],
      manufacturing: {
        defaultWorkCenterIds: [],
        standardProductionDays: 60,
        standardLaborHours: 220,
        releasedBomHeaderId: null,
        releasedRoutingHeaderId: null,
      },
      standardCost: {
        materialCost: 0,
        laborCost: 0,
        machineCost: 0,
        overheadCost: 0,
        totalCost: 0,
        costOverride: false,
        overrideApprovedBy: null,
        overrideApprovedAt: null,
        derivedAt: null,
      },
      quality: {
        finalInspectionPlanId: null,
        finalInspectionPlanName: null,
        customerApprovalRequired: false,
      },
      sales: {
        salesCategory: 'export',
        defaultWarrantyMonths: 12,
        taxCategory: 'gst_18',
        productBrochure: null,
        specificationSheet: null,
      },
      attachments: [],
      changeLog: [],
    },
  },
  {
    code: 'FG-SIDEWALL-32FT',
    name: '32 FT Side Wall Trailer',
    productFamily: 'side_wall_trailer',
    productType: 'side_wall',
    fgItemCode: 'FG-SIDEWALL-32FT',
    capacity: '32 MT payload',
    axleConfig: '3-Axle Semi',
    tareWeightKg: 7500,
    gvwKg: 39500,
    standardPrice: 1950000,
    standardLeadDays: 35,
    baseUomId: null,
    hsnCode: '8716',
    specifications: 'Floor: 5mm chequered plate. Side panels: 2.5mm MS sheet. Payload: 32 MT.',
    productStatus: 'released',
    details: {
      productCategory: 'trailers',
      productCategoryLabel: 'Trailers',
      application: 'Custom Process Application',
      material: 'Mild Steel',
      parentProductCode: null,
      isVariant: false,
      isConfigurableParent: false,
      productRevision: 'Rev-2',
      drawingRevision: 'DWG-SW32-Rev-B',
      bomRevision: 'Rev-A',
      routingRevision: 'Rev-A',
      engineeringOwner: 'Priya Deshmukh',
      effectiveFrom: '2026-03-15',
      effectiveTo: null,
      revisionReason: 'Pilot build approval',
      revisions: [],
      manufacturing: {
        defaultWorkCenterIds: [],
        standardProductionDays: 35,
        standardLaborHours: 140,
        releasedBomHeaderId: null,
        releasedRoutingHeaderId: null,
      },
      standardCost: {
        materialCost: 0,
        laborCost: 0,
        machineCost: 0,
        overheadCost: 0,
        totalCost: 0,
        costOverride: false,
        overrideApprovedBy: null,
        overrideApprovedAt: null,
        derivedAt: null,
      },
      quality: {
        finalInspectionPlanId: null,
        finalInspectionPlanName: null,
        customerApprovalRequired: false,
      },
      sales: {
        salesCategory: 'domestic',
        defaultWarrantyMonths: 12,
        taxCategory: 'gst_18',
        productBrochure: null,
        specificationSheet: null,
      },
      attachments: [],
      changeLog: [],
    },
  },
]

/**
 * Idempotent product catalog:
 * - Legacy FG-* products retained
 * - Vasant Fabricators PRD-* hierarchy (category → family → product → variant)
 * Deduped by product code (legacy wins if code collision — none today).
 */
export const PRODUCT_SEED_ROWS: ProductSeedRow[] = (() => {
  const byCode = new Map<string, ProductSeedRow>()
  for (const row of LEGACY_PRODUCT_SEED_ROWS) byCode.set(row.code, row)
  for (const row of VASANT_PRODUCT_SEED_ROWS) {
    if (!byCode.has(row.code)) byCode.set(row.code, row)
  }
  return [...byCode.values()]
})()

export {
  VASANT_FG_ITEM_SEED,
  VASANT_PRODUCT_CATEGORY_LABELS,
  VASANT_MATERIAL_OPTIONS,
  VASANT_APPLICATION_OPTIONS,
  VASANT_FAMILY_TO_CATEGORY,
} from './vasantProductPortfolio.js'
