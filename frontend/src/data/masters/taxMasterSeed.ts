import type { GstGroupCode, GstRate, HsnMaster } from '../../types/taxMaster'

const now = () => new Date().toISOString()

export const seedGstGroups: GstGroupCode[] = [
  { id: 'gstg-18-goods', code: 'GST18-GOODS', goodsType: 'goods', description: 'Standard 18% GST on goods — trailers, assemblies, components', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstg-12-goods', code: 'GST12-GOODS', goodsType: 'goods', description: 'Reduced 12% GST on selected steel & structural goods', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstg-5-goods', code: 'GST5-GOODS', goodsType: 'goods', description: 'Concessional 5% GST on essential inputs', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstg-18-service', code: 'GST18-SERVICE', goodsType: 'service', description: '18% GST on fabrication, painting & service charges', isActive: true, createdAt: now(), updatedAt: now() },
]

export const seedHsnMasters: HsnMaster[] = [
  { id: 'hsn-871639', code: '871639', gstGroupId: 'gstg-18-goods', description: 'Trailers and semi-trailers — tankers, bulkers, side-wall', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-730890', code: '730890', gstGroupId: 'gstg-18-goods', description: 'Structures and parts of structures — tank shells, chassis', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-732690', code: '732690', gstGroupId: 'gstg-18-goods', description: 'Other articles of iron or steel — brackets, fittings', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-848180', code: '848180', gstGroupId: 'gstg-18-goods', description: 'Taps, cocks, valves — discharge & pneumatic valves', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-721070', code: '721070', gstGroupId: 'gstg-12-goods', description: 'Flat-rolled MS plate — 8mm and structural plate', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-8708', code: '8708', gstGroupId: 'gstg-18-goods', description: 'Parts for motor vehicles — axles, suspension, running gear', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-3208', code: '3208', gstGroupId: 'gstg-18-goods', description: 'Paints and varnishes — primer, topcoat', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-8311', code: '8311', gstGroupId: 'gstg-12-goods', description: 'Wire, rods, tubes — welding wire', isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'hsn-4016', code: '4016', gstGroupId: 'gstg-18-goods', description: 'Articles of vulcanised rubber — seals, gaskets', isActive: true, createdAt: now(), updatedAt: now() },
]

export const seedGstRates: GstRate[] = [
  { id: 'gstr-18-mh-mh', code: 'GSTR0001', gstGroupId: 'gstg-18-goods', fromState: 'Maharashtra', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', dateTo: null, sgst: 9, cgst: 9, igst: 18, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstr-12-mh-mh', code: 'GSTR0002', gstGroupId: 'gstg-12-goods', fromState: 'Maharashtra', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', dateTo: null, sgst: 6, cgst: 6, igst: 12, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstr-5-mh-mh', code: 'GSTR0003', gstGroupId: 'gstg-5-goods', fromState: 'Maharashtra', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', dateTo: null, sgst: 2.5, cgst: 2.5, igst: 5, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstr-18-mh-gj', code: 'GSTR0004', gstGroupId: 'gstg-18-goods', fromState: 'Maharashtra', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', dateTo: null, sgst: 0, cgst: 0, igst: 18, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'gstr-18-svc-mh', code: 'GSTR0005', gstGroupId: 'gstg-18-service', fromState: 'Maharashtra', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', dateTo: null, sgst: 9, cgst: 9, igst: 18, isActive: true, createdAt: now(), updatedAt: now() },
]

export const itemMasterExtensions: Record<string, Partial<import('../../types/master').Item>> = {
  'item-fg-iso': { productType: 'finish_product', inventoryType: 'inventory', itemName2: '26 KL ISO Tank Container', hsnId: 'hsn-871639', gstGroupId: 'gstg-18-goods', qcRequired: true, qualityTestGroupCode: 'FG-FINAL', inventoryQty: 2, qtyOnSalesOrder: 1 },
  'item-fg-bulker': { productType: 'finish_product', inventoryType: 'inventory', itemName2: '45 M3 Bulker Trailer', hsnId: 'hsn-871639', gstGroupId: 'gstg-18-goods', qcRequired: true, qualityTestGroupCode: 'FG-FINAL', inventoryQty: 3, qtyOnProductionOrder: 2 },
  'item-rm-plt': { productType: 'raw_material', inventoryType: 'inventory', itemName2: 'MS Plate 8mm', hsnId: 'hsn-721070', gstGroupId: 'gstg-12-goods', qcRequired: true, qualityTestGroupCode: 'RM-INCOMING', inventoryQty: 12500, qtyOnPurchaseOrder: 5000 },
  'item-bo-axl': { productType: 'boi', inventoryType: 'inventory', itemName2: 'Axle Assembly', hsnId: 'hsn-8708', gstGroupId: 'gstg-18-goods', qcRequired: true, qualityTestGroupCode: 'BO-RECEIPT', inventoryQty: 4, qtyOnPurchaseOrder: 2 },
  'item-bo-lj': { productType: 'boi', inventoryType: 'inventory', itemName2: 'Landing Gear', hsnId: 'hsn-8708', gstGroupId: 'gstg-18-goods', inventoryQty: 8 },
  'item-sa-run-gear': { productType: 'sub_assembly', inventoryType: 'inventory', itemName2: 'Brake Assembly', hsnId: 'hsn-8708', gstGroupId: 'gstg-18-goods', qcRequired: true, qualityTestGroupCode: 'SA-INTER', qtyOnProductionOrder: 1 },
  'item-bo-valve': { productType: 'boi', inventoryType: 'inventory', itemName2: 'Hydraulic Cylinder', hsnId: 'hsn-848180', gstGroupId: 'gstg-18-goods', inventoryQty: 6 },
  'item-rm-primer': { productType: 'raw_material', inventoryType: 'inventory', itemName2: 'Paint Primer', hsnId: 'hsn-3208', gstGroupId: 'gstg-18-goods', qcRequired: true, qualityTestGroupCode: 'PAINT-QC', inventoryQty: 420 },
  'item-rm-weld-wire': { productType: 'raw_material', inventoryType: 'inventory', itemName2: 'Welding Wire ER70S-6', hsnId: 'hsn-8311', gstGroupId: 'gstg-12-goods', qcRequired: true, qualityTestGroupCode: 'RM-INCOMING', inventoryQty: 850, qtyOnPurchaseOrder: 500 },
  'item-rm-gasket': { productType: 'raw_material', inventoryType: 'inventory', itemName2: 'Rubber Seal / Gasket 3"', hsnId: 'hsn-4016', gstGroupId: 'gstg-18-goods', inventoryQty: 240, qtyOnPurchaseOrder: 100 },
}
