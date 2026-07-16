/** Operational report row types — tabular outputs, not dashboard aggregates */

export type StockAgeBucket = '0-30' | '31-60' | '61-90' | '90+'

export interface StockAgingRow {
  itemId: string
  itemCode: string
  itemName: string
  warehouseCode: string
  warehouseName: string
  onHand: number
  uomCode: string
  stockValue: number
  lastMovementDate: string
  ageDays: number
  ageBucket: StockAgeBucket
}

export interface NegativeStockRow {
  itemId: string
  itemCode: string
  itemName: string
  warehouseCode: string
  onHand: number
  uomCode: string
  lastMovementDate: string
}

export interface SlowMovingRow {
  itemId: string
  itemCode: string
  itemName: string
  warehouseCode: string
  onHand: number
  uomCode: string
  stockValue: number
  lastIssueDate: string | null
  daysSinceIssue: number
}

export interface WoStatusRow {
  woId: string
  woNo: string
  salesOrderNo: string
  productName: string
  outputItemCode: string
  qty: number
  status: string
  plannedStartDate: string
  plannedFinishDate: string
  isOverdue: boolean
}

export interface WipAgingRow {
  woId: string
  woNo: string
  salesOrderNo: string
  productName: string
  status: string
  wipStartDate: string
  ageDays: number
  plannedFinishDate: string
  daysOverdue: number
}

export interface ReworkTrendRow {
  period: string
  opened: number
  completed: number
  openAtPeriodEnd: number
}

export interface OpenSalesOrderRow {
  salesOrderId: string
  salesOrderNo: string
  customerName: string
  productName: string
  qty: number
  status: string
  requiredDate: string
  grandTotal: number | null
  daysToDelivery: number
  isOverdue: boolean
}

export interface DeliveryCommitmentRow {
  salesOrderId: string
  salesOrderNo: string
  customerName: string
  productName: string
  qty: number
  requiredDate: string
  status: string
  commitmentRisk: 'on_track' | 'at_risk' | 'overdue'
}

export interface ReportDefinition {
  id: string
  module: 'inventory' | 'purchase' | 'production' | 'quality' | 'dispatch' | 'sales' | 'products' | 'crm'
  title: string
  description: string
  path: string
}

export const OPERATIONAL_REPORTS: ReportDefinition[] = [
  { id: 'stock-aging', module: 'inventory', title: 'Stock Aging', description: 'On-hand inventory by days since last movement', path: '/reports/inventory/stock-aging' },
  { id: 'negative-stock', module: 'inventory', title: 'Negative Stock', description: 'Item/warehouse positions below zero', path: '/reports/inventory/negative-stock' },
  { id: 'slow-moving', module: 'inventory', title: 'Slow Moving', description: 'Stock with no issue activity in 90+ days', path: '/reports/inventory/slow-moving' },
  { id: 'open-po', module: 'purchase', title: 'Open PO', description: 'Sent and partially received purchase orders', path: '/reports/purchase/open-po' },
  { id: 'delayed-po', module: 'purchase', title: 'Delayed PO', description: 'Open POs past expected delivery date', path: '/reports/purchase/delayed-po' },
  { id: 'wo-status', module: 'production', title: 'WO Status', description: 'Active work orders by status and schedule', path: '/reports/production/wo-status' },
  { id: 'wip-aging', module: 'production', title: 'WIP Aging', description: 'In-progress work orders by days in WIP', path: '/reports/production/wip-aging' },
  { id: 'ncr-aging', module: 'quality', title: 'NCR Aging', description: 'Open NCRs older than 7 days', path: '/reports/quality/ncr-aging' },
  { id: 'rework-trend', module: 'quality', title: 'Rework Trend', description: 'Monthly rework orders opened vs completed', path: '/reports/quality/rework-trend' },
  { id: 'pending-dispatch', module: 'dispatch', title: 'Pending Dispatch', description: 'Dispatch plans not yet confirmed', path: '/reports/dispatch/pending-dispatch' },
  { id: 'pod-pending', module: 'dispatch', title: 'POD Pending', description: 'Dispatched units awaiting proof of delivery', path: '/reports/dispatch/pod-pending' },
  { id: 'open-orders', module: 'sales', title: 'Open Orders', description: 'Sales orders not yet closed or invoiced', path: '/reports/sales/open-orders' },
  { id: 'delivery-commitments', module: 'sales', title: 'Delivery Commitments', description: 'Committed delivery dates and risk status', path: '/reports/sales/delivery-commitments' },
  { id: 'product-revision', module: 'products', title: 'Product Revision Report', description: 'Current revision, engineering owner, effective dates', path: '/reports/products/revision' },
  { id: 'obsolete-products', module: 'products', title: 'Obsolete Product Report', description: 'Products marked obsolete', path: '/reports/products/obsolete' },
  { id: 'product-cost', module: 'products', title: 'Product Cost Report', description: 'Standard material, labor, machine, overhead costs', path: '/reports/products/cost' },
  { id: 'product-usage', module: 'products', title: 'Product Usage Report', description: 'Open SO/WO count and pipeline revenue by product', path: '/reports/products/usage' },
  { id: 'engineering-change', module: 'products', title: 'Engineering Change Report', description: 'Product master change log across all products', path: '/reports/products/engineering-change' },
  { id: 'crm-pipeline', module: 'crm', title: 'Opportunity Pipeline', description: 'All opportunities with stage, value and owner', path: '/reports/crm/pipeline' },
  { id: 'crm-stage-wise', module: 'crm', title: 'Stage-wise Opportunities', description: 'Opportunity count and value by pipeline stage', path: '/reports/crm/stage-wise' },
  { id: 'crm-follow-up-due', module: 'crm', title: 'Follow-up Due', description: 'Pending and overdue follow-ups', path: '/reports/crm/follow-up-due' },
  { id: 'crm-sales-activity', module: 'crm', title: 'Sales Activity', description: 'CRM activity history log', path: '/reports/crm/sales-activity' },
  { id: 'crm-quotation-revision', module: 'crm', title: 'Quotation Revision', description: 'Quotation document revisions and lock status', path: '/reports/crm/quotation-revision' },
  { id: 'crm-quotation-approval', module: 'crm', title: 'Quotation Approval', description: 'Quotation approval timeline entries', path: '/reports/crm/quotation-approval' },
  { id: 'crm-won-lost', module: 'crm', title: 'Won / Lost Deals', description: 'Closed opportunities with outcomes', path: '/reports/crm/won-lost' },
  { id: 'crm-customer-pipeline', module: 'crm', title: 'Customer Pipeline', description: 'Open pipeline value by customer', path: '/reports/crm/customer-pipeline' },
  { id: 'crm-conversion-funnel', module: 'crm', title: 'Conversion Funnel', description: 'Opportunity count by funnel stage', path: '/reports/crm/conversion-funnel' },
]

export const REPORT_MODULES = ['inventory', 'purchase', 'production', 'quality', 'dispatch', 'sales', 'products', 'crm'] as const

export const REPORT_MODULE_LABELS: Record<(typeof REPORT_MODULES)[number], string> = {
  inventory: 'Inventory',
  purchase: 'Purchase',
  production: 'Production',
  quality: 'Quality',
  dispatch: 'Dispatch',
  sales: 'Sales',
  products: 'Product Master',
  crm: 'CRM',
}
