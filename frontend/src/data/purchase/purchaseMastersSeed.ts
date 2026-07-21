import type { PurchaseMasterEntry, PurchaseMasterKind } from '../../types/purchaseMasters'

const NOW = '2026-01-15T10:00:00.000Z'

function entry(
  kind: PurchaseMasterKind,
  code: string,
  name: string,
  sortOrder: number,
  attributes: Record<string, string | number | boolean | null> = {},
  extra?: Partial<Pick<PurchaseMasterEntry, 'description' | 'systemControlled' | 'status' | 'id'>>,
): PurchaseMasterEntry {
  return {
    id: extra?.id ?? `${kind}-${code}`,
    kind,
    code,
    name,
    status: extra?.status ?? 'active',
    sortOrder,
    description: extra?.description,
    attributes,
    systemControlled: extra?.systemControlled,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'System',
    modifiedBy: 'System',
  }
}

export const PURCHASE_MASTERS_SEED: PurchaseMasterEntry[] = [
  entry('freight-terms', 'freight_extra', 'Freight Extra', 1, { freightIncluded: false }),
  entry('freight-terms', 'freight_included', 'Freight Included', 2, { freightIncluded: true }),
  entry('freight-terms', 'to_pay', 'To Pay at Destination', 3, { freightIncluded: false }),

  entry('qc-rules', 'plt_incoming', 'Plate — Incoming QC', 1, {
    scopeType: 'item',
    itemId: 'item-rm-plt',
    requiresIncomingQc: true,
  }),
  entry('qc-rules', 'pipe_incoming', 'Pipe — Incoming QC', 2, {
    scopeType: 'item',
    itemId: 'item-rm-pipe',
    requiresIncomingQc: true,
  }),
  entry('qc-rules', 'angle_incoming', 'Angle — Incoming QC', 3, {
    scopeType: 'item',
    itemId: 'item-rm-angle',
    requiresIncomingQc: true,
  }),
  entry('qc-rules', 'axle_incoming', 'Axle — Incoming QC', 4, {
    scopeType: 'item',
    itemId: 'item-bo-axl',
    requiresIncomingQc: true,
  }),
  entry('qc-rules', 'valve_incoming', 'Valve — Incoming QC', 5, {
    scopeType: 'item',
    itemId: 'item-bo-valve',
    requiresIncomingQc: true,
  }),

  entry('grn-tolerance', 'default', 'Default GRN Tolerance', 1, { scopeType: 'default', tolerancePct: 5 }, { systemControlled: true }),
  entry('grn-tolerance', 'steel_rm', 'Steel RM — 3% Tolerance', 2, {
    scopeType: 'category',
    categoryId: 'cat-rm-steel',
    tolerancePct: 3,
  }),

  entry('buyers', 'buyer-demo', 'Demo User', 1, {
    employeeCode: 'EMP-001',
    email: 'demo@vasant.in',
    department: 'Purchase',
  }),
  entry('buyers', 'buyer-head', 'Purchase Head', 2, {
    employeeCode: 'EMP-PUR-01',
    email: 'purchase.head@vasant.in',
    department: 'Purchase',
  }),

  entry('return-reasons', 'qc_rejection', 'QC Rejection', 1, { requiresApproval: true }),
  entry('return-reasons', 'short_supply', 'Short Supply', 2, { requiresApproval: false }),
  entry('return-reasons', 'damage_transit', 'Damage in Transit', 3, { requiresApproval: true }),
  entry('return-reasons', 'wrong_item', 'Wrong Item Supplied', 4, { requiresApproval: true }),
  entry('return-reasons', 'rate_dispute', 'Rate Dispute', 5, { requiresApproval: true }),

  entry('bin-codes', 'A1-01', 'Rack A / Bin 01', 1, { warehouseCode: 'WH-MAIN', locationCode: 'MAIN' }),
  entry('bin-codes', 'A1-02', 'Rack A / Bin 02', 2, { warehouseCode: 'WH-MAIN', locationCode: 'MAIN' }),
  entry('bin-codes', 'B2-01', 'Rack B / Bin 01', 3, { warehouseCode: 'WH-MAIN', locationCode: 'MAIN' }),
  entry('bin-codes', 'C3-01', 'Rack C / Quarantine', 4, { warehouseCode: 'WH-QC', locationCode: 'QC' }),
  entry('bin-codes', 'FG-01', 'Finished Goods Bin 01', 5, { warehouseCode: 'WH-FG', locationCode: 'FG' }),
]

export const PURCHASE_MASTER_SETTINGS_SEED = {
  defaultGrnTolerancePct: 5,
}
