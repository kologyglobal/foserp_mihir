/**
 * Derives operational BOM seed records from the ISO Tank traveler preview document.
 * Traveler PROC rows stay display-only; material/assembly rows become BOM lines.
 */

import type { BomHeader, BomLine } from '@/types/bom'
import type { BillOfMaterial, BomLine as MfgBomLine } from '@/types/manufacturing'
import { ISO_TANK_26KL_TRAVELER_BOM } from './isoTankTravelerSeed'

const ts = '2026-07-10T10:00:00.000Z'

/** Item ids for traveler material/assembly rows (masters seed). */
export const ISO_TRAVELER_ITEM_IDS = {
  pressureVessel: 'item-iso-pv',
  shell: 'item-iso-shell',
  dish: 'item-iso-dish',
  manlidAsm: 'item-iso-manlid',
  manlidFlange: 'item-iso-manlid-flange',
  manlidCover: 'item-iso-manlid-cover',
  safetyNozzle: 'item-iso-sv',
  frameAsm: 'item-iso-frame',
  endFrame: 'item-iso-end-frame',
  cornerCasting: 'item-iso-corner',
  walkwayAsm: 'item-iso-walkway',
  grating: 'item-iso-grating',
  paintAsm: 'item-sa-paint',
  primer: 'item-rm-primer',
  testAsm: 'item-iso-test',
  shellPlate: 'item-rm-plt',
  pipe: 'item-rm-pipe',
  frameSection: 'item-rm-angle',
} as const

export const ISO_TRAVELER_MASTERS_BOM_ID = 'bom-iso-a'
export const ISO_TRAVELER_MFG_BOM_ID = 'mfg-bom-003'

function mastersLine(
  id: string,
  parentLineId: string | null,
  itemId: string,
  nodeLevel: BomLine['nodeLevel'],
  qtyPerParent: number,
  sourceType: BomLine['sourceType'],
  sortOrder: number,
  standardCost: number,
  scrapPct = 0,
  leadTimeDays = 14,
  uomId = 'uom-nos',
  issueWarehouseId = 'wh-rm-main',
): BomLine {
  return {
    id,
    bomHeaderId: ISO_TRAVELER_MASTERS_BOM_ID,
    parentLineId,
    itemId,
    nodeLevel,
    qtyPerParent,
    uomId,
    scrapPct,
    sourceType,
    issueWarehouseId,
    leadTimeDays,
    standardCost,
    sortOrder,
  }
}

/** Multilevel masters BOM lines — mirrors traveler hierarchy (no PROC rows). */
export const isoTravelerMastersBomLines: BomLine[] = [
  mastersLine('bl-iso-100', null, ISO_TRAVELER_ITEM_IDS.pressureVessel, 'assembly', 1, 'make', 10, 0),
  mastersLine('bl-iso-110', 'bl-iso-100', ISO_TRAVELER_ITEM_IDS.shell, 'sub_assembly', 1, 'make', 11, 0, 0, 21),
  mastersLine(
    'bl-iso-110-plt',
    'bl-iso-110',
    ISO_TRAVELER_ITEM_IDS.shellPlate,
    'component',
    1450,
    'buy',
    12,
    68.5,
    5,
    10,
    'uom-kg',
  ),
  mastersLine('bl-iso-120', 'bl-iso-100', ISO_TRAVELER_ITEM_IDS.dish, 'component', 2, 'make', 13, 0, 0, 14),
  mastersLine('bl-iso-130', 'bl-iso-100', ISO_TRAVELER_ITEM_IDS.manlidAsm, 'sub_assembly', 1, 'make', 14, 0),
  mastersLine('bl-iso-131', 'bl-iso-130', ISO_TRAVELER_ITEM_IDS.manlidFlange, 'component', 1, 'buy', 15, 18500),
  mastersLine('bl-iso-132', 'bl-iso-130', ISO_TRAVELER_ITEM_IDS.manlidCover, 'component', 1, 'buy', 16, 12500),
  mastersLine('bl-iso-140', 'bl-iso-100', ISO_TRAVELER_ITEM_IDS.safetyNozzle, 'component', 1, 'buy', 17, 28500),
  mastersLine('bl-iso-100-pipe', 'bl-iso-100', ISO_TRAVELER_ITEM_IDS.pipe, 'component', 60, 'buy', 18, 1850, 3, 10, 'uom-mtr'),

  mastersLine('bl-iso-200', null, ISO_TRAVELER_ITEM_IDS.frameAsm, 'assembly', 1, 'make', 20, 0),
  mastersLine('bl-iso-210', 'bl-iso-200', ISO_TRAVELER_ITEM_IDS.endFrame, 'component', 2, 'make', 21, 0),
  mastersLine('bl-iso-220', 'bl-iso-200', ISO_TRAVELER_ITEM_IDS.cornerCasting, 'component', 8, 'buy', 22, 3500),
  mastersLine(
    'bl-iso-200-ang',
    'bl-iso-200',
    ISO_TRAVELER_ITEM_IDS.frameSection,
    'component',
    980,
    'buy',
    23,
    62,
    4,
    10,
    'uom-kg',
  ),

  mastersLine('bl-iso-300', null, ISO_TRAVELER_ITEM_IDS.walkwayAsm, 'assembly', 1, 'make', 30, 0),
  mastersLine('bl-iso-310', 'bl-iso-300', ISO_TRAVELER_ITEM_IDS.grating, 'component', 1, 'buy', 31, 18500),

  mastersLine('bl-iso-400', null, ISO_TRAVELER_ITEM_IDS.paintAsm, 'assembly', 1, 'subcontract', 40, 0, 0, 5),
  mastersLine(
    'bl-iso-401',
    'bl-iso-400',
    ISO_TRAVELER_ITEM_IDS.primer,
    'component',
    80,
    'buy',
    41,
    285,
    10,
    5,
    'uom-ltr',
    'wh-cons',
  ),

  mastersLine('bl-iso-500', null, ISO_TRAVELER_ITEM_IDS.testAsm, 'assembly', 1, 'make', 50, 0, 0, 3),
]

export const isoTravelerMastersBomHeader: BomHeader = {
  id: ISO_TRAVELER_MASTERS_BOM_ID,
  bomNo: ISO_TANK_26KL_TRAVELER_BOM.meta.bomNumber,
  productId: 'prod-iso',
  revision: ISO_TANK_26KL_TRAVELER_BOM.meta.revision,
  description:
    '26 KL ISO Tank Container — multilevel BOM from traveler preview (PROC rows on Traveler tab)',
  status: 'released',
  previousRevisionId: null,
  effectiveFrom: '2026-05-01',
  approvedBy: 'Arun Nair',
  approvedAt: '2026-06-25T10:00:00Z',
  submittedAt: '2026-06-20T11:00:00Z',
  submittedBy: 'Kavita Rao',
  totalCost: 0,
  createdAt: ts,
  updatedAt: ts,
}

function mfgLine(
  lineNo: number,
  itemId: string,
  code: string,
  name: string,
  qty: number,
  uom: string,
  scrap: number,
  stock: number,
  cost: number,
  supply: MfgBomLine['supplyMethod'],
  remarks: string,
): MfgBomLine {
  return {
    id: `mfg-bom-iso-line-${lineNo}`,
    lineNo,
    componentItemId: itemId,
    componentItemCode: code,
    componentItemName: name,
    requiredQuantity: qty,
    uom,
    warehouseId: 'wh-rm',
    warehouseName: 'RM Stores',
    scrapPercent: scrap,
    availableStock: stock,
    estimatedCost: cost,
    supplyMethod: supply,
    issueMethod: supply === 'vendor_supplied' ? 'manual' : 'auto',
    remarks,
  }
}

/** Manufacturing BOM for WO — leaf materials + key bought-outs from traveler. */
export const isoTravelerManufacturingBom: BillOfMaterial = {
  id: ISO_TRAVELER_MFG_BOM_ID,
  bomNumber: ISO_TANK_26KL_TRAVELER_BOM.meta.bomNumber,
  finishedItemId: 'item-fg-iso',
  finishedItemCode: 'FG-ISO-TANK-26K',
  finishedItemName: '26 KL ISO Tank Container',
  itemCategory: 'Finished Goods',
  productionQuantity: 1,
  baseUom: 'NOS',
  version: 'V1',
  effectiveFrom: '2026-05-01',
  effectiveTo: null,
  productionMethod: 'in_house',
  defaultMaterialWarehouseId: 'wh-rm',
  defaultMaterialWarehouseName: 'RM Stores',
  defaultFgWarehouseId: 'wh-fg',
  defaultFgWarehouseName: 'FG Stores',
  status: 'active',
  componentCount: 8,
  estimatedCost: 18_50_000,
  standardCost: 17_80_000,
  qualityRequired: true,
  autoConsumption: true,
  batchRequired: false,
  serialRequired: true,
  previousVersionId: null,
  createdAt: ts,
  updatedAt: ts,
  createdBy: 'Kavita Rao',
  lines: [
    mfgLine(1, 'item-rm-plt', 'RM-MS-PLT-16', 'SA 516 Gr 70 Plate (Shell / Dish)', 6800, 'KG', 5, 4200, 8_50_000, 'purchase', 'Traveler A.1 / A.2 · PROC P1–P5'),
    mfgLine(2, 'item-rm-pipe', 'RM-PIPE-150-CHS', 'CS Pipe / Nozzle stock', 60, 'M', 3, 120, 1_20_000, 'inventory', 'Traveler A.3 / A.4'),
    mfgLine(3, ISO_TRAVELER_ITEM_IDS.manlidFlange, 'ISO-MANLID-FLG', 'Manlid Nozzle Weld-In Flange', 1, 'NOS', 0, 6, 18_500, 'purchase', 'Traveler A.3.1'),
    mfgLine(4, ISO_TRAVELER_ITEM_IDS.manlidCover, 'ISO-MANLID-CVR', 'Manlid Cover with Gasket', 1, 'SET', 0, 4, 12_500, 'purchase', 'Traveler A.3.2'),
    mfgLine(5, ISO_TRAVELER_ITEM_IDS.safetyNozzle, 'ISO-SV-NOZ', 'Safety Valve / Relief Nozzle', 1, 'SET', 0, 4, 28_500, 'purchase', 'Traveler A.4'),
    mfgLine(6, ISO_TRAVELER_ITEM_IDS.cornerCasting, 'ISO-CORNER', 'ISO Corner Castings', 8, 'NOS', 0, 24, 28_000, 'purchase', 'Traveler B.2'),
    mfgLine(7, 'item-rm-angle', 'RM-ANGLE-75X75', 'High Tensile Frame Sections', 980, 'KG', 4, 1500, 2_20_000, 'inventory', 'Traveler B · Frame'),
    mfgLine(8, 'item-rm-primer', 'RM-PRIMER-RO', 'Epoxy Primer / Paint System', 80, 'LTR', 10, 200, 35_000, 'inventory', 'Traveler D · PROC paint'),
  ],
}

export function getTravelerDocumentForManufacturingBom(bomId: string) {
  if (bomId === ISO_TRAVELER_MFG_BOM_ID) return ISO_TANK_26KL_TRAVELER_BOM
  return null
}

export function getTravelerDocumentForMastersBom(bomHeaderId: string) {
  if (bomHeaderId === ISO_TRAVELER_MASTERS_BOM_ID) return ISO_TANK_26KL_TRAVELER_BOM
  return null
}
