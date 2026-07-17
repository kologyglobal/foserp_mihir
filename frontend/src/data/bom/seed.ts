import type { BomHeader, BomLine } from '../../types/bom'
import { seedCategories, seedItems } from '../masters/seed'
import {
  isoTravelerMastersBomHeader,
  isoTravelerMastersBomLines,
} from './isoTravelerBomSeed'

const now = () => new Date().toISOString()
const ts = now()

function lineDefaults(itemId: string) {
  const item = seedItems.find((i) => i.id === itemId)!
  const cat = seedCategories.find((c) => c.id === item.categoryId)
  return {
    uomId: item.baseUomId,
    issueWarehouseId: cat?.defaultWarehouseId ?? 'wh-rm-main',
  }
}

function line(
  id: string,
  bomHeaderId: string,
  parentLineId: string | null,
  itemId: string,
  nodeLevel: BomLine['nodeLevel'],
  qtyPerParent: number,
  scrapPct: number,
  sourceType: BomLine['sourceType'],
  leadTimeDays: number,
  standardCost: number,
  sortOrder: number,
  overrides?: { issueWarehouseId?: string; uomId?: string },
): BomLine {
  const defaults = lineDefaults(itemId)
  return {
    id,
    bomHeaderId,
    parentLineId,
    itemId,
    nodeLevel,
    qtyPerParent,
    uomId: overrides?.uomId ?? defaults.uomId,
    scrapPct,
    sourceType,
    issueWarehouseId: overrides?.issueWarehouseId ?? defaults.issueWarehouseId,
    leadTimeDays,
    standardCost,
    sortOrder,
  }
}

export const seedBomHeaders: BomHeader[] = [
  {
    id: 'bom-bulker-a',
    bomNo: 'BOM-45M3-001',
    productId: 'prod-45m3',
    revision: 'Rev-A',
    description: '45 M3 Bulker Trailer — Standard BOM',
    status: 'released',
    previousRevisionId: null,
    effectiveFrom: '2026-04-01',
    approvedBy: 'Arun Nair',
    approvedAt: '2026-04-15T10:00:00Z',
    submittedAt: '2026-04-10T09:00:00Z',
    submittedBy: 'Engineering',
    totalCost: 0,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: 'bom-bulker-b',
    bomNo: 'BOM-45M3-001',
    productId: 'prod-45m3',
    revision: 'Rev-B',
    description: '45 M3 Bulker — Upgraded running gear spec',
    status: 'draft',
    previousRevisionId: 'bom-bulker-a',
    effectiveFrom: '2026-07-01',
    approvedBy: null,
    approvedAt: null,
    submittedAt: null,
    submittedBy: null,
    totalCost: 0,
    createdAt: ts,
    updatedAt: ts,
  },
  isoTravelerMastersBomHeader,
]

export const seedBomLines: BomLine[] = [
  line('bl-b-a-20', 'bom-bulker-a', null, 'item-sa-run-gear', 'assembly', 1, 0, 'make', 21, 0, 20),
  line('bl-b-a-21', 'bom-bulker-a', 'bl-b-a-20', 'item-bo-axl', 'component', 1, 0, 'buy', 21, 485000, 21),
  line('bl-b-a-22', 'bom-bulker-a', 'bl-b-a-20', 'item-bo-susp', 'component', 1, 0, 'buy', 21, 125000, 22),
  line('bl-b-a-23', 'bom-bulker-a', 'bl-b-a-20', 'item-bo-tyre', 'component', 12, 0, 'buy', 7, 22500, 23),
  line('bl-b-a-24', 'bom-bulker-a', 'bl-b-a-20', 'item-bo-rim', 'component', 12, 0, 'buy', 7, 8200, 24),

  line('bl-b-a-10', 'bom-bulker-a', null, 'item-sa-tank-asm', 'assembly', 1, 0, 'make', 30, 0, 10),
  line('bl-b-a-11', 'bom-bulker-a', 'bl-b-a-10', 'item-rm-plt', 'component', 4200, 5, 'buy', 10, 68.5, 11, { issueWarehouseId: 'wh-rm-main' }),
  line('bl-b-a-12', 'bom-bulker-a', 'bl-b-a-10', 'item-rm-pipe', 'component', 48, 3, 'buy', 10, 1850, 12, { issueWarehouseId: 'wh-rm-main' }),
  line('bl-b-a-13', 'bom-bulker-a', 'bl-b-a-10', 'item-rm-angle', 'component', 120, 3, 'buy', 10, 620, 13, { issueWarehouseId: 'wh-rm-main' }),

  line('bl-b-a-30', 'bom-bulker-a', null, 'item-sa-chassis', 'assembly', 1, 0, 'make', 14, 0, 30),
  line('bl-b-a-31', 'bom-bulker-a', 'bl-b-a-30', 'item-bo-kpin', 'component', 1, 0, 'buy', 14, 18500, 31),
  line('bl-b-a-32', 'bom-bulker-a', 'bl-b-a-30', 'item-bo-lj', 'component', 2, 0, 'buy', 14, 12800, 32),

  line('bl-b-a-40', 'bom-bulker-a', null, 'item-sa-paint', 'assembly', 1, 0, 'subcontract', 5, 0, 40),
  line('bl-b-a-41', 'bom-bulker-a', 'bl-b-a-40', 'item-rm-primer', 'component', 40, 10, 'buy', 5, 285, 41, { issueWarehouseId: 'wh-cons' }),

  line('bl-b-a-50', 'bom-bulker-a', null, 'item-bo-airtank', 'component', 2, 0, 'buy', 7, 6500, 50),

  line('bl-b-b-20', 'bom-bulker-b', null, 'item-sa-run-gear', 'assembly', 1, 0, 'make', 21, 0, 20),
  line('bl-b-b-21', 'bom-bulker-b', 'bl-b-b-20', 'item-bo-axl', 'component', 1, 0, 'buy', 21, 485000, 21),
  line('bl-b-b-22', 'bom-bulker-b', 'bl-b-b-20', 'item-bo-susp', 'component', 1, 0, 'buy', 21, 125000, 22),
  line('bl-b-b-23', 'bom-bulker-b', 'bl-b-b-20', 'item-bo-tyre', 'component', 14, 0, 'buy', 7, 22500, 23),
  line('bl-b-b-24', 'bom-bulker-b', 'bl-b-b-20', 'item-bo-rim', 'component', 14, 0, 'buy', 7, 8200, 24),

  // 26 KL ISO Tank — created from traveler preview data
  ...isoTravelerMastersBomLines,
]
