import type { Product } from '../../types/master'
import type { ProductStatus } from '../../types/productMaster'
import { defaultProductMasterFields } from '../../utils/productMaster'

const now = () => new Date().toISOString()

function seedProduct(
  identity: Pick<
    Product,
    | 'id'
    | 'productCode'
    | 'productName'
    | 'productFamily'
    | 'productType'
    | 'fgItemId'
    | 'capacity'
    | 'axleConfig'
    | 'tareWeightKg'
    | 'gvwKg'
    | 'standardPrice'
    | 'standardLeadDays'
    | 'baseUomId'
    | 'hsnCode'
    | 'specifications'
  >,
  master: {
    status: ProductStatus
    productRevision: string
    drawingRevision: string
    bomRevision: string
    routingRevision: string
    engineeringOwner: string
    effectiveFrom: string
    revisionReason: string
    manufacturing?: Partial<Product['manufacturing']>
    quality?: Partial<Product['quality']>
    sales?: Partial<Product['sales']>
    standardCost?: Partial<Product['standardCost']>
  },
): Product {
  const ts = now()
  return {
    ...identity,
    isActive: master.status !== 'obsolete',
    ...defaultProductMasterFields({
      productFamily: identity.productFamily,
      status: master.status,
      productRevision: master.productRevision,
      drawingRevision: master.drawingRevision,
      bomRevision: master.bomRevision,
      routingRevision: master.routingRevision,
      engineeringOwner: master.engineeringOwner,
      effectiveFrom: master.effectiveFrom,
      effectiveTo: null,
      revisionReason: master.revisionReason,
      manufacturing: { ...defaultProductMasterFields().manufacturing, ...master.manufacturing },
      quality: { ...defaultProductMasterFields().quality, ...master.quality },
      sales: { ...defaultProductMasterFields().sales, ...master.sales },
      standardCost: { ...defaultProductMasterFields().standardCost, ...master.standardCost },
    }),
    createdAt: ts,
    updatedAt: ts,
  }
}

export const seedProducts: Product[] = [
  {
    ...seedProduct(
      {
        id: 'prod-45m3',
        productCode: 'FG-45M3-BULKER',
        productName: '45 M3 Bulker Trailer',
        productFamily: 'bulker_trailer',
        productType: 'bulker',
        fgItemId: 'item-fg-bulker',
        capacity: '45 m³',
        axleConfig: '3-Axle Air Suspension',
        tareWeightKg: 6800,
        gvwKg: 42000,
        standardPrice: 2850000,
        standardLeadDays: 45,
        baseUomId: 'uom-nos',
        hsnCode: '8716',
        specifications:
          'Tank: MS IS 2062 E350, 16mm shell. Discharge: 4" pneumatic butterfly valve. Landing gear: 2× 24T JOST.',
      },
      {
        status: 'released',
        productRevision: 'Rev-3',
        drawingRevision: 'DWG-45M3-Rev-C',
        bomRevision: 'Rev-A',
        routingRevision: 'Rev-A',
        engineeringOwner: 'Arun Nair',
        effectiveFrom: '2026-04-01',
        revisionReason: 'Production release — western region cement bulker',
        manufacturing: {
          standardProductionDays: 45,
          standardLaborHours: 186,
          releasedBomHeaderId: 'bom-bulker-a',
          releasedRoutingHeaderId: 'rtg-bulker-a',
        },
        quality: {
          finalInspectionPlanId: 'plan-final-fg',
          finalInspectionPlanName: 'Final FG QC — Bulker Trailer',
          customerApprovalRequired: true,
        },
        sales: {
          salesCategory: 'domestic',
          defaultWarrantyMonths: 12,
          productBrochure: '45M3-Bulker-Brochure.pdf',
          specificationSheet: '45M3-Spec-Sheet.pdf',
        },
      },
    ),
    attachments: [
      {
        id: 'patt-eng-bulker',
        name: 'DWG-45M3-Rev-C.pdf',
        category: 'drawing',
        uploadedAt: '2026-03-01T09:00:00.000Z',
        uploadedByName: 'Arun Nair',
      },
      {
        id: 'patt-cust-bulker',
        name: 'Western-Cement-Layout-Approved.pdf',
        category: 'customer_approved_drawing',
        uploadedAt: '2026-02-20T11:00:00.000Z',
        uploadedByName: 'Sales Engineering',
      },
      {
        id: 'patt-cert-bulker',
        name: 'ISO-9001-Product-Cert.pdf',
        category: 'certificate',
        uploadedAt: '2026-01-15T10:00:00.000Z',
        uploadedByName: 'Quality Team',
      },
    ],
  },
  seedProduct(
    {
      id: 'prod-iso',
      productCode: 'FG-ISO-TANK-26K',
      productName: '26 KL ISO Tank',
      productFamily: 'iso_tank',
      productType: 'iso_tank',
      fgItemId: 'item-fg-iso',
      capacity: '26,000 L',
      axleConfig: '2-Axle BPW',
      tareWeightKg: 5200,
      gvwKg: 36000,
      standardPrice: 4200000,
      standardLeadDays: 60,
      baseUomId: 'uom-nos',
      hsnCode: '8716',
      specifications: 'Design code: ADR / UN portable tank. Shell: SS 316L. Insulation: Optional.',
    },
    {
      status: 'engineering_review',
      productRevision: 'Rev-1',
      drawingRevision: 'DWG-ISO26K-Rev-A',
      bomRevision: 'Rev-A',
      routingRevision: 'Rev-A',
      engineeringOwner: 'Kavita Rao',
      effectiveFrom: '2026-05-01',
      revisionReason: 'Initial ISO tank engineering package',
      manufacturing: { standardProductionDays: 60, standardLaborHours: 220 },
    },
  ),
  seedProduct(
    {
      id: 'prod-sidewall',
      productCode: 'FG-SIDEWALL-32FT',
      productName: '32 FT Side Wall Trailer',
      productFamily: 'side_wall_trailer',
      productType: 'side_wall',
      fgItemId: 'item-fg-sidewall',
      capacity: '32 MT payload',
      axleConfig: '3-Axle Semi',
      tareWeightKg: 7500,
      gvwKg: 39500,
      standardPrice: 1950000,
      standardLeadDays: 35,
      baseUomId: 'uom-nos',
      hsnCode: '8716',
      specifications: 'Floor: 5mm chequered plate. Side panels: 2.5mm MS sheet. Payload: 32 MT.',
    },
    {
      status: 'approved',
      productRevision: 'Rev-2',
      drawingRevision: 'DWG-SW32-Rev-B',
      bomRevision: 'Rev-A',
      routingRevision: 'Rev-A',
      engineeringOwner: 'Priya Deshmukh',
      effectiveFrom: '2026-03-15',
      revisionReason: 'Pilot build approval pending routing release',
      manufacturing: { standardProductionDays: 35 },
    },
  ),
]
