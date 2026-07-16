/**
 * Stock count demo seed data (Phase 5).
 */

import type { StockCount, StockCountLine, StockCountScope } from '../../types/inventoryDomain'

let countSeq = 1000

export function nextCountNumber(): string {
  countSeq += 1
  return `SC-${String(countSeq).padStart(5, '0')}`
}

export function resetStockCountSequencesForTests() {
  countSeq = 1000
}

/** Variance qty tolerance before recount is required */
export const STOCK_COUNT_VARIANCE_TOLERANCE_QTY = 5

/** High-value variance threshold (INR) requiring supervisor approval */
export const STOCK_COUNT_HIGH_VALUE_THRESHOLD = 50_000

export function buildScope(
  partial: Partial<StockCountScope> & Pick<StockCountScope, 'countType' | 'warehouseId' | 'warehouseName' | 'countDate' | 'assignedTeam' | 'blindCount'>,
): StockCountScope {
  return {
    categoryId: null,
    categoryName: null,
    itemId: null,
    itemCode: null,
    binLocationId: null,
    binCode: null,
    batchNo: null,
    ...partial,
  }
}

export function buildCountLine(
  partial: Partial<StockCountLine> & Pick<StockCountLine, 'lineNo' | 'itemId' | 'itemCode' | 'itemName' | 'snapshotSystemQty' | 'systemQty' | 'unitCost'>,
): StockCountLine {
  const variance = partial.variance ?? 0
  const unitCost = partial.unitCost
  return {
    id: partial.id ?? `scl-${partial.lineNo}-${partial.itemId}`,
    batchNo: null,
    binCode: null,
    countedQty: null,
    recountQty: null,
    variance,
    differenceValue: variance * unitCost,
    reason: '',
    lineStatus: 'pending',
    previousCountQty: null,
    previousCountDate: null,
    movementAfterSnapshot: 0,
    systemQtyRevealed: false,
    revealReason: null,
    ...partial,
  }
}

function audit(action: string, user = 'Demo User', remarks: string | null = null, snapshotData?: Record<string, unknown>) {
  return {
    id: `sca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    userName: user,
    timestamp: new Date().toISOString(),
    remarks,
    snapshotData,
  }
}

/** Pre-seeded counts for register demo */
export function buildSeedStockCounts(): StockCount[] {
  const whMain = { warehouseId: 'wh-raw-001', warehouseName: 'Raw Material Store' }
  const whFg = { warehouseId: 'wh-fg-001', warehouseName: 'Finished Goods Store' }

  const scope1 = buildScope({
    countType: 'warehouse',
    ...whMain,
    countDate: '2026-07-10',
    assignedTeam: ['Ramesh Kumar', 'Suresh Patel'],
    blindCount: false,
  })

  const lines1: StockCountLine[] = [
    buildCountLine({
      lineNo: 1,
      itemId: 'item-ms-plate-10mm',
      itemCode: 'MS-PLATE-10MM',
      itemName: 'MS Plate 10mm',
      snapshotSystemQty: 120,
      systemQty: 118,
      unitCost: 85,
      countedQty: 115,
      variance: -5,
      differenceValue: -425,
      reason: 'Damaged sheets found during count',
      lineStatus: 'variance',
      movementAfterSnapshot: -2,
      previousCountQty: 122,
      previousCountDate: '2026-04-15',
    }),
    buildCountLine({
      lineNo: 2,
      itemId: 'item-angle-75x75',
      itemCode: 'ANGLE-75X75',
      itemName: 'MS Angle 75x75',
      snapshotSystemQty: 200,
      systemQty: 200,
      unitCost: 62,
      countedQty: 200,
      variance: 0,
      differenceValue: 0,
      reason: '',
      lineStatus: 'counted',
    }),
    buildCountLine({
      lineNo: 3,
      itemId: 'item-paint-primer',
      itemCode: 'PAINT-PRIMER-RD',
      itemName: 'Red Oxide Primer 20L',
      snapshotSystemQty: 48,
      systemQty: 46,
      unitCost: 1850,
      countedQty: 40,
      variance: -8,
      differenceValue: -14800,
      reason: 'Unrecorded consumption',
      lineStatus: 'recount_required',
      movementAfterSnapshot: -2,
    }),
  ]

  const count1: StockCount = {
    id: 'sc-seed-001',
    countNumber: 'SC-01001',
    scope: scope1,
    status: 'recount_required',
    currentStep: 5,
    lines: lines1,
    itemCount: 3,
    countedItems: 3,
    differenceItems: 2,
    differenceValue: -15225,
    assignedTo: 'Ramesh Kumar',
    snapshotAt: '2026-07-10T09:00:00.000Z',
    submittedAt: '2026-07-10T14:30:00.000Z',
    approvedAt: null,
    approvedBy: null,
    postedAt: null,
    postedBy: null,
    varianceApprovalRequired: true,
    varianceApproved: false,
    varianceRejected: false,
    adjustmentPreview: null,
    auditHistory: [
      audit('Created', 'Ramesh Kumar', 'Warehouse count initiated'),
      audit('Snapshot Created', 'System', 'Stock snapshot created in frontend demo mode.', {
        lineCount: 3,
        warehouseId: whMain.warehouseId,
      }),
      audit('Submitted for Review', 'Ramesh Kumar'),
      audit('Recount Requested', 'Store Manager', 'Variance exceeds tolerance on PAINT-PRIMER-RD'),
    ],
    createdAt: '2026-07-10T08:45:00.000Z',
    updatedAt: '2026-07-10T15:00:00.000Z',
    createdBy: 'Ramesh Kumar',
  }

  const scope2 = buildScope({
    countType: 'cycle',
    ...whFg,
    countDate: '2026-07-12',
    assignedTeam: ['Anita Desai'],
    blindCount: true,
  })

  const lines2: StockCountLine[] = [
    buildCountLine({
      lineNo: 1,
      itemId: 'item-trailer-20ft',
      itemCode: 'TRL-20FT-STD',
      itemName: '20ft Standard Trailer',
      snapshotSystemQty: 6,
      systemQty: 6,
      unitCost: 285000,
      countedQty: 6,
      variance: 0,
      lineStatus: 'counted',
    }),
    buildCountLine({
      lineNo: 2,
      itemId: 'item-trailer-40ft',
      itemCode: 'TRL-40FT-HVY',
      itemName: '40ft Heavy Duty Trailer',
      snapshotSystemQty: 3,
      systemQty: 3,
      unitCost: 420000,
      countedQty: 2,
      variance: -1,
      differenceValue: -420000,
      reason: 'One unit dispatched but not issued in system',
      lineStatus: 'variance',
    }),
  ]

  const count2: StockCount = {
    id: 'sc-seed-002',
    countNumber: 'SC-01002',
    scope: scope2,
    status: 'under_review',
    currentStep: 6,
    lines: lines2,
    itemCount: 2,
    countedItems: 2,
    differenceItems: 1,
    differenceValue: -420000,
    assignedTo: 'Anita Desai',
    snapshotAt: '2026-07-12T10:00:00.000Z',
    submittedAt: '2026-07-12T16:00:00.000Z',
    approvedAt: null,
    approvedBy: null,
    postedAt: null,
    postedBy: null,
    varianceApprovalRequired: true,
    varianceApproved: false,
    varianceRejected: false,
    adjustmentPreview: null,
    auditHistory: [
      audit('Created', 'Anita Desai', 'Blind cycle count'),
      audit('Snapshot Created', 'System', 'Stock snapshot created in frontend demo mode.', { blindCount: true }),
      audit('Submitted for Review', 'Anita Desai'),
    ],
    createdAt: '2026-07-12T09:30:00.000Z',
    updatedAt: '2026-07-12T16:30:00.000Z',
    createdBy: 'Anita Desai',
  }

  const scope3 = buildScope({
    countType: 'category',
    ...whMain,
    categoryId: 'cat-consumables',
    categoryName: 'Consumables',
    countDate: '2026-06-28',
    assignedTeam: ['Vijay Singh'],
    blindCount: false,
  })

  const lines3: StockCountLine[] = [
    buildCountLine({
      lineNo: 1,
      itemId: 'item-welding-rod',
      itemCode: 'WELD-ROD-E7018',
      itemName: 'Welding Rod E7018 5kg',
      snapshotSystemQty: 85,
      systemQty: 85,
      unitCost: 420,
      countedQty: 85,
      variance: 0,
      lineStatus: 'accepted',
    }),
  ]

  const count3: StockCount = {
    id: 'sc-seed-003',
    countNumber: 'SC-01003',
    scope: scope3,
    status: 'posted',
    currentStep: 8,
    lines: lines3,
    itemCount: 1,
    countedItems: 1,
    differenceItems: 0,
    differenceValue: 0,
    assignedTo: 'Vijay Singh',
    snapshotAt: '2026-06-28T08:00:00.000Z',
    submittedAt: '2026-06-28T12:00:00.000Z',
    approvedAt: '2026-06-28T13:00:00.000Z',
    approvedBy: 'Store Manager',
    postedAt: '2026-06-28T14:00:00.000Z',
    postedBy: 'Store Manager',
    varianceApprovalRequired: false,
    varianceApproved: true,
    varianceRejected: false,
    adjustmentPreview: {
      countId: 'sc-seed-003',
      countNumber: 'SC-01003',
      lines: [],
      totalQtyImpact: 0,
      totalValueImpact: 0,
      narration: 'No adjustment required — count matched snapshot.',
      demoOnly: true,
    },
    auditHistory: [
      audit('Created', 'Vijay Singh'),
      audit('Snapshot Created', 'System', 'Stock snapshot created in frontend demo mode.'),
      audit('Submitted', 'Vijay Singh'),
      audit('Variance Approved', 'Store Manager'),
      audit('Posted Demo', 'Store Manager', 'Demo posting — no real stock adjustment'),
    ],
    createdAt: '2026-06-28T07:30:00.000Z',
    updatedAt: '2026-06-28T14:00:00.000Z',
    createdBy: 'Vijay Singh',
  }

  const scope4 = buildScope({
    countType: 'full_physical',
    warehouseId: 'wh-raw-001',
    warehouseName: 'Raw Material Store',
    countDate: '2026-07-15',
    assignedTeam: ['Ramesh Kumar', 'Suresh Patel', 'Vijay Singh'],
    blindCount: false,
  })

  const count4: StockCount = {
    id: 'sc-seed-004',
    countNumber: 'SC-01004',
    scope: scope4,
    status: 'draft',
    currentStep: 1,
    lines: [],
    itemCount: 0,
    countedItems: 0,
    differenceItems: 0,
    differenceValue: 0,
    assignedTo: 'Ramesh Kumar',
    snapshotAt: null,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    postedAt: null,
    postedBy: null,
    varianceApprovalRequired: false,
    varianceApproved: false,
    varianceRejected: false,
    adjustmentPreview: null,
    auditHistory: [audit('Created', 'Ramesh Kumar', 'Full physical verification planned')],
    createdAt: '2026-07-15T06:00:00.000Z',
    updatedAt: '2026-07-15T06:00:00.000Z',
    createdBy: 'Ramesh Kumar',
  }

  const scope5 = buildScope({
    countType: 'bin',
    ...whMain,
    binLocationId: 'loc-a1-01',
    binCode: 'A1-01',
    countDate: '2026-07-14',
    assignedTeam: ['Suresh Patel'],
    blindCount: true,
  })

  const count5: StockCount = {
    id: 'sc-seed-005',
    countNumber: 'SC-01005',
    scope: scope5,
    status: 'counting',
    currentStep: 3,
    lines: [
      buildCountLine({
        lineNo: 1,
        itemId: 'item-bolt-m12',
        itemCode: 'BOLT-M12X40',
        itemName: 'Hex Bolt M12x40',
        batchNo: 'B-BOLT-M12X40-001',
        binCode: 'A1-01',
        snapshotSystemQty: 500,
        systemQty: 500,
        unitCost: 12,
        countedQty: null,
        variance: 0,
        lineStatus: 'pending',
      }),
    ],
    itemCount: 1,
    countedItems: 0,
    differenceItems: 0,
    differenceValue: 0,
    assignedTo: 'Suresh Patel',
    snapshotAt: '2026-07-14T11:00:00.000Z',
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    postedAt: null,
    postedBy: null,
    varianceApprovalRequired: false,
    varianceApproved: false,
    varianceRejected: false,
    adjustmentPreview: null,
    auditHistory: [
      audit('Created', 'Suresh Patel'),
      audit('Snapshot Created', 'System', 'Stock snapshot created in frontend demo mode.', { binCode: 'A1-01' }),
    ],
    createdAt: '2026-07-14T10:30:00.000Z',
    updatedAt: '2026-07-14T11:00:00.000Z',
    createdBy: 'Suresh Patel',
  }

  return [count1, count2, count3, count4, count5]
}
