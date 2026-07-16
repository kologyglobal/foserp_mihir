export type ProductCode =
  | '45M3-BULKER'
  | 'ISO-TANK'
  | 'CEMENT-BULKER'
  | 'SIDE-WALL'

export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'engineering'
  | 'in-production'
  | 'qc-hold'
  | 'ready-dispatch'
  | 'dispatched'
  | 'closed'

export type WorkOrderStatus =
  | 'planned'
  | 'released'
  | 'in-progress'
  | 'qc-pending'
  | 'completed'
  | 'on-hold'

export type QCStatus = 'pending' | 'in-progress' | 'passed' | 'failed' | 'rework'

export type DispatchStatus = 'ready' | 'loading' | 'in-transit' | 'delivered'

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export interface Product {
  code: ProductCode
  name: string
  category: string
  capacity: string
  axleConfig: string
  basePrice: number
  leadTimeDays: number
}

export interface Customer {
  id: string
  name: string
  city: string
  contact: string
  gstin: string
}

export interface SalesOrder {
  id: string
  orderNo: string
  customerId: string
  customerName: string
  productCode: ProductCode
  productName: string
  quantity: number
  unitPrice: number
  orderDate: string
  deliveryDate: string
  status: OrderStatus
  priority: Priority
  salesPerson: string
}

export interface BOMItem {
  id: string
  productCode: ProductCode
  itemCode: string
  description: string
  quantity: number
  uom: string
  materialGrade: string
}

export interface EngineeringDrawing {
  id: string
  drawingNo: string
  productCode: ProductCode
  revision: string
  title: string
  status: 'draft' | 'approved' | 'released' | 'obsolete'
  engineer: string
  lastUpdated: string
}

export interface ECO {
  id: string
  ecoNo: string
  productCode: ProductCode
  title: string
  reason: string
  status: 'open' | 'under-review' | 'approved' | 'implemented'
  requestedBy: string
  targetDate: string
}

export interface InventoryItem {
  id: string
  itemCode: string
  description: string
  category: string
  uom: string
  onHand: number
  reserved: number
  reorderLevel: number
  location: string
  lastReceipt: string
}

export interface MaterialShortage {
  id: string
  itemCode: string
  description: string
  requiredQty: number
  availableQty: number
  shortageQty: number
  workOrderNo: string
  requiredDate: string
  priority: Priority
}

export interface MRPPlan {
  id: string
  planNo: string
  itemCode: string
  description: string
  grossRequirement: number
  scheduledReceipts: number
  projectedOnHand: number
  netRequirement: number
  plannedOrderQty: number
  plannedOrderDate: string
  supplier: string
}

export interface WorkOrder {
  id: string
  woNo: string
  salesOrderNo: string
  productCode: ProductCode
  productName: string
  quantity: number
  status: WorkOrderStatus
  currentStage: string
  progress: number
  startDate: string
  plannedEnd: string
  supervisor: string
  bay: string
}

export interface ProductionStage {
  id: string
  woNo: string
  stage: string
  operator: string
  startTime: string
  endTime: string | null
  status: 'pending' | 'active' | 'completed'
}

export interface QCInspection {
  id: string
  inspectionNo: string
  woNo: string
  productName: string
  inspectionType: string
  inspector: string
  scheduledDate: string
  status: QCStatus
  defectsFound: number
  remarks: string
}

export interface NCR {
  id: string
  ncrNo: string
  woNo: string
  defectType: string
  severity: 'minor' | 'major' | 'critical'
  reportedBy: string
  reportedDate: string
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  disposition: string
}

export interface DispatchOrder {
  id: string
  dispatchNo: string
  salesOrderNo: string
  customerName: string
  productName: string
  quantity: number
  vehicleNo: string
  driverName: string
  dispatchDate: string
  destination: string
  status: DispatchStatus
}

export interface DashboardKPI {
  openOrders: number
  materialShortages: number
  productionWIP: number
  dispatchReady: number
  pendingQC: number
}

export interface NavItem {
  label: string
  path: string
  icon: string
  module: string
}
