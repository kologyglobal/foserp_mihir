/**
 * Accounts Receivable — Indian manufacturing B2B demo seed (frontend only).
 * Mutate via receivablesService; does NOT post real GL or send communications.
 */
import type {
  CollectionActivity,
  CollectionStatus,
  CreditNote,
  CreditNoteApplication,
  CustomerDispute,
  CustomerReceipt,
  PaymentPromise,
  PaymentReminder,
  ReceiptAllocationLine,
  ReceivableAgeingBucket,
  ReceivableAuditEntry,
  ReceivableCustomer,
  ReceivableInvoice,
  ReceivableInvoiceStatus,
  ReceivableSavedView,
} from '../../types/receivables'
import { DEFAULT_RECEIVABLE_FILTER } from '../../types/receivables'

const COLLECTION_OWNERS = ['Kavita Deshpande', 'Rohit Jain', 'Priya Sharma', 'Ananya Iyer'] as const
const CREATED_BY = 'Priya Sharma'
const POSTED_BY = 'Rahul Mehta'

export const RECEIVABLE_BANK_ACCOUNTS = [
  { id: 'bank-hdfc', name: 'HDFC Bank — Current A/c', kind: 'bank' as const },
  { id: 'bank-icici', name: 'ICICI Bank — Current A/c', kind: 'bank' as const },
  { id: 'cash-hand', name: 'Cash in Hand', kind: 'cash' as const },
]

/** ISO date relative to today (negative = past, positive = future). */
export function dateOnly(daysOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().slice(0, 10)
}

function dateTime(daysOffset: number, hour = 10, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function computeAgeing(dueDate: string): { overdueDays: number; ageingBucket: ReceivableAgeingBucket } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000)
  if (diff <= 0) return { overdueDays: 0, ageingBucket: 'Not Due' }
  if (diff <= 30) return { overdueDays: diff, ageingBucket: '1–30 Days' }
  if (diff <= 60) return { overdueDays: diff, ageingBucket: '31–60 Days' }
  if (diff <= 90) return { overdueDays: diff, ageingBucket: '61–90 Days' }
  if (diff <= 180) return { overdueDays: diff, ageingBucket: '91–180 Days' }
  return { overdueDays: diff, ageingBucket: 'Above 180 Days' }
}

function gstSplit(taxable: number, intraState: boolean) {
  if (intraState) {
    const half = Math.round(taxable * 0.09)
    return { cgst: half, sgst: half, igst: 0 }
  }
  return { cgst: 0, sgst: 0, igst: Math.round(taxable * 0.18) }
}

function allocLine(
  id: string,
  invoice: { id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; originalAmount: number; outstandingBalance: number; overdueDays: number },
  prevAlloc: number,
  allocAmt: number,
  tds = 0,
): ReceiptAllocationLine {
  const remaining = invoice.outstandingBalance - allocAmt
  return {
    id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    originalAmount: invoice.originalAmount,
    previousAllocation: prevAlloc,
    outstandingBalance: invoice.outstandingBalance,
    overdueDays: invoice.overdueDays,
    discountEligible: invoice.overdueDays <= 0,
    tdsAmount: tds,
    allocationAmount: allocAmt,
    remainingBalance: remaining,
    status: remaining <= 0 ? 'Fully Settled' : 'Partially Settled',
  }
}

type InvSeed = {
  id: string
  num: string
  custIdx: number
  invDays: number
  dueDays: number
  taxable: number
  intra: boolean
  applied: number
  cnAmt: number
  status: ReceivableInvoiceStatus
  coll: CollectionStatus
  invType: string
  hasDispute?: boolean
  hasCN?: boolean
  promiseDays?: number | null
  reminderDays?: number | null
}

function buildInvoice(s: InvSeed, customers: ReceivableCustomer[]): ReceivableInvoice {
  const c = customers[s.custIdx]
  const invoiceDate = dateOnly(s.invDays)
  const dueDate = dateOnly(s.dueDays)
  const { overdueDays, ageingBucket } = computeAgeing(dueDate)
  const tax = gstSplit(s.taxable, s.intra)
  const originalAmount = s.taxable + tax.cgst + tax.sgst + tax.igst
  const outstandingBalance = Math.max(0, originalAmount - s.applied - s.cnAmt)
  let invoiceStatus = s.status
  if (invoiceStatus !== 'Paid' && invoiceStatus !== 'Disputed' && invoiceStatus !== 'Cancelled') {
    if (outstandingBalance <= 0) invoiceStatus = 'Paid'
    else if (s.applied > 0) invoiceStatus = 'Partially Paid'
    else if (overdueDays > 0) invoiceStatus = 'Overdue'
    else if (s.dueDays >= 0 && s.dueDays <= 7) invoiceStatus = 'Due Soon'
    else invoiceStatus = 'Open'
  }
  return {
    id: s.id,
    invoiceNumber: s.num,
    invoiceDate,
    postingDate: invoiceDate,
    dueDate,
    customerId: c.id,
    customerCode: c.customerCode,
    customerName: c.customerName,
    customerGstNumber: c.gstNumber,
    salesOrderNumber: `SO-2026-${s.id.slice(-2).padStart(4, '0')}`,
    deliveryNumber: s.invType === 'Export' ? null : `DN-2026-${s.id.slice(-2).padStart(4, '0')}`,
    referenceNumber: null,
    paymentTerms: c.paymentTerms,
    placeOfSupply: c.state,
    salesperson: c.salesperson,
    territory: c.territory,
    location: 'Main Plant — Pune',
    originalAmount,
    taxableAmount: s.taxable,
    ...tax,
    appliedAmount: s.applied,
    creditNoteAmount: s.cnAmt,
    outstandingBalance,
    overdueDays: outstandingBalance > 0 ? overdueDays : 0,
    ageingBucket: outstandingBalance > 0 ? ageingBucket : 'Not Due',
    invoiceStatus,
    collectionStatus: s.coll,
    collectionOwner: c.collectionOwner,
    gstStatus: 'Filed',
    eInvoiceStatus: c.gstRegistrationType === 'Export' ? 'Not Applicable' : 'Generated',
    eInvoiceIrn: c.gstRegistrationType === 'Export' ? null : `IRN${s.id.replace(/-/g, '').toUpperCase()}2026`,
    eWayBillNumber: s.invType === 'Export' ? `EWB${s.id.slice(-6)}` : null,
    hasDispute: s.hasDispute ?? false,
    hasCreditNote: s.hasCN ?? false,
    lastReminderDate: s.reminderDays != null ? dateOnly(s.reminderDays) : null,
    paymentPromiseDate: s.promiseDays != null ? dateOnly(s.promiseDays) : null,
    invoiceType: s.invType,
    sourceSalesInvoiceId: `si-${s.id}`,
  }
}

export function seedReceivableCustomers(): ReceivableCustomer[] {
  return [
    {
      id: 'arcust-01',
      customerCode: 'CUS-AUTO',
      customerName: 'Precision Auto Components Pvt Ltd',
      customerGroup: 'Automotive OEM',
      gstNumber: '27AABCP1234A1Z5',
      gstRegistrationType: 'Regular',
      state: 'Maharashtra',
      territory: 'Pune Industrial',
      salesperson: 'Amit Khanna',
      collectionOwner: COLLECTION_OWNERS[0],
      paymentTerms: 'Net 45',
      creditLimit: 5_000_000,
      creditStatus: 'Within Limit',
      contactPerson: 'Rajesh Kulkarni',
      email: 'accounts@precisionauto.in',
      mobile: '+91 98230 11445',
      billingAddress: 'Plot 14, MIDC Chakan, Pune — 410501',
      shippingAddress: 'Plot 14, MIDC Chakan, Pune — 410501',
      averageCollectionDays: 42,
      isStrategic: true,
      masterCustomerId: 'mcust-auto-01',
    },
    {
      id: 'arcust-02',
      customerCode: 'CUS-ENGD',
      customerName: 'Gujarat Engineering Distributors',
      customerGroup: 'Equipment Distributor',
      gstNumber: '24AABCG5678B1Z2',
      gstRegistrationType: 'Regular',
      state: 'Gujarat',
      territory: 'Ahmedabad',
      salesperson: 'Neha Gupta',
      collectionOwner: COLLECTION_OWNERS[1],
      paymentTerms: 'Net 30',
      creditLimit: 2_500_000,
      creditStatus: 'Near Limit',
      contactPerson: 'Harsh Patel',
      email: 'finance@gedist.in',
      mobile: '+91 98765 22331',
      billingAddress: '801, Ashram Road, Ahmedabad — 380009',
      shippingAddress: 'GIDC Odhav, Ahmedabad — 382415',
      averageCollectionDays: 38,
      isStrategic: false,
      masterCustomerId: 'mcust-engd-01',
    },
    {
      id: 'arcust-03',
      customerCode: 'CUS-CHEM',
      customerName: 'Vapi Chemical Industries Ltd',
      customerGroup: 'Chemical Manufacturer',
      gstNumber: '24AABCV9012C1Z8',
      gstRegistrationType: 'Regular',
      state: 'Gujarat',
      territory: 'Vapi',
      salesperson: 'Vikram Singh',
      collectionOwner: COLLECTION_OWNERS[2],
      paymentTerms: 'Net 60',
      creditLimit: 1_500_000,
      creditStatus: 'Over Limit',
      contactPerson: 'Mehul Shah',
      email: 'ap@vapichem.co.in',
      mobile: '+91 99044 55667',
      billingAddress: 'GIDC Vapi, Valsad — 396195',
      shippingAddress: 'GIDC Vapi, Valsad — 396195',
      averageCollectionDays: 68,
      isStrategic: false,
      masterCustomerId: 'mcust-chem-01',
    },
    {
      id: 'arcust-04',
      customerCode: 'CUS-PHRM',
      customerName: 'Chennai Pharma Fabricators',
      customerGroup: 'Pharma Manufacturer',
      gstNumber: '33AABCP3456D1Z3',
      gstRegistrationType: 'Regular',
      state: 'Tamil Nadu',
      territory: 'Chennai',
      salesperson: 'Amit Khanna',
      collectionOwner: COLLECTION_OWNERS[0],
      paymentTerms: 'Net 30',
      creditLimit: 3_000_000,
      creditStatus: 'Within Limit',
      contactPerson: 'Lakshmi Narayanan',
      email: 'purchase@chennaipharma.in',
      mobile: '+91 94440 77889',
      billingAddress: 'Ambattur Industrial Estate, Chennai — 600058',
      shippingAddress: 'Ambattur Industrial Estate, Chennai — 600058',
      averageCollectionDays: 31,
      isStrategic: true,
      masterCustomerId: 'mcust-phrm-01',
    },
    {
      id: 'arcust-05',
      customerCode: 'CUS-MTDL',
      customerName: 'Rajkot Machine Tools Agency',
      customerGroup: 'Machine Tools Dealer',
      gstNumber: '24AABCM7890E1Z1',
      gstRegistrationType: 'Regular',
      state: 'Gujarat',
      territory: 'Rajkot',
      salesperson: 'Neha Gupta',
      collectionOwner: COLLECTION_OWNERS[3],
      paymentTerms: 'Net 45',
      creditLimit: 800_000,
      creditStatus: 'Credit Hold',
      contactPerson: 'Dinesh Joshi',
      email: 'accounts@rajkoattools.com',
      mobile: '+91 98250 33441',
      billingAddress: 'Gondal Road, Rajkot — 360004',
      shippingAddress: 'Gondal Road, Rajkot — 360004',
      averageCollectionDays: 72,
      isStrategic: false,
      masterCustomerId: 'mcust-mtdl-01',
    },
    {
      id: 'arcust-06',
      customerCode: 'CUS-EXPT',
      customerName: 'Global Trailers FZE (India SEZ)',
      customerGroup: 'Export Customer',
      gstNumber: '24AABCE4567F1Z4',
      gstRegistrationType: 'Export',
      state: 'Gujarat',
      territory: 'Mundra SEZ',
      salesperson: 'Vikram Singh',
      collectionOwner: COLLECTION_OWNERS[1],
      paymentTerms: 'LC at Sight',
      creditLimit: 5_000_000,
      creditStatus: 'Within Limit',
      contactPerson: 'Farhan Ansari',
      email: 'treasury@globaltrailers.ae',
      mobile: '+971 50 123 4567',
      billingAddress: 'Unit 12, Mundra SEZ, Kutch — 370421',
      shippingAddress: 'Mundra Port, Kutch — 370421',
      averageCollectionDays: 28,
      isStrategic: true,
      masterCustomerId: 'mcust-expt-01',
    },
    {
      id: 'arcust-07',
      customerCode: 'CUS-GOVT',
      customerName: 'Gujarat State Road Transport Corp',
      customerGroup: 'Government',
      gstNumber: '24AAACG1234G1Z6',
      gstRegistrationType: 'Government',
      state: 'Gujarat',
      territory: 'Gandhinagar',
      salesperson: 'Amit Khanna',
      collectionOwner: COLLECTION_OWNERS[2],
      paymentTerms: 'Net 90',
      creditLimit: 4_000_000,
      creditStatus: 'Temporarily Released',
      contactPerson: 'Shri Pravin Desai',
      email: 'gsrtc.finance@gujarat.gov.in',
      mobile: '+91 79 2324 1100',
      billingAddress: 'GSRTC HQ, K Road, Gandhinagar — 382010',
      shippingAddress: 'GSRTC Workshop, Naroda, Ahmedabad — 382330',
      averageCollectionDays: 95,
      isStrategic: true,
      masterCustomerId: 'mcust-govt-01',
    },
    {
      id: 'arcust-08',
      customerCode: 'CUS-JOBW',
      customerName: 'Nashik Fabrication Works',
      customerGroup: 'Job-work Customer',
      gstNumber: '27AABCN6789H1Z9',
      gstRegistrationType: 'Regular',
      state: 'Maharashtra',
      territory: 'Nashik',
      salesperson: 'Neha Gupta',
      collectionOwner: COLLECTION_OWNERS[3],
      paymentTerms: 'Net 15',
      creditLimit: 500_000,
      creditStatus: 'No Credit Limit',
      contactPerson: 'Sanjay More',
      email: 'billing@nashikfab.in',
      mobile: '+91 97660 88990',
      billingAddress: 'Satpur MIDC, Nashik — 422007',
      shippingAddress: 'Satpur MIDC, Nashik — 422007',
      averageCollectionDays: 22,
      isStrategic: false,
      masterCustomerId: null,
    },
  ]
}

export function seedReceivableInvoices(): ReceivableInvoice[] {
  const customers = seedReceivableCustomers()
  const seeds: InvSeed[] = [
    { id: 'arinv-01', num: 'SI-2026-01001', custIdx: 0, invDays: -52, dueDays: -45, taxable: 850_000, intra: true, applied: 500_000, cnAmt: 0, status: 'Partially Paid', coll: 'Follow-up Required', invType: 'Product supply', reminderDays: -10 },
    { id: 'arinv-02', num: 'SI-2026-01002', custIdx: 0, invDays: -22, dueDays: -15, taxable: 125_000, intra: true, applied: 170_000, cnAmt: 0, status: 'Paid', coll: 'Closed', invType: 'Spare parts' },
    { id: 'arinv-03', num: 'SI-2026-01003', custIdx: 1, invDays: -82, dueDays: -75, taxable: 620_000, intra: false, applied: 350_000, cnAmt: 0, status: 'Partially Paid', coll: 'Promise Received', invType: 'Product supply', promiseDays: 5, reminderDays: -20 },
    { id: 'arinv-04', num: 'SI-2026-01004', custIdx: 1, invDays: -18, dueDays: 5, taxable: 48_000, intra: false, applied: 0, cnAmt: 0, status: 'Due Soon', coll: 'Not Contacted', invType: 'Freight recovery' },
    { id: 'arinv-05', num: 'SI-2026-01005', custIdx: 2, invDays: -128, dueDays: -120, taxable: 1_250_000, intra: false, applied: 0, cnAmt: 0, status: 'Overdue', coll: 'Escalated', invType: 'Product supply', reminderDays: -30 },
    { id: 'arinv-06', num: 'SI-2026-01006', custIdx: 2, invDays: -38, dueDays: -30, taxable: 340_000, intra: false, applied: 200_000, cnAmt: 0, status: 'Partially Paid', coll: 'Partial Payment Expected', invType: 'Spare parts', reminderDays: -8 },
    { id: 'arinv-07', num: 'SI-2026-01007', custIdx: 3, invDays: -8, dueDays: 20, taxable: 980_000, intra: false, applied: 0, cnAmt: 0, status: 'Open', coll: 'Not Contacted', invType: 'Product supply' },
    { id: 'arinv-08', num: 'SI-2026-01008', custIdx: 3, invDays: -12, dueDays: -5, taxable: 275_000, intra: false, applied: 0, cnAmt: 0, status: 'Due Soon', coll: 'Follow-up Required', invType: 'Product supply', reminderDays: -2 },
    { id: 'arinv-09', num: 'SI-2026-01009', custIdx: 4, invDays: -98, dueDays: -90, taxable: 420_000, intra: false, applied: 0, cnAmt: 0, status: 'Disputed', coll: 'Disputed', invType: 'Product supply', hasDispute: true, reminderDays: -15 },
    { id: 'arinv-10', num: 'SI-2026-01010', custIdx: 4, invDays: -210, dueDays: -200, taxable: 185_000, intra: false, applied: 0, cnAmt: 0, status: 'Overdue', coll: 'Credit Hold', invType: 'Spare parts', reminderDays: -45 },
    { id: 'arinv-11', num: 'SI-2026-01011', custIdx: 5, invDays: -5, dueDays: 30, taxable: 1_850_000, intra: false, applied: 0, cnAmt: 0, status: 'Open', coll: 'Not Contacted', invType: 'Export' },
    { id: 'arinv-12', num: 'SI-2026-01012', custIdx: 5, invDays: -20, dueDays: -10, taxable: 720_000, intra: false, applied: 400_000, cnAmt: 0, status: 'Partially Paid', coll: 'Partial Payment Expected', invType: 'Export' },
    { id: 'arinv-13', num: 'SI-2026-01013', custIdx: 6, invDays: -10, dueDays: 45, taxable: 1_100_000, intra: false, applied: 0, cnAmt: 0, status: 'Open', coll: 'Not Contacted', invType: 'Product supply' },
    { id: 'arinv-14', num: 'SI-2026-01014', custIdx: 6, invDays: -68, dueDays: -60, taxable: 560_000, intra: false, applied: 660_800, cnAmt: 0, status: 'Paid', coll: 'Closed', invType: 'Product supply' },
    { id: 'arinv-15', num: 'SI-2026-01015', custIdx: 7, invDays: -28, dueDays: -20, taxable: 195_000, intra: true, applied: 150_000, cnAmt: 0, status: 'Partially Paid', coll: 'Partial Payment Expected', invType: 'Job-work service', reminderDays: -7 },
    { id: 'arinv-16', num: 'SI-2026-01016', custIdx: 7, invDays: -3, dueDays: 10, taxable: 148_000, intra: true, applied: 0, cnAmt: 0, status: 'Open', coll: 'Not Contacted', invType: 'Job-work service' },
    { id: 'arinv-17', num: 'SI-2026-01017', custIdx: 0, invDays: -42, dueDays: -35, taxable: 88_000, intra: true, applied: 103_840, cnAmt: 0, status: 'Paid', coll: 'Closed', invType: 'Scrap sale' },
    { id: 'arinv-18', num: 'SI-2026-01018', custIdx: 2, invDays: -15, dueDays: -8, taxable: 62_000, intra: false, applied: 0, cnAmt: 0, status: 'Due Soon', coll: 'Contacted', invType: 'Freight recovery', reminderDays: -1 },
  ]
  return seeds.map((s) => buildInvoice(s, customers))
}

export function seedCustomerReceipts(): CustomerReceipt[] {
  const customers = seedReceivableCustomers()
  const invoices = seedReceivableInvoices()
  const inv = (id: string) => {
    const i = invoices.find((x) => x.id === id)!
    return i
  }
  const bank = (id: string) => RECEIVABLE_BANK_ACCOUNTS.find((b) => b.id === id)!

  const r01Alloc = 500_000
  const r01Lines = [allocLine('al-01', inv('arinv-01'), 0, r01Alloc)]
  const r03Alloc = 200_000
  const r03Lines = [allocLine('al-03', inv('arinv-06'), 0, r03Alloc)]
  const r05Gross = 170_000
  const r05Tds = 1_700
  const r05Net = r05Gross - r05Tds
  const r05Lines = [allocLine('al-05', inv('arinv-02'), 0, r05Net, r05Tds)]
  const r06Gross = 500_000
  const r06Charges = 236
  const r06Net = r06Gross - r06Charges
  const r06Alloc = 400_000
  const r06Lines = [allocLine('al-06', inv('arinv-12'), 0, r06Alloc)]
  const r09Alloc = 103_840
  const r09Lines = [allocLine('al-09', inv('arinv-17'), 0, r09Alloc)]
  const r10Alloc = 150_000
  const r10Lines = [allocLine('al-10', inv('arinv-15'), 0, r10Alloc)]
  const r12Alloc = 660_800
  const r12Lines = [allocLine('al-12', inv('arinv-14'), 0, r12Alloc)]

  return [
    {
      id: 'arrcpt-01', receiptNumber: 'RCPT-2026-00421', receiptDate: dateOnly(-12), postingDate: dateOnly(-12),
      customerId: customers[0].id, customerCode: customers[0].customerCode, customerName: customers[0].customerName,
      customerBankReference: 'PREC-AUTO-JUN25', paymentMode: 'NEFT', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: 'HDFCN26071288431', chequeNumber: null,
      chequeDate: null, bankName: 'HDFC Bank', currency: 'INR', exchangeRate: 1, receiptAmount: r01Alloc,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: r01Alloc, allocatedAmount: r01Alloc, unallocatedAmount: 0,
      allocationStatus: 'Partially Allocated', voucherStatus: 'Posted', narration: 'Partial payment against SI-2026-01001',
      internalRemarks: 'Auto-matched via UTR', createdBy: CREATED_BY, postedBy: POSTED_BY, postedAt: dateTime(-12, 14, 30),
      relatedVoucherId: 'vch-rcpt-421', relatedVoucherNumber: 'RCT-2026-00421', originalReceiptId: null, reversalReceiptId: null,
      allocationLines: r01Lines, attachments: [{ id: 'att-r01', name: 'neft-advice-hdfc88431.pdf', uploadedAt: dateTime(-12, 14, 35) }],
    },
    {
      id: 'arrcpt-02', receiptNumber: 'RCPT-2026-00422', receiptDate: dateOnly(-8), postingDate: dateOnly(-8),
      customerId: customers[1].id, customerCode: customers[1].customerCode, customerName: customers[1].customerName,
      customerBankReference: null, paymentMode: 'RTGS', bankOrCashAccountId: 'bank-icici',
      bankOrCashAccountName: bank('bank-icici').name, transactionReference: 'ICICR26070899210', chequeNumber: null,
      chequeDate: null, bankName: 'ICICI Bank', currency: 'INR', exchangeRate: 1, receiptAmount: 350_000,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: 350_000, allocatedAmount: 350_000, unallocatedAmount: 0,
      allocationStatus: 'Fully Allocated', voucherStatus: 'Posted', narration: 'Part settlement — Gujarat Engineering',
      internalRemarks: '', createdBy: CREATED_BY, postedBy: POSTED_BY, postedAt: dateTime(-8, 11, 0),
      relatedVoucherId: 'vch-rcpt-422', relatedVoucherNumber: 'RCT-2026-00422', originalReceiptId: null, reversalReceiptId: null,
      allocationLines: [allocLine('al-02', inv('arinv-03'), 0, 350_000)], attachments: [],
    },
    {
      id: 'arrcpt-03', receiptNumber: 'RCPT-2026-00423', receiptDate: dateOnly(-5), postingDate: dateOnly(-5),
      customerId: customers[2].id, customerCode: customers[2].customerCode, customerName: customers[2].customerName,
      customerBankReference: null, paymentMode: 'Cheque', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: null, chequeNumber: '884521',
      chequeDate: dateOnly(-7), bankName: 'Bank of Baroda', currency: 'INR', exchangeRate: 1, receiptAmount: r03Alloc,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: r03Alloc, allocatedAmount: r03Alloc,
      unallocatedAmount: 0, allocationStatus: 'Partially Allocated', voucherStatus: 'Posted',
      narration: 'Cheque received — Vapi Chemical partial', internalRemarks: 'Balance on SI-2026-01006 pending',
      createdBy: CREATED_BY, postedBy: POSTED_BY, postedAt: dateTime(-5, 16, 0),
      relatedVoucherId: 'vch-rcpt-423', relatedVoucherNumber: 'RCT-2026-00423', originalReceiptId: null, reversalReceiptId: null,
      allocationLines: r03Lines, attachments: [{ id: 'att-r03', name: 'cheque-884521-scan.jpg', uploadedAt: dateTime(-5, 16, 5) }],
    },
    {
      id: 'arrcpt-04', receiptNumber: 'RCPT-2026-00424', receiptDate: dateOnly(-3), postingDate: dateOnly(-3),
      customerId: customers[3].id, customerCode: customers[3].customerCode, customerName: customers[3].customerName,
      customerBankReference: 'ADV-CPF-JUL26', paymentMode: 'NEFT', bankOrCashAccountId: 'bank-icici',
      bankOrCashAccountName: bank('bank-icici').name, transactionReference: 'ICICN26071300112', chequeNumber: null,
      chequeDate: null, bankName: 'ICICI Bank', currency: 'INR', exchangeRate: 1, receiptAmount: 500_000,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: 500_000, allocatedAmount: 0, unallocatedAmount: 500_000,
      allocationStatus: 'Unallocated', voucherStatus: 'Posted', narration: 'Advance against upcoming dispatches',
      internalRemarks: 'Unallocated advance — allocate on next invoice', createdBy: CREATED_BY, postedBy: POSTED_BY,
      postedAt: dateTime(-3, 10, 15), relatedVoucherId: 'vch-rcpt-424', relatedVoucherNumber: 'RCT-2026-00424',
      originalReceiptId: null, reversalReceiptId: null, allocationLines: [], attachments: [],
    },
    {
      id: 'arrcpt-05', receiptNumber: 'RCPT-2026-00425', receiptDate: dateOnly(-6), postingDate: dateOnly(-6),
      customerId: customers[0].id, customerCode: customers[0].customerCode, customerName: customers[0].customerName,
      customerBankReference: null, paymentMode: 'NEFT', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: 'HDFCN26070655102', chequeNumber: null,
      chequeDate: null, bankName: 'HDFC Bank', currency: 'INR', exchangeRate: 1, receiptAmount: r05Gross,
      tdsDeducted: r05Tds, bankCharges: 0, netAmountReceived: r05Net, allocatedAmount: r05Net, unallocatedAmount: 0,
      allocationStatus: 'Fully Allocated', voucherStatus: 'Posted', narration: 'Spare parts SI-2026-01002 settled with TDS u/s 194C',
      internalRemarks: 'TDS cert pending from customer', createdBy: CREATED_BY, postedBy: POSTED_BY,
      postedAt: dateTime(-6, 13, 45), relatedVoucherId: 'vch-rcpt-425', relatedVoucherNumber: 'RCT-2026-00425',
      originalReceiptId: null, reversalReceiptId: null, allocationLines: r05Lines,
      attachments: [{ id: 'att-r05', name: 'tds-challan-jun26.pdf', uploadedAt: dateTime(-6, 13, 50) }],
    },
    {
      id: 'arrcpt-06', receiptNumber: 'RCPT-2026-00426', receiptDate: dateOnly(-4), postingDate: dateOnly(-4),
      customerId: customers[5].id, customerCode: customers[5].customerCode, customerName: customers[5].customerName,
      customerBankReference: 'SWIFT-GLB-7721', paymentMode: 'RTGS', bankOrCashAccountId: 'bank-icici',
      bankOrCashAccountName: bank('bank-icici').name, transactionReference: 'ICICR26071133890', chequeNumber: null,
      chequeDate: null, bankName: 'ICICI Bank', currency: 'INR', exchangeRate: 1, receiptAmount: r06Gross,
      tdsDeducted: 0, bankCharges: r06Charges, netAmountReceived: r06Net, allocatedAmount: r06Alloc,
      unallocatedAmount: r06Net - r06Alloc, allocationStatus: 'Partially Allocated', voucherStatus: 'Posted',
      narration: 'Export LC proceeds — partial allocation', internalRemarks: 'Bank charges debited separately',
      createdBy: CREATED_BY, postedBy: POSTED_BY, postedAt: dateTime(-4, 9, 30),
      relatedVoucherId: 'vch-rcpt-426', relatedVoucherNumber: 'RCT-2026-00426', originalReceiptId: null, reversalReceiptId: null,
      allocationLines: r06Lines, attachments: [],
    },
    {
      id: 'arrcpt-07', receiptNumber: 'RCPT-2026-00427', receiptDate: dateOnly(-1), postingDate: dateOnly(-1),
      customerId: customers[4].id, customerCode: customers[4].customerCode, customerName: customers[4].customerName,
      customerBankReference: null, paymentMode: 'NEFT', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: 'HDFCN26071400201', chequeNumber: null,
      chequeDate: null, bankName: 'HDFC Bank', currency: 'INR', exchangeRate: 1, receiptAmount: 218_300,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: 218_300, allocatedAmount: 0, unallocatedAmount: 218_300,
      allocationStatus: 'Unallocated', voucherStatus: 'Draft', narration: 'Draft receipt — pending dispute clearance',
      internalRemarks: 'Hold until dispute DSP-2026-0003 resolved', createdBy: CREATED_BY, postedBy: null, postedAt: null,
      relatedVoucherId: null, relatedVoucherNumber: null, originalReceiptId: null, reversalReceiptId: null,
      allocationLines: [], attachments: [],
    },
    {
      id: 'arrcpt-08', receiptNumber: 'RCPT-2026-00428', receiptDate: dateOnly(0), postingDate: dateOnly(0),
      customerId: customers[6].id, customerCode: customers[6].customerCode, customerName: customers[6].customerName,
      customerBankReference: null, paymentMode: 'Cheque', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: null, chequeNumber: '990123',
      chequeDate: dateOnly(2), bankName: 'State Bank of India', currency: 'INR', exchangeRate: 1, receiptAmount: 280_000,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: 280_000, allocatedAmount: 0, unallocatedAmount: 280_000,
      allocationStatus: 'Unallocated', voucherStatus: 'Pending Approval', narration: 'GSRTC treasury cheque — pending approval',
      internalRemarks: 'Awaiting finance manager sign-off', createdBy: CREATED_BY, postedBy: null, postedAt: null,
      relatedVoucherId: null, relatedVoucherNumber: null, originalReceiptId: null, reversalReceiptId: null,
      allocationLines: [], attachments: [{ id: 'att-r08', name: 'gsrtc-cheque-990123.pdf', uploadedAt: dateTime(0, 11, 0) }],
    },
    {
      id: 'arrcpt-09', receiptNumber: 'RCPT-2026-00429', receiptDate: dateOnly(-35), postingDate: dateOnly(-35),
      customerId: customers[0].id, customerCode: customers[0].customerCode, customerName: customers[0].customerName,
      customerBankReference: null, paymentMode: 'Cash', bankOrCashAccountId: 'cash-hand',
      bankOrCashAccountName: bank('cash-hand').name, transactionReference: null, chequeNumber: null,
      chequeDate: null, bankName: null, currency: 'INR', exchangeRate: 1, receiptAmount: r09Alloc,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: r09Alloc, allocatedAmount: r09Alloc, unallocatedAmount: 0,
      allocationStatus: 'Fully Allocated', voucherStatus: 'Posted', narration: 'Cash against scrap sale SI-2026-01017',
      internalRemarks: 'Counter sale — cash limit OK', createdBy: CREATED_BY, postedBy: POSTED_BY,
      postedAt: dateTime(-35, 17, 0), relatedVoucherId: 'vch-rcpt-429', relatedVoucherNumber: 'RCT-2026-00429',
      originalReceiptId: null, reversalReceiptId: null, allocationLines: r09Lines, attachments: [],
    },
    {
      id: 'arrcpt-10', receiptNumber: 'RCPT-2026-00430', receiptDate: dateOnly(-14), postingDate: dateOnly(-14),
      customerId: customers[7].id, customerCode: customers[7].customerCode, customerName: customers[7].customerName,
      customerBankReference: null, paymentMode: 'NEFT', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: 'HDFCN26070122440', chequeNumber: null,
      chequeDate: null, bankName: 'HDFC Bank', currency: 'INR', exchangeRate: 1, receiptAmount: r10Alloc,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: r10Alloc, allocatedAmount: r10Alloc,
      unallocatedAmount: 0, allocationStatus: 'Partially Allocated', voucherStatus: 'Posted',
      narration: 'Partial payment — job-work invoice', internalRemarks: 'Balance ₹80,100 still due',
      createdBy: CREATED_BY, postedBy: POSTED_BY, postedAt: dateTime(-14, 12, 0),
      relatedVoucherId: 'vch-rcpt-430', relatedVoucherNumber: 'RCT-2026-00430', originalReceiptId: null, reversalReceiptId: null,
      allocationLines: r10Lines, attachments: [],
    },
    {
      id: 'arrcpt-11', receiptNumber: 'RCPT-2026-00431', receiptDate: dateOnly(-2), postingDate: dateOnly(-2),
      customerId: customers[1].id, customerCode: customers[1].customerCode, customerName: customers[1].customerName,
      customerBankReference: 'ADV-GED-JUL26', paymentMode: 'IMPS', bankOrCashAccountId: 'bank-icici',
      bankOrCashAccountName: bank('bank-icici').name, transactionReference: 'IMPS26071388400', chequeNumber: null,
      chequeDate: null, bankName: 'ICICI Bank', currency: 'INR', exchangeRate: 1, receiptAmount: 200_000,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: 200_000, allocatedAmount: 0, unallocatedAmount: 200_000,
      allocationStatus: 'Unallocated', voucherStatus: 'Posted', narration: 'Advance IMPS — unallocated',
      internalRemarks: 'Customer requested carry-forward', createdBy: CREATED_BY, postedBy: POSTED_BY,
      postedAt: dateTime(-2, 15, 20), relatedVoucherId: 'vch-rcpt-431', relatedVoucherNumber: 'RCT-2026-00431',
      originalReceiptId: null, reversalReceiptId: null, allocationLines: [], attachments: [],
    },
    {
      id: 'arrcpt-12', receiptNumber: 'RCPT-2026-00432', receiptDate: dateOnly(-18), postingDate: dateOnly(-18),
      customerId: customers[6].id, customerCode: customers[6].customerCode, customerName: customers[6].customerName,
      customerBankReference: 'GSRTC-TREAS-JUN', paymentMode: 'Demand Draft', bankOrCashAccountId: 'bank-hdfc',
      bankOrCashAccountName: bank('bank-hdfc').name, transactionReference: 'DD-SBI-442198', chequeNumber: null,
      chequeDate: null, bankName: 'State Bank of India', currency: 'INR', exchangeRate: 1, receiptAmount: r12Alloc,
      tdsDeducted: 0, bankCharges: 0, netAmountReceived: r12Alloc, allocatedAmount: r12Alloc, unallocatedAmount: 0,
      allocationStatus: 'Fully Allocated', voucherStatus: 'Posted', narration: 'DD from GSRTC treasury',
      internalRemarks: 'Government payment — 60-day overdue cleared', createdBy: CREATED_BY, postedBy: POSTED_BY,
      postedAt: dateTime(-18, 10, 0), relatedVoucherId: 'vch-rcpt-432', relatedVoucherNumber: 'RCT-2026-00432',
      originalReceiptId: null, reversalReceiptId: null,       allocationLines: r12Lines, attachments: [],
    },
  ]
}

export function seedCollectionActivities(): CollectionActivity[] {
  const customers = seedReceivableCustomers()
  return [
    {
      id: 'aract-01', customerId: customers[1].id, customerName: customers[1].customerName,
      invoiceId: 'arinv-03', invoiceNumber: 'SI-2026-01003', activityType: 'Call', activityDate: dateOnly(-5),
      contactPerson: 'Harsh Patel', contactMode: 'Mobile', outcome: 'Promise to Pay', nextFollowUpDate: dateOnly(5),
      notes: 'Accounts head promised RTGS by 20 Jul for ₹2.7L balance on SI-2026-01003.',
      promiseDate: dateOnly(5), promiseAmount: 270_000, escalationRequired: false,
      collectionOwner: customers[1].collectionOwner, status: 'Promise Received', completed: true,
      createdAt: dateTime(-5, 11, 30), createdBy: COLLECTION_OWNERS[1],
    },
    {
      id: 'aract-02', customerId: customers[1].id, customerName: customers[1].customerName,
      invoiceId: 'arinv-03', invoiceNumber: 'SI-2026-01003', activityType: 'Email', activityDate: dateOnly(-25),
      contactPerson: 'Harsh Patel', contactMode: 'Email', outcome: 'Promise to Pay', nextFollowUpDate: dateOnly(-10),
      notes: 'Promise for 30 Jun missed — follow-up initiated.',
      promiseDate: dateOnly(-10), promiseAmount: 300_000, escalationRequired: true,
      collectionOwner: customers[1].collectionOwner, status: 'Escalated', completed: true,
      createdAt: dateTime(-25, 9, 0), createdBy: COLLECTION_OWNERS[1],
    },
    {
      id: 'aract-03', customerId: customers[4].id, customerName: customers[4].customerName,
      invoiceId: 'arinv-09', invoiceNumber: 'SI-2026-01009', activityType: 'Dispute Discussion', activityDate: dateOnly(-8),
      contactPerson: 'Dinesh Joshi', contactMode: 'WhatsApp', outcome: 'Dispute Raised', nextFollowUpDate: dateOnly(3),
      notes: 'Customer claims 8% price difference vs PO rate. Commercial team reviewing PO annexure.',
      promiseDate: null, promiseAmount: null, escalationRequired: false,
      collectionOwner: customers[4].collectionOwner, status: 'Disputed', completed: false,
      createdAt: dateTime(-8, 16, 45), createdBy: COLLECTION_OWNERS[3],
    },
    {
      id: 'aract-04', customerId: customers[2].id, customerName: customers[2].customerName,
      invoiceId: 'arinv-05', invoiceNumber: 'SI-2026-01005', activityType: 'Meeting', activityDate: dateOnly(-12),
      contactPerson: 'Mehul Shah', contactMode: 'In-person', outcome: 'Escalation Required', nextFollowUpDate: dateOnly(-2),
      notes: 'Quality claim on batch AX-442 — 3 units rejected at incoming QC. Credit note discussion pending.',
      promiseDate: null, promiseAmount: null, escalationRequired: true,
      collectionOwner: customers[2].collectionOwner, status: 'Escalated', completed: true,
      createdAt: dateTime(-12, 14, 0), createdBy: COLLECTION_OWNERS[2],
    },
    {
      id: 'aract-05', customerId: customers[6].id, customerName: customers[6].customerName,
      invoiceId: 'arinv-14', invoiceNumber: 'SI-2026-01014', activityType: 'Email', activityDate: dateOnly(-3),
      contactPerson: 'Shri Pravin Desai', contactMode: 'Email', outcome: 'Payment Already Made',
      nextFollowUpDate: null, notes: 'Treasury claims DD already sent on 28 Jun. Checking bank statement for DD-SBI-442198.',
      promiseDate: null, promiseAmount: null, escalationRequired: false,
      collectionOwner: customers[6].collectionOwner, status: 'Contacted', completed: true,
      createdAt: dateTime(-3, 10, 15), createdBy: COLLECTION_OWNERS[2],
    },
    {
      id: 'aract-06', customerId: customers[0].id, customerName: customers[0].customerName,
      invoiceId: null, invoiceNumber: null, activityType: 'Internal Follow-up', activityDate: dateOnly(-1),
      contactPerson: 'Rajesh Kulkarni', contactMode: 'Internal', outcome: 'Follow-up Required',
      nextFollowUpDate: dateOnly(2), notes: 'Missing signed delivery challan for DN-2026-0016 — requested from logistics.',
      promiseDate: null, promiseAmount: null, escalationRequired: false,
      collectionOwner: customers[0].collectionOwner, status: 'Follow-up Required', completed: false,
      createdAt: dateTime(-1, 9, 30), createdBy: COLLECTION_OWNERS[0],
    },
    {
      id: 'aract-07', customerId: customers[2].id, customerName: customers[2].customerName,
      invoiceId: 'arinv-05', invoiceNumber: 'SI-2026-01005', activityType: 'Escalation', activityDate: dateOnly(-6),
      contactPerson: 'Mehul Shah', contactMode: 'Email', outcome: 'No Response', nextFollowUpDate: dateOnly(1),
      notes: '120-day overdue — escalated to sales director. Credit hold recommended.',
      promiseDate: null, promiseAmount: null, escalationRequired: true,
      collectionOwner: customers[2].collectionOwner, status: 'Escalated', completed: false,
      createdAt: dateTime(-6, 17, 0), createdBy: COLLECTION_OWNERS[2],
    },
    {
      id: 'aract-08', customerId: customers[7].id, customerName: customers[7].customerName,
      invoiceId: 'arinv-15', invoiceNumber: 'SI-2026-01015', activityType: 'Call', activityDate: dateOnly(-4),
      contactPerson: 'Sanjay More', contactMode: 'Mobile', outcome: 'Partial Payment',
      nextFollowUpDate: dateOnly(7), notes: 'Paid ₹1.5L via NEFT. Remaining ₹80,100 by month-end.',
      promiseDate: dateOnly(15), promiseAmount: 80_100, escalationRequired: false,
      collectionOwner: customers[7].collectionOwner, status: 'Partial Payment Expected', completed: true,
      createdAt: dateTime(-4, 12, 0), createdBy: COLLECTION_OWNERS[3],
    },
    {
      id: 'aract-09', customerId: customers[3].id, customerName: customers[3].customerName,
      invoiceId: 'arinv-08', invoiceNumber: 'SI-2026-01008', activityType: 'WhatsApp', activityDate: dateOnly(-2),
      contactPerson: 'Lakshmi Narayanan', contactMode: 'WhatsApp', outcome: 'Follow-up Required',
      nextFollowUpDate: dateOnly(1), notes: 'Courtesy reminder sent for invoice due 5 days ago.',
      promiseDate: null, promiseAmount: null, escalationRequired: false,
      collectionOwner: customers[3].collectionOwner, status: 'Contacted', completed: true,
      createdAt: dateTime(-2, 11, 0), createdBy: COLLECTION_OWNERS[0],
    },
    {
      id: 'aract-10', customerId: customers[5].id, customerName: customers[5].customerName,
      invoiceId: 'arinv-12', invoiceNumber: 'SI-2026-01012', activityType: 'Email', activityDate: dateOnly(-3),
      contactPerson: 'Farhan Ansari', contactMode: 'Email', outcome: 'Partial Payment',
      nextFollowUpDate: dateOnly(10), notes: 'LC bank released partial amount. Balance expected on next shipment docs.',
      promiseDate: dateOnly(10), promiseAmount: 449_600, escalationRequired: false,
      collectionOwner: customers[5].collectionOwner, status: 'Partial Payment Expected', completed: false,
      createdAt: dateTime(-3, 8, 0), createdBy: COLLECTION_OWNERS[1],
    },
  ]
}

export function seedPaymentPromises(): PaymentPromise[] {
  const customers = seedReceivableCustomers()
  return [
    {
      id: 'arprom-01', customerId: customers[1].id, customerName: customers[1].customerName,
      invoiceId: 'arinv-03', invoiceNumber: 'SI-2026-01003', promiseDate: dateOnly(5), promiseAmount: 270_000,
      paymentMode: 'RTGS', customerContact: 'Harsh Patel',
      notes: 'Confirmed via phone — funds from distributor collection cycle.',
      followUpDate: dateOnly(6), status: 'Active', collectedAmount: 0,
      collectionOwner: customers[1].collectionOwner, createdAt: dateTime(-5, 11, 35),
    },
    {
      id: 'arprom-02', customerId: customers[1].id, customerName: customers[1].customerName,
      invoiceId: 'arinv-03', invoiceNumber: 'SI-2026-01003', promiseDate: dateOnly(-10), promiseAmount: 300_000,
      paymentMode: 'NEFT', customerContact: 'Harsh Patel',
      notes: 'Promise for 30 Jun — not honoured. Marked broken.',
      followUpDate: dateOnly(-8), status: 'Broken', collectedAmount: 0,
      collectionOwner: customers[1].collectionOwner, createdAt: dateTime(-25, 9, 5),
    },
    {
      id: 'arprom-03', customerId: customers[7].id, customerName: customers[7].customerName,
      invoiceId: 'arinv-15', invoiceNumber: 'SI-2026-01015', promiseDate: dateOnly(15), promiseAmount: 80_100,
      paymentMode: 'NEFT', customerContact: 'Sanjay More',
      notes: 'Balance after partial ₹1.5L received.',
      followUpDate: dateOnly(16), status: 'Active', collectedAmount: 150_000,
      collectionOwner: customers[7].collectionOwner, createdAt: dateTime(-4, 12, 5),
    },
    {
      id: 'arprom-04', customerId: customers[0].id, customerName: customers[0].customerName,
      invoiceId: 'arinv-17', invoiceNumber: 'SI-2026-01017', promiseDate: dateOnly(-35), promiseAmount: 103_840,
      paymentMode: 'Cash', customerContact: 'Rajesh Kulkarni',
      notes: 'Scrap sale — collected same day.',
      followUpDate: null, status: 'Fulfilled', collectedAmount: 103_840,
      collectionOwner: customers[0].collectionOwner, createdAt: dateTime(-35, 16, 30),
    },
    {
      id: 'arprom-05', customerId: customers[5].id, customerName: customers[5].customerName,
      invoiceId: 'arinv-12', invoiceNumber: 'SI-2026-01012', promiseDate: dateOnly(10), promiseAmount: 449_600,
      paymentMode: 'RTGS', customerContact: 'Farhan Ansari',
      notes: 'Export LC balance on next bill of lading.',
      followUpDate: dateOnly(11), status: 'Partially Fulfilled', collectedAmount: 400_000,
      collectionOwner: customers[5].collectionOwner, createdAt: dateTime(-3, 8, 5),
    },
    {
      id: 'arprom-06', customerId: customers[2].id, customerName: customers[2].customerName,
      invoiceId: 'arinv-05', invoiceNumber: 'SI-2026-01005', promiseDate: dateOnly(-30), promiseAmount: 500_000,
      paymentMode: 'Cheque', customerContact: 'Mehul Shah',
      notes: 'Cheque bounced — promise broken.',
      followUpDate: dateOnly(-28), status: 'Broken', collectedAmount: 0,
      collectionOwner: customers[2].collectionOwner, createdAt: dateTime(-35, 14, 0),
    },
  ]
}

export function seedCustomerDisputes(): CustomerDispute[] {
  const customers = seedReceivableCustomers()
  return [
    {
      id: 'ardisp-01', disputeNumber: 'DSP-2026-0001', customerId: customers[4].id, customerName: customers[4].customerName,
      invoiceId: 'arinv-09', invoiceNumber: 'SI-2026-01009', disputeDate: dateOnly(-12),
      disputeType: 'Price Difference', disputedAmount: 33_600, description: 'Customer PO rate ₹4,200/unit vs invoiced ₹4,560/unit on 80 qty.',
      owner: COLLECTION_OWNERS[3], responsibleDepartment: 'Commercial', priority: 'High',
      targetResolutionDate: dateOnly(15), status: 'Under Review', resolution: null, creditNoteRequired: true,
      collectionHold: true, supportingDocuments: ['PO-RAJ-8841.pdf', 'rate-contract-2025.pdf'],
      createdAt: dateTime(-12, 10, 0),
    },
    {
      id: 'ardisp-02', disputeNumber: 'DSP-2026-0002', customerId: customers[2].id, customerName: customers[2].customerName,
      invoiceId: 'arinv-05', invoiceNumber: 'SI-2026-01005', disputeDate: dateOnly(-15),
      disputeType: 'Quality Issue', disputedAmount: 125_000, description: '3 fabricated tanks failed hydro test — batch AX-442.',
      owner: COLLECTION_OWNERS[2], responsibleDepartment: 'Quality', priority: 'Critical',
      targetResolutionDate: dateOnly(5), status: 'Awaiting Internal Team', resolution: null, creditNoteRequired: true,
      collectionHold: false, supportingDocuments: ['qc-report-AX442.pdf', 'photos-rejection.zip'],
      createdAt: dateTime(-15, 14, 30),
    },
    {
      id: 'ardisp-03', disputeNumber: 'DSP-2026-0003', customerId: customers[4].id, customerName: customers[4].customerName,
      invoiceId: 'arinv-10', invoiceNumber: 'SI-2026-01010', disputeDate: dateOnly(-60),
      disputeType: 'Missing Document', disputedAmount: 18_500, description: 'E-way bill not received for spare parts dispatch.',
      owner: COLLECTION_OWNERS[3], responsibleDepartment: 'Logistics', priority: 'Medium',
      targetResolutionDate: dateOnly(-30), status: 'Resolved', resolution: 'E-way bill re-generated and shared. Customer withdrew dispute.',
      creditNoteRequired: false, collectionHold: false, supportingDocuments: ['eway-bill-regen.pdf'],
      createdAt: dateTime(-60, 9, 0),
    },
    {
      id: 'ardisp-04', disputeNumber: 'DSP-2026-0004', customerId: customers[3].id, customerName: customers[3].customerName,
      invoiceId: 'arinv-08', invoiceNumber: 'SI-2026-01008', disputeDate: dateOnly(-4),
      disputeType: 'Tax Issue', disputedAmount: 24_750, description: 'Customer claims IGST should be 12% not 18% — pharma exemption query.',
      owner: COLLECTION_OWNERS[0], responsibleDepartment: 'Finance', priority: 'Medium',
      targetResolutionDate: dateOnly(20), status: 'Awaiting Customer', resolution: null, creditNoteRequired: false,
      collectionHold: false, supportingDocuments: ['gst-opinion-request.pdf'],
      createdAt: dateTime(-4, 11, 0),
    },
    {
      id: 'ardisp-05', disputeNumber: 'DSP-2026-0005', customerId: customers[1].id, customerName: customers[1].customerName,
      invoiceId: 'arinv-04', invoiceNumber: 'SI-2026-01004', disputeDate: dateOnly(-20),
      disputeType: 'Commercial Terms', disputedAmount: 12_000, description: 'Freight charged though PO was FOR destination.',
      owner: COLLECTION_OWNERS[1], responsibleDepartment: 'Commercial', priority: 'Low',
      targetResolutionDate: dateOnly(10), status: 'Open', resolution: null, creditNoteRequired: true,
      collectionHold: false, supportingDocuments: ['PO-GED-2201.pdf'],
      createdAt: dateTime(-20, 15, 0),
    },
    {
      id: 'ardisp-06', disputeNumber: 'DSP-2026-0006', customerId: customers[6].id, customerName: customers[6].customerName,
      invoiceId: 'arinv-14', invoiceNumber: 'SI-2026-01014', disputeDate: dateOnly(-45),
      disputeType: 'Quantity Difference', disputedAmount: 45_000, description: 'GSRTC claims 2 trailer frames short-delivered vs challan.',
      owner: COLLECTION_OWNERS[2], responsibleDepartment: 'Dispatch', priority: 'High',
      targetResolutionDate: dateOnly(-10), status: 'Rejected', resolution: 'Challan signed at site for full qty. Dispute rejected with POD.',
      creditNoteRequired: false, collectionHold: false, supportingDocuments: ['pod-signed.pdf', 'challan-8844.pdf'],
      createdAt: dateTime(-45, 10, 0),
    },
  ]
}

export function seedCreditNotes(): CreditNote[] {
  const customers = seedReceivableCustomers()
  const apps = (items: CreditNoteApplication[]) => items
  return [
    {
      id: 'arcn-01', creditNoteNumber: 'CN-2026-00041', creditNoteDate: dateOnly(-20),
      customerId: customers[2].id, customerName: customers[2].customerName,
      referenceInvoiceId: 'arinv-05', referenceInvoiceNumber: 'SI-2026-01005',
      reason: 'Quality Claim', originalAmount: 75_000, appliedAmount: 0, remainingAmount: 75_000,
      gstAdjustment: 13_500, status: 'Pending Approval', sourceDocument: 'qc-report-AX442.pdf',
      relatedVoucherId: null, applications: [],
    },
    {
      id: 'arcn-02', creditNoteNumber: 'CN-2026-00042', creditNoteDate: dateOnly(-8),
      customerId: customers[4].id, customerName: customers[4].customerName,
      referenceInvoiceId: 'arinv-09', referenceInvoiceNumber: 'SI-2026-01009',
      reason: 'Price Difference', originalAmount: 33_600, appliedAmount: 0, remainingAmount: 33_600,
      gstAdjustment: 6_048, status: 'Draft', sourceDocument: 'PO-RAJ-8841.pdf',
      relatedVoucherId: null, applications: [],
    },
    {
      id: 'arcn-03', creditNoteNumber: 'CN-2026-00038', creditNoteDate: dateOnly(-45),
      customerId: customers[0].id, customerName: customers[0].customerName,
      referenceInvoiceId: 'arinv-02', referenceInvoiceNumber: 'SI-2026-01002',
      reason: 'Sales Return', originalAmount: 22_500, appliedAmount: 22_500, remainingAmount: 0,
      gstAdjustment: 4_050, status: 'Applied', sourceDocument: 'return-challan-RC-118.pdf',
      relatedVoucherId: 'vch-cn-038',
      applications: apps([{ id: 'cna-01', creditNoteId: 'arcn-03', invoiceId: 'arinv-02', invoiceNumber: 'SI-2026-01002', appliedAmount: 22_500, appliedDate: dateOnly(-40) }]),
    },
    {
      id: 'arcn-04', creditNoteNumber: 'CN-2026-00039', creditNoteDate: dateOnly(-30),
      customerId: customers[1].id, customerName: customers[1].customerName,
      referenceInvoiceId: 'arinv-04', referenceInvoiceNumber: 'SI-2026-01004',
      reason: 'Freight Adjustment', originalAmount: 12_000, appliedAmount: 6_000, remainingAmount: 6_000,
      gstAdjustment: 2_160, status: 'Partially Applied', sourceDocument: 'freight-settlement.pdf',
      relatedVoucherId: 'vch-cn-039',
      applications: apps([{ id: 'cna-02', creditNoteId: 'arcn-04', invoiceId: 'arinv-04', invoiceNumber: 'SI-2026-01004', appliedAmount: 6_000, appliedDate: dateOnly(-25) }]),
    },
    {
      id: 'arcn-05', creditNoteNumber: 'CN-2026-00040', creditNoteDate: dateOnly(-60),
      customerId: customers[3].id, customerName: customers[3].customerName,
      referenceInvoiceId: null, referenceInvoiceNumber: null,
      reason: 'Discount', originalAmount: 50_000, appliedAmount: 0, remainingAmount: 50_000,
      gstAdjustment: 9_000, status: 'Unapplied', sourceDocument: 'volume-discount-fy26.pdf',
      relatedVoucherId: 'vch-cn-040', applications: [],
    },
    {
      id: 'arcn-06', creditNoteNumber: 'CN-2026-00043', creditNoteDate: dateOnly(-5),
      customerId: customers[7].id, customerName: customers[7].customerName,
      referenceInvoiceId: 'arinv-15', referenceInvoiceNumber: 'SI-2026-01015',
      reason: 'Tax Correction', originalAmount: 8_500, appliedAmount: 0, remainingAmount: 8_500,
      gstAdjustment: 1_530, status: 'Posted', sourceDocument: 'gst-revised-calc.pdf',
      relatedVoucherId: 'vch-cn-043', applications: [],
    },
  ]
}

export function seedPaymentReminders(): PaymentReminder[] {
  const customers = seedReceivableCustomers()
  const invoices = seedReceivableInvoices()
  const inv = (id: string) => invoices.find((x) => x.id === id)!
  const cust = (idx: number) => customers[idx]
  return [
    {
      id: 'arrem-01', customerId: cust(0).id, customerName: cust(0).customerName,
      invoiceId: 'arinv-01', invoiceNumber: 'SI-2026-01001', dueDate: inv('arinv-01').dueDate,
      overdueDays: inv('arinv-01').overdueDays, outstandingAmount: inv('arinv-01').outstandingBalance,
      lastReminderDate: dateOnly(-10), reminderLevel: 'Second Reminder', category: '31–60 Days Overdue',
      contactPerson: cust(0).contactPerson, email: cust(0).email, mobile: cust(0).mobile,
      collectionOwner: cust(0).collectionOwner, excluded: false, demoMarkedSentAt: dateTime(-10, 10, 0),
    },
    {
      id: 'arrem-02', customerId: cust(1).id, customerName: cust(1).customerName,
      invoiceId: 'arinv-03', invoiceNumber: 'SI-2026-01003', dueDate: inv('arinv-03').dueDate,
      overdueDays: inv('arinv-03').overdueDays, outstandingAmount: inv('arinv-03').outstandingBalance,
      lastReminderDate: dateOnly(-20), reminderLevel: 'Final Reminder', category: 'Above 60 Days',
      contactPerson: cust(1).contactPerson, email: cust(1).email, mobile: cust(1).mobile,
      collectionOwner: cust(1).collectionOwner, excluded: false, demoMarkedSentAt: dateTime(-20, 9, 0),
    },
    {
      id: 'arrem-03', customerId: cust(2).id, customerName: cust(2).customerName,
      invoiceId: 'arinv-05', invoiceNumber: 'SI-2026-01005', dueDate: inv('arinv-05').dueDate,
      overdueDays: inv('arinv-05').overdueDays, outstandingAmount: inv('arinv-05').outstandingBalance,
      lastReminderDate: dateOnly(-30), reminderLevel: 'Escalation Notice', category: 'Above 60 Days',
      contactPerson: cust(2).contactPerson, email: cust(2).email, mobile: cust(2).mobile,
      collectionOwner: cust(2).collectionOwner, excluded: false, demoMarkedSentAt: dateTime(-30, 11, 0),
    },
    {
      id: 'arrem-04', customerId: cust(3).id, customerName: cust(3).customerName,
      invoiceId: 'arinv-08', invoiceNumber: 'SI-2026-01008', dueDate: inv('arinv-08').dueDate,
      overdueDays: inv('arinv-08').overdueDays, outstandingAmount: inv('arinv-08').outstandingBalance,
      lastReminderDate: dateOnly(-2), reminderLevel: 'First Overdue Reminder', category: '1–7 Days Overdue',
      contactPerson: cust(3).contactPerson, email: cust(3).email, mobile: cust(3).mobile,
      collectionOwner: cust(3).collectionOwner, excluded: false, demoMarkedSentAt: dateTime(-2, 11, 0),
    },
    {
      id: 'arrem-05', customerId: cust(1).id, customerName: cust(1).customerName,
      invoiceId: 'arinv-04', invoiceNumber: 'SI-2026-01004', dueDate: inv('arinv-04').dueDate,
      overdueDays: 0, outstandingAmount: inv('arinv-04').outstandingBalance,
      lastReminderDate: null, reminderLevel: 'Courtesy Reminder', category: 'Due Soon',
      contactPerson: cust(1).contactPerson, email: cust(1).email, mobile: cust(1).mobile,
      collectionOwner: cust(1).collectionOwner, excluded: false, demoMarkedSentAt: null,
    },
    {
      id: 'arrem-06', customerId: cust(7).id, customerName: cust(7).customerName,
      invoiceId: 'arinv-16', invoiceNumber: 'SI-2026-01016', dueDate: inv('arinv-16').dueDate,
      overdueDays: 0, outstandingAmount: inv('arinv-16').outstandingBalance,
      lastReminderDate: null, reminderLevel: 'Courtesy Reminder', category: 'Due Today',
      contactPerson: cust(7).contactPerson, email: cust(7).email, mobile: cust(7).mobile,
      collectionOwner: cust(7).collectionOwner, excluded: false, demoMarkedSentAt: null,
    },
    {
      id: 'arrem-07', customerId: cust(1).id, customerName: cust(1).customerName,
      invoiceId: 'arinv-03', invoiceNumber: 'SI-2026-01003', dueDate: inv('arinv-03').dueDate,
      overdueDays: inv('arinv-03').overdueDays, outstandingAmount: inv('arinv-03').outstandingBalance,
      lastReminderDate: dateOnly(-8), reminderLevel: 'Credit Hold Warning', category: 'Broken Promise',
      contactPerson: cust(1).contactPerson, email: cust(1).email, mobile: cust(1).mobile,
      collectionOwner: cust(1).collectionOwner, excluded: false, demoMarkedSentAt: dateTime(-8, 14, 0),
    },
    {
      id: 'arrem-08', customerId: cust(7).id, customerName: cust(7).customerName,
      invoiceId: 'arinv-15', invoiceNumber: 'SI-2026-01015', dueDate: dateOnly(15),
      overdueDays: 0, outstandingAmount: 80_100,
      lastReminderDate: null, reminderLevel: 'Courtesy Reminder', category: 'Payment Promise Due',
      contactPerson: cust(7).contactPerson, email: cust(7).email, mobile: cust(7).mobile,
      collectionOwner: cust(7).collectionOwner, excluded: false, demoMarkedSentAt: null,
    },
    {
      id: 'arrem-09', customerId: cust(2).id, customerName: cust(2).customerName,
      invoiceId: 'arinv-06', invoiceNumber: 'SI-2026-01006', dueDate: inv('arinv-06').dueDate,
      overdueDays: inv('arinv-06').overdueDays, outstandingAmount: inv('arinv-06').outstandingBalance,
      lastReminderDate: dateOnly(-8), reminderLevel: 'First Overdue Reminder', category: '8–30 Days Overdue',
      contactPerson: cust(2).contactPerson, email: cust(2).email, mobile: cust(2).mobile,
      collectionOwner: cust(2).collectionOwner, excluded: false, demoMarkedSentAt: dateTime(-8, 10, 0),
    },
    {
      id: 'arrem-10', customerId: cust(4).id, customerName: cust(4).customerName,
      invoiceId: 'arinv-10', invoiceNumber: 'SI-2026-01010', dueDate: inv('arinv-10').dueDate,
      overdueDays: inv('arinv-10').overdueDays, outstandingAmount: inv('arinv-10').outstandingBalance,
      lastReminderDate: dateOnly(-45), reminderLevel: 'Escalation Notice', category: 'Above 60 Days',
      contactPerson: cust(4).contactPerson, email: cust(4).email, mobile: cust(4).mobile,
      collectionOwner: cust(4).collectionOwner, excluded: true, demoMarkedSentAt: dateTime(-45, 9, 0),
    },
  ]
}

export function seedReceivableAudit(): ReceivableAuditEntry[] {
  return [
    { id: 'araud-01', entityType: 'Receipt', entityId: 'arrcpt-01', action: 'Posted',
      details: 'Receipt RCPT-2026-00421 posted — ₹5,00,000 partial allocation to SI-2026-01001',
      performedBy: POSTED_BY, performedAt: dateTime(-12, 14, 30), isDemo: true },
    { id: 'araud-02', entityType: 'Invoice', entityId: 'arinv-09', action: 'Dispute Linked',
      details: 'Dispute DSP-2026-0001 raised — price difference ₹33,600',
      performedBy: COLLECTION_OWNERS[3], performedAt: dateTime(-12, 10, 5), isDemo: true },
    { id: 'araud-03', entityType: 'Customer', entityId: 'arcust-05', action: 'Credit Hold',
      details: 'Credit hold applied — over limit + 90-day overdue on SI-2026-01009',
      performedBy: 'Ananya Iyer', performedAt: dateTime(-10, 16, 0), isDemo: true },
    { id: 'araud-04', entityType: 'PaymentPromise', entityId: 'arprom-02', action: 'Marked Broken',
      details: 'Promise dated 30 Jun broken — no payment received from Gujarat Engineering',
      performedBy: COLLECTION_OWNERS[1], performedAt: dateTime(-8, 9, 0), isDemo: true },
    { id: 'araud-05', entityType: 'Receipt', entityId: 'arrcpt-04', action: 'Posted Unallocated',
      details: 'Advance ₹5,00,000 posted — unallocated for Chennai Pharma',
      performedBy: POSTED_BY, performedAt: dateTime(-3, 10, 20), isDemo: true },
    { id: 'araud-06', entityType: 'CreditNote', entityId: 'arcn-01', action: 'Submitted',
      details: 'CN-2026-00041 submitted for approval — quality claim ₹75,000',
      performedBy: CREATED_BY, performedAt: dateTime(-20, 11, 0), isDemo: true },
    { id: 'araud-07', entityType: 'CollectionActivity', entityId: 'aract-07', action: 'Escalated',
      details: 'Vapi Chemical 120-day overdue escalated to sales director',
      performedBy: COLLECTION_OWNERS[2], performedAt: dateTime(-6, 17, 5), isDemo: true },
    { id: 'araud-08', entityType: 'Reminder', entityId: 'arrem-02', action: 'Sent',
      details: 'Final reminder emailed for SI-2026-01003 — ₹7,31,600 outstanding',
      performedBy: COLLECTION_OWNERS[1], performedAt: dateTime(-20, 9, 5), isDemo: true },
    { id: 'araud-09', entityType: 'Customer', entityId: 'arcust-07', action: 'Credit Released',
      details: 'Temporary credit release approved for GSRTC — govt tender dispatch',
      performedBy: 'Rahul Mehta', performedAt: dateTime(-30, 14, 0), isDemo: true },
    { id: 'araud-10', entityType: 'Receipt', entityId: 'arrcpt-08', action: 'Pending Approval',
      details: 'GSRTC cheque ₹2,80,000 submitted — awaiting finance manager approval',
      performedBy: CREATED_BY, performedAt: dateTime(0, 11, 5), isDemo: true },
  ]
}

const SAVED_VIEW_COLS = ['customerName', 'outstandingBalance', 'overdueDays', 'collectionOwner', 'invoiceStatus']

export const SEED_RECEIVABLE_SAVED_VIEWS: ReceivableSavedView[] = [
  {
    id: 'arview-01', name: 'Customers Above Credit Limit',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, creditStatus: 'Over Limit', workspaceTab: 'outstanding' },
    columns: SAVED_VIEW_COLS, sortKey: 'outstandingBalance', sortDir: 'desc', selectedTab: 'outstanding',
    createdAt: dateTime(-60), isDemo: true,
  },
  {
    id: 'arview-02', name: 'Overdue Above 60 Days',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, ageingBucket: '61–90 Days', overdueStatus: 'overdue', workspaceTab: 'ageing' },
    columns: SAVED_VIEW_COLS, sortKey: 'overdueDays', sortDir: 'desc', selectedTab: 'ageing',
    createdAt: dateTime(-45), isDemo: true,
  },
  {
    id: 'arview-03', name: 'Collection Due Today',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, dueDateFrom: dateOnly(0), dueDateTo: dateOnly(0), workspaceTab: 'collections' },
    columns: SAVED_VIEW_COLS, sortKey: 'dueDate', sortDir: 'asc', selectedTab: 'collections',
    createdAt: dateTime(-30), isDemo: true,
  },
  {
    id: 'arview-04', name: 'Broken Payment Promises',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, hasPaymentPromise: 'yes', reminderCategory: 'Broken Promise', workspaceTab: 'collections' },
    columns: SAVED_VIEW_COLS, sortKey: 'promiseDate', sortDir: 'desc', selectedTab: 'collections',
    createdAt: dateTime(-20), isDemo: true,
  },
  {
    id: 'arview-05', name: 'Unallocated Receipts',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, allocationStatus: 'Unallocated', workspaceTab: 'receipts' },
    columns: ['receiptNumber', 'customerName', 'receiptAmount', 'unallocatedAmount', 'voucherStatus'],
    sortKey: 'receiptDate', sortDir: 'desc', selectedTab: 'receipts',
    createdAt: dateTime(-15), isDemo: true,
  },
  {
    id: 'arview-06', name: 'High-Value Outstanding',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, amountMin: 500_000, workspaceTab: 'outstanding' },
    columns: SAVED_VIEW_COLS, sortKey: 'outstandingBalance', sortDir: 'desc', selectedTab: 'outstanding',
    createdAt: dateTime(-10), isDemo: true,
  },
  {
    id: 'arview-07', name: 'Gujarat Customers',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, state: 'Gujarat', workspaceTab: 'outstanding' },
    columns: SAVED_VIEW_COLS, sortKey: 'customerName', sortDir: 'asc', selectedTab: 'outstanding',
    createdAt: dateTime(-8), isDemo: true,
  },
  {
    id: 'arview-08', name: 'My Collection Portfolio',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, collectionOwner: COLLECTION_OWNERS[0], collectionTab: 'my_worklist', workspaceTab: 'collections' },
    columns: SAVED_VIEW_COLS, sortKey: 'overdueDays', sortDir: 'desc', selectedTab: 'collections',
    createdAt: dateTime(-5), isDemo: true,
  },
  {
    id: 'arview-09', name: 'Disputed Invoices',
    filters: { ...DEFAULT_RECEIVABLE_FILTER, hasDispute: 'yes', invoiceStatus: 'Disputed', workspaceTab: 'disputes' },
    columns: SAVED_VIEW_COLS, sortKey: 'disputedAmount', sortDir: 'desc', selectedTab: 'disputes',
    createdAt: dateTime(-3), isDemo: true,
  },
]
