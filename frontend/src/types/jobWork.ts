/** View-model for subcontract WOs presented as Job Work Orders (no separate persisted entity). */

export type JwoStatus =
  | 'draft'
  | 'approved'
  | 'material_sent'
  | 'in_process'
  | 'partially_received'
  | 'received'
  | 'qc_pending'
  | 'closed'

export type JwoQcStatus = 'none' | 'pending' | 'pass' | 'fail'

export interface JobWorkOrderView {
  id: string
  jwoNo: string
  workOrderId: string
  sourceWoNo: string
  parentSoNo: string
  parentSoId: string
  vendorId: string | null
  vendorName: string
  process: string
  outputItemCode: string
  materialSentItemCode: string | null
  sentQty: number
  receivedQty: number
  rejectedQty: number
  reworkQty: number
  balanceQty: number
  expectedReturnDate: string | null
  actualReturnDate: string | null
  status: JwoStatus
  qcStatus: JwoQcStatus
  rate: number
  amount: number
  shipmentIds: string[]
  challanNos: string[]
}

export interface JobWorkMeta {
  workOrderId: string
  approvedAt: string | null
  rate: number
  closedAt: string | null
}
