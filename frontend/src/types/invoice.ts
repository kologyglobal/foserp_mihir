/** Company billing configuration — Pune plant */
export const COMPANY_NAME = 'Vasant Trailers Pvt Ltd'
export const COMPANY_ADDRESS = 'Plot 12, MIDC Chakan, Pune, Maharashtra — 410501'
export const COMPANY_STATE = 'Maharashtra'
export const COMPANY_GSTIN = '27AABCV1234E1Z9'
export const COMPANY_PAN = 'AABCV1234E'
export const DEFAULT_GST_RATE = 18

export type GstScheme = 'cgst_sgst' | 'igst'

export interface GstBreakdown {
  scheme: GstScheme
  taxableAmount: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  totalTax: number
  grandTotal: number
}

export type InvoiceStatus = 'draft' | 'posted' | 'cancelled'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

export type PaymentMode = 'neft' | 'rtgs' | 'cheque' | 'upi' | 'cash'

export interface InvoiceLine {
  id: string
  dispatchLineId: string | null
  itemId: string
  itemCode: string
  description: string
  hsnCode: string
  qty: number
  unitPrice: number
  taxableAmount: number
  gstRate: number
  trailerNo: string
  chassisNo: string
}

export interface PaymentRecord {
  id: string
  paymentDate: string
  amount: number
  referenceNo: string
  mode: PaymentMode
  remarks: string
  recordedAt: string
}

export interface SalesInvoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  dispatchId: string
  dispatchNo: string
  salesOrderId: string
  salesOrderNo: string
  customerId: string
  customerName: string
  customerGstin: string
  customerState: string
  customerAddress: string
  placeOfSupply: string
  /** From dispatch logistics */
  lrNo: string
  vehicleNo: string
  transporter: string
  productId: string
  productCode: string
  productName: string
  lines: InvoiceLine[]
  gst: GstBreakdown
  status: InvoiceStatus
  paymentStatus: PaymentStatus
  amountPaid: number
  balanceDue: number
  payments: PaymentRecord[]
  creditDays: number
  postedAt: string | null
  remarks: string
  createdAt: string
  updatedAt: string
}

export interface ReceivableRow {
  invoiceId: string
  invoiceNo: string
  customerName: string
  salesOrderNo: string
  invoiceDate: string
  dueDate: string
  grandTotal: number
  amountPaid: number
  balanceDue: number
  paymentStatus: PaymentStatus
  daysOverdue: number
}

export interface InvoiceCandidate {
  dispatchId: string
  dispatchNo: string
  salesOrderId: string
  salesOrderNo: string
  customerId: string
  customerName: string
  productCode: string
  productName: string
  qty: number
  unitPrice: number
  dispatchStatus: string
  dispatchedAt: string | null
}

export function paymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    unpaid: 'Unpaid',
    partial: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
  }
  return labels[status]
}

export function derivePaymentStatus(
  balanceDue: number,
  amountPaid: number,
  dueDate: string,
  asOf: Date = new Date(),
): PaymentStatus {
  if (balanceDue <= 0 && amountPaid > 0) return 'paid'
  if (amountPaid > 0 && balanceDue > 0) {
    const due = new Date(dueDate)
    if (asOf > due) return 'overdue'
    return 'partial'
  }
  const due = new Date(dueDate)
  if (asOf > due) return 'overdue'
  return 'unpaid'
}
