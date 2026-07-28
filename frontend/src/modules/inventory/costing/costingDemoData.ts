import type {
  InventoryCostEntryDto,
  InventoryCostLayerDto,
  ValuationReconciliationDto,
} from '@/services/api/inventoryCostingApi'

export const DEMO_COST_ENTRIES: InventoryCostEntryDto[] = [
  {
    id: 'demo-ce-1',
    itemId: 'demo-item-steel',
    warehouseId: 'demo-wh-rm',
    inventoryMovementId: 'demo-mv-1',
    entryType: 'RECEIPT',
    valuationMethod: 'FIFO',
    quantity: '100.0000',
    unitCost: '85.0000',
    totalCost: '8500.0000',
    postingDate: '2026-07-20T00:00:00.000Z',
    sourceType: 'GOODS_RECEIPT',
    sourceId: 'demo-grn-1',
    workOrderId: null,
    costLayerId: 'demo-layer-1',
    lotId: null,
    serialId: null,
    isReversal: false,
    status: 'POSTED',
    createdAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'demo-ce-2',
    itemId: 'demo-item-steel',
    warehouseId: 'demo-wh-rm',
    inventoryMovementId: 'demo-mv-2',
    entryType: 'ISSUE',
    valuationMethod: 'FIFO',
    quantity: '25.0000',
    unitCost: '85.0000',
    totalCost: '2125.0000',
    postingDate: '2026-07-22T00:00:00.000Z',
    sourceType: 'ISSUE_TO_WO',
    sourceId: 'demo-wo-1',
    workOrderId: 'demo-wo-1',
    costLayerId: null,
    lotId: null,
    serialId: null,
    isReversal: false,
    status: 'POSTED',
    createdAt: '2026-07-22T11:00:00.000Z',
  },
  {
    id: 'demo-ce-3',
    itemId: 'demo-item-axle',
    warehouseId: 'demo-wh-fg',
    inventoryMovementId: 'demo-mv-3',
    entryType: 'ISSUE',
    valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
    quantity: '2.0000',
    unitCost: '125000.0000',
    totalCost: '250000.0000',
    postingDate: '2026-07-24T00:00:00.000Z',
    sourceType: 'FG_DISPATCH',
    sourceId: 'demo-disp-1',
    workOrderId: null,
    costLayerId: null,
    lotId: null,
    serialId: 'demo-serial-1',
    isReversal: false,
    status: 'POSTED',
    createdAt: '2026-07-24T14:00:00.000Z',
  },
]

export const DEMO_COST_LAYERS: InventoryCostLayerDto[] = [
  {
    id: 'demo-layer-1',
    itemId: 'demo-item-steel',
    warehouseId: 'demo-wh-rm',
    sourceMovementId: 'demo-mv-1',
    receiptDate: '2026-07-20T00:00:00.000Z',
    postingDate: '2026-07-20T00:00:00.000Z',
    originalQuantity: '100.0000',
    remainingQuantity: '75.0000',
    unitCost: '85.0000',
    originalValue: '8500.0000',
    remainingValue: '6375.0000',
    status: 'OPEN',
    lotId: null,
    serialId: null,
    createdAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'demo-layer-2',
    itemId: 'demo-item-axle',
    warehouseId: 'demo-wh-fg',
    sourceMovementId: 'demo-mv-fg',
    receiptDate: '2026-07-18T00:00:00.000Z',
    postingDate: '2026-07-18T00:00:00.000Z',
    originalQuantity: '1.0000',
    remainingQuantity: '1.0000',
    unitCost: '118500.0000',
    originalValue: '118500.0000',
    remainingValue: '118500.0000',
    status: 'OPEN',
    lotId: null,
    serialId: 'demo-serial-2',
    createdAt: '2026-07-18T09:00:00.000Z',
  },
]

export const DEMO_RECON: ValuationReconciliationDto = {
  valuationMethod: 'FIFO',
  total: 2,
  mismatched: 0,
  items: [
    {
      itemId: 'demo-item-steel',
      warehouseId: 'demo-wh-rm',
      item: { id: 'demo-item-steel', code: 'RM-STEEL', name: 'Structural steel' },
      warehouse: { id: 'demo-wh-rm', code: 'RM', name: 'Raw material' },
      valuationMethod: 'FIFO',
      onHandQty: '75.0000',
      layerRemainingQty: '75.0000',
      qtyDifference: '0.0000',
      stockValue: '6375.0000',
      layerRemainingValue: '6375.0000',
      valueDifference: '0.0000',
      status: 'MATCHED',
    },
  ],
}

export function methodLabel(method: string): string {
  switch (method) {
    case 'FIFO':
      return 'FIFO'
    case 'MOVING_WEIGHTED_AVERAGE':
      return 'Moving average'
    case 'STANDARD_COST':
      return 'Standard cost'
    case 'SPECIFIC_IDENTIFICATION':
      return 'Specific identification'
    default:
      return method.replace(/_/g, ' ')
  }
}
