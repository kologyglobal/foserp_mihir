import type { Product } from '../../types/master'
import type { ProductStatus } from '../../types/productMaster'
import { defaultProductMasterFields } from '../../utils/productMaster'

const now = () => new Date().toISOString()

function demoProduct(
  identity: Pick<Product, 'id' | 'productCode' | 'productName' | 'productFamily' | 'productType' | 'fgItemId' | 'capacity' | 'axleConfig' | 'tareWeightKg' | 'gvwKg' | 'standardPrice' | 'standardLeadDays' | 'baseUomId' | 'hsnCode' | 'specifications'>,
  status: ProductStatus,
  bomId?: string,
  routingId?: string,
): Product {
  const ts = now()
  return {
    ...identity,
    isActive: status !== 'obsolete',
    ...defaultProductMasterFields({
      productFamily: identity.productFamily,
      status,
      productRevision: 'Rev-1',
      drawingRevision: `DWG-${identity.productCode}-Rev-A`,
      bomRevision: 'Rev-A',
      routingRevision: 'Rev-A',
      engineeringOwner: 'Arun Nair',
      effectiveFrom: '2026-04-01',
      effectiveTo: null,
      revisionReason: 'Demo factory product release',
      manufacturing: {
        ...defaultProductMasterFields().manufacturing,
        standardProductionDays: identity.standardLeadDays,
        releasedBomHeaderId: bomId ?? null,
        releasedRoutingHeaderId: routingId ?? null,
      },
    }),
    createdAt: ts,
    updatedAt: ts,
  }
}

export const demoExtensionProducts: Product[] = [
  demoProduct(
    { id: 'prod-tipping', productCode: 'FG-TIPPING-32T', productName: 'Tipping Trailer', productFamily: 'other', productType: 'side_wall', fgItemId: 'item-fg-tipping', capacity: '32 MT', axleConfig: '3-Axle', tareWeightKg: 8200, gvwKg: 40200, standardPrice: 2200000, standardLeadDays: 40, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Hydraulic tipping body, 32 MT payload' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-cement-bulker', productCode: 'FG-CEMENT-BULK', productName: 'Cement Bulker', productFamily: 'bulker_trailer', productType: 'bulker', fgItemId: 'item-fg-cement-bulker', capacity: '40 m³', axleConfig: '3-Axle Air', tareWeightKg: 6500, gvwKg: 40000, standardPrice: 2450000, standardLeadDays: 42, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Standard cement bulker with pneumatic discharge' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-flyash', productCode: 'FG-FLYASH-40M3', productName: 'Fly Ash Bulker', productFamily: 'bulker_trailer', productType: 'bulker', fgItemId: 'item-fg-flyash', capacity: '40 m³', axleConfig: '3-Axle', tareWeightKg: 6600, gvwKg: 41000, standardPrice: 2650000, standardLeadDays: 45, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Fly ash bulker with dense phase discharge' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-ss-tank', productCode: 'FG-SS-TANK-20K', productName: 'Stainless Steel Tanker', productFamily: 'iso_tank', productType: 'iso_tank', fgItemId: 'item-fg-ss-tank', capacity: '20 KL', axleConfig: '2-Axle', tareWeightKg: 4800, gvwKg: 32000, standardPrice: 5200000, standardLeadDays: 70, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'SS316 chemical tanker' },
    'engineering_review',
  ),
  demoProduct(
    { id: 'prod-pneumatic', productCode: 'FG-PNEU-BULK', productName: 'Pneumatic Bulker', productFamily: 'bulker_trailer', productType: 'bulker', fgItemId: 'item-fg-pneumatic', capacity: '42 m³', axleConfig: '3-Axle', tareWeightKg: 7000, gvwKg: 42000, standardPrice: 2950000, standardLeadDays: 48, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'High-capacity pneumatic bulker' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-lowbed', productCode: 'FG-LOWBED-60T', productName: 'Low Bed Trailer', productFamily: 'other', productType: 'side_wall', fgItemId: 'item-fg-lowbed', capacity: '60 MT', axleConfig: '4-Axle', tareWeightKg: 12000, gvwKg: 72000, standardPrice: 3850000, standardLeadDays: 55, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Heavy haul low bed trailer' },
    'approved',
  ),
  demoProduct(
    { id: 'prod-flatbed', productCode: 'FG-FLATBED-40T', productName: 'Flat Bed Trailer', productFamily: 'side_wall_trailer', productType: 'side_wall', fgItemId: 'item-fg-flatbed', capacity: '40 MT', axleConfig: '3-Axle', tareWeightKg: 6800, gvwKg: 46800, standardPrice: 1750000, standardLeadDays: 32, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Flat bed for general cargo' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-tanker-30kl', productCode: 'FG-TANK-30KL', productName: 'Fuel Tanker 30 KL', productFamily: 'iso_tank', productType: 'iso_tank', fgItemId: 'item-fg-ss-tank', capacity: '30 KL', axleConfig: '3-Axle', tareWeightKg: 7200, gvwKg: 45000, standardPrice: 4100000, standardLeadDays: 60, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Fuel tanker for petroleum logistics' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-dumper-25t', productCode: 'FG-DUMP-25T', productName: 'Dumper Trailer 25T', productFamily: 'other', productType: 'side_wall', fgItemId: 'item-fg-tipping', capacity: '25 MT', axleConfig: '2-Axle', tareWeightKg: 6000, gvwKg: 31000, standardPrice: 1950000, standardLeadDays: 38, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Heavy-duty dumper for mining' },
    'approved',
  ),
  demoProduct(
    { id: 'prod-bulk-50m3', productCode: 'FG-BULK-50M3', productName: 'Bulker 50 m³', productFamily: 'bulker_trailer', productType: 'bulker', fgItemId: 'item-fg-cement-bulker', capacity: '50 m³', axleConfig: '4-Axle', tareWeightKg: 8000, gvwKg: 48000, standardPrice: 3150000, standardLeadDays: 50, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'High-volume cement bulker' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-container-40ft', productCode: 'FG-CONT-40FT', productName: 'Container Trailer 40ft', productFamily: 'side_wall_trailer', productType: 'side_wall', fgItemId: 'item-fg-flatbed', capacity: '40 ft', axleConfig: '3-Axle', tareWeightKg: 5500, gvwKg: 38000, standardPrice: 1650000, standardLeadDays: 30, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Skeletal container trailer' },
    'released',
    'bom-bulker-a',
    'rtg-bulker-a',
  ),
  demoProduct(
    { id: 'prod-chemical-18kl', productCode: 'FG-CHEM-18KL', productName: 'Chemical Tanker 18 KL', productFamily: 'iso_tank', productType: 'iso_tank', fgItemId: 'item-fg-ss-tank', capacity: '18 KL', axleConfig: '2-Axle', tareWeightKg: 4500, gvwKg: 30000, standardPrice: 4800000, standardLeadDays: 65, baseUomId: 'uom-nos', hsnCode: '8716', specifications: 'Chemical tanker SS316' },
    'engineering_review',
  ),
]
