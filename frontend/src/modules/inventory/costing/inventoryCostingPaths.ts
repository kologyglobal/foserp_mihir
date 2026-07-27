export const inventoryCostingBase = '/inventory/costing'

export const inventoryCostingPaths = {
  summary: `${inventoryCostingBase}`,
  entries: `${inventoryCostingBase}/entries`,
  entry: (id: string) => `${inventoryCostingBase}/entries/${id}`,
  layers: `${inventoryCostingBase}/layers`,
  layer: (id: string) => `${inventoryCostingBase}/layers/${id}`,
  average: `${inventoryCostingBase}/average`,
  standard: `${inventoryCostingBase}/standard`,
  specific: `${inventoryCostingBase}/specific`,
  reconciliation: `${inventoryCostingBase}/reconciliation`,
  methodChange: `${inventoryCostingBase}/method-change`,
  /** Deep-link helpers for source documents */
  forMovement: (movementId: string) => `${inventoryCostingBase}/entries?movementId=${encodeURIComponent(movementId)}`,
  forWorkOrder: (workOrderId: string) => `${inventoryCostingBase}/entries?workOrderId=${encodeURIComponent(workOrderId)}`,
  forItem: (itemId: string) => `${inventoryCostingBase}/entries?itemId=${encodeURIComponent(itemId)}`,
} as const

export const COSTING_SUBNAV = [
  { label: 'Valuation Summary', path: inventoryCostingPaths.summary, end: true },
  { label: 'Cost Entries', path: inventoryCostingPaths.entries },
  { label: 'FIFO Layers', path: inventoryCostingPaths.layers },
  { label: 'Average Cost', path: inventoryCostingPaths.average },
  { label: 'Standard Cost', path: inventoryCostingPaths.standard },
  { label: 'Specific ID', path: inventoryCostingPaths.specific },
  { label: 'Reconciliation', path: inventoryCostingPaths.reconciliation },
  { label: 'Method Change', path: inventoryCostingPaths.methodChange },
] as const
