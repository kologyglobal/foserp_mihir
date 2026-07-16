/**
 * Accounts Payable — Indian manufacturing vendor AP demo seed (frontend only).
 * Vendors aligned with CoA / ledger party names (Bharat Steel Traders, Western Logistics Co).
 * Mutate via payablesService; does NOT post real GL or trigger bank payments.
 */
import type {
  MatchStatus,
  MsmeAgeingRow,
  PayableAgeingBucket,
  PayablesAuditEntry,
  PayableDebitNote,
  PayableInvoice,
  PayableInvoiceStatus,
  PayablesReportCatalogEntry,
  PayablesSetup,
  PaymentAllocationLine,
  PaymentHold,
  PaymentProposal,
  PaymentProposalLine,
  ThreeWayMatchResult,
  VendorAdvance,
  VendorBankDetails,
  VendorDispute,
  VendorPayment,
  PayableVendor,
} from '../../types/payables'

const CREATED_BY = 'Priya Sharma'
const APPROVED_BY = 'Rahul Mehta'
const AP_OWNERS = ['Priya Sharma', 'Rohit Jain', 'Ananya Iyer'] as const

export const PAYABLE_BANK_ACCOUNTS = [
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

function computeAgeing(dueDate: string): { overdueDays: number; ageingBucket: PayableAgeingBucket } {
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
): PaymentAllocationLine {
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
    tdsDeducted: tds,
    allocationAmount: allocAmt,
    remainingBalance: remaining,
    status: remaining <= 0 ? 'Fully Settled' : 'Partially Settled',
  }
}

function paymentExtras(
  net: number,
  tds = 0,
  other = 0,
  bankCharges = 0,
  tdsSection: string | null = null,
  tdsRate: number | null = null,
  masked: string | null = null,
) {
  const gross = net + tds + other + bankCharges
  return {
    amount: net,
    grossAmount: gross,
    netPayment: net,
    otherDeductions: other,
    bankCharges,
    beneficiaryBankMasked: masked,
    currency: 'INR',
    exchangeRate: 1,
    tdsDeducted: tds,
    tdsSection,
    tdsRate,
    tdsBaseAmount: tdsSection ? gross : null,
  }
}

export function seedPaymentHolds(): PaymentHold[] {
  return [
    {
      id: 'phold-01',
      holdType: 'Vendor',
      reason: 'Dispute',
      status: 'Active',
      entityId: 'apvnd-05',
      entityType: 'vendor',
      placedBy: AP_OWNERS[0],
      placedAt: dateTime(-8, 15, 0),
      releasedBy: null,
      releasedAt: null,
      remarks: 'Quality dispute on NSF/INV/3340 — payment blocked until resolution',
    },
    {
      id: 'phold-02',
      holdType: 'Invoice',
      reason: 'Three-Way Match Failure',
      status: 'Active',
      entityId: 'apinv-04',
      entityType: 'invoice',
      placedBy: AP_OWNERS[1],
      placedAt: dateTime(-5, 11, 0),
      releasedBy: null,
      releasedAt: null,
      remarks: 'GRN qty 950 vs invoice qty 1000 — awaiting stores confirmation',
    },
    {
      id: 'phold-03',
      holdType: 'Invoice',
      reason: 'Bank Verification Pending',
      status: 'Active',
      entityId: 'apinv-07',
      entityType: 'invoice',
      placedBy: AP_OWNERS[2],
      placedAt: dateTime(-2, 9, 30),
      releasedBy: null,
      releasedAt: null,
      remarks: 'Western Logistics bank details changed recently',
    },
  ]
}

export function seedVendorBankDetails(): VendorBankDetails[] {
  return [
    {
      vendorId: 'apvnd-01',
      beneficiaryName: 'Bharat Steel Traders',
      bankName: 'HDFC Bank',
      branch: 'Pune Camp',
      ifsc: 'HDFC0001234',
      accountNumberMasked: 'XXXXXX4521',
      accountType: 'Current',
      verificationStatus: 'Verified',
      verifiedBy: APPROVED_BY,
      verifiedAt: dateTime(-120, 10, 0),
      lastChangedAt: dateTime(-120, 10, 0),
    },
    {
      vendorId: 'apvnd-02',
      beneficiaryName: 'Precision Fasteners India',
      bankName: 'ICICI Bank',
      branch: 'Chakan MIDC',
      ifsc: 'ICIC0005678',
      accountNumberMasked: 'XXXXXX8890',
      accountType: 'Current',
      verificationStatus: 'Verified',
      verifiedBy: APPROVED_BY,
      verifiedAt: dateTime(-90, 14, 0),
      lastChangedAt: dateTime(-90, 14, 0),
    },
    {
      vendorId: 'apvnd-03',
      beneficiaryName: 'Suraj Paints & Coatings',
      bankName: 'HDFC Bank',
      branch: 'Bhosari',
      ifsc: 'HDFC0003344',
      accountNumberMasked: 'XXXXXX2210',
      accountType: 'Current',
      verificationStatus: 'Verified',
      verifiedBy: CREATED_BY,
      verifiedAt: dateTime(-60, 11, 0),
      lastChangedAt: dateTime(-60, 11, 0),
    },
    {
      vendorId: 'apvnd-04',
      beneficiaryName: 'Western Logistics Co',
      bankName: 'Axis Bank',
      branch: 'Pune Nagar Road',
      ifsc: 'UTIB0007788',
      accountNumberMasked: 'XXXXXX6633',
      accountType: 'Current',
      verificationStatus: 'Changed Recently',
      verifiedBy: null,
      verifiedAt: null,
      lastChangedAt: dateTime(-3, 16, 0),
    },
    {
      vendorId: 'apvnd-05',
      beneficiaryName: 'Nashik Subcontract Fabricators',
      bankName: 'Bank of Baroda',
      branch: 'Nashik MIDC',
      ifsc: 'BARB0NASHIK',
      accountNumberMasked: 'XXXXXX1102',
      accountType: 'Current',
      verificationStatus: 'Pending Verification',
      verifiedBy: null,
      verifiedAt: null,
      lastChangedAt: dateTime(-15, 9, 0),
    },
    {
      vendorId: 'apvnd-06',
      beneficiaryName: 'Pune Industrial Utilities Board',
      bankName: 'State Bank of India',
      branch: 'Pune Main',
      ifsc: 'SBIN0000456',
      accountNumberMasked: 'XXXXXX9901',
      accountType: 'Current',
      verificationStatus: 'Verified',
      verifiedBy: APPROVED_BY,
      verifiedAt: dateTime(-200, 10, 0),
      lastChangedAt: dateTime(-200, 10, 0),
    },
  ]
}

export function seedPayableVendors(): PayableVendor[] {
  const holds = seedPaymentHolds()
  const vendorHold = holds.find((h) => h.entityId === 'apvnd-05' && h.status === 'Active') ?? null
  return [
    {
      id: 'apvnd-01',
      code: 'VND-STEEL',
      name: 'Bharat Steel Traders',
      gstin: '27AABCB1234A1Z5',
      pan: 'AABCB1234A',
      state: 'Maharashtra',
      creditDays: 30,
      creditLimit: 3_000_000,
      outstanding: 0,
      overdue: 0,
      status: 'Active',
      category: 'Steel & RM',
      vendorGroup: 'Raw Material Vendors',
      contactPerson: 'Ramesh Bhosale',
      email: 'accounts@bharatsteel.in',
      mobile: '+91 98220 44110',
      paymentTerms: 'Net 30',
      buyer: 'Rohit Jain',
      bankAccountName: 'HDFC Bank — Current A/c',
      bankVerificationStatus: 'Verified',
      msmeCategory: 'Small',
      msmeStatus: 'Registered',
      paymentHold: null,
      masterVendorId: 'party-vnd-steel',
    },
    {
      id: 'apvnd-02',
      code: 'VND-FAST',
      name: 'Precision Fasteners India',
      gstin: '27AABCP5678B1Z2',
      pan: 'AABCP5678B',
      state: 'Maharashtra',
      creditDays: 45,
      creditLimit: 800_000,
      outstanding: 0,
      overdue: 0,
      status: 'Active',
      category: 'Fasteners & Consumables',
      vendorGroup: 'Consumables',
      contactPerson: 'Vikram Kulkarni',
      email: 'billing@precisionfasteners.in',
      mobile: '+91 98765 11220',
      paymentTerms: 'Net 45',
      buyer: 'Ananya Iyer',
      bankAccountName: 'ICICI Bank — Current A/c',
      bankVerificationStatus: 'Verified',
      msmeCategory: 'Micro',
      msmeStatus: 'Registered',
      paymentHold: null,
      masterVendorId: 'mvnd-fast-01',
    },
    {
      id: 'apvnd-03',
      code: 'VND-PAINT',
      name: 'Suraj Paints & Coatings',
      gstin: '27AABCS9012C1Z8',
      pan: 'AABCS9012C',
      state: 'Maharashtra',
      creditDays: 30,
      creditLimit: 500_000,
      outstanding: 0,
      overdue: 0,
      status: 'Active',
      category: 'Paint & Chemicals',
      vendorGroup: 'Consumables',
      contactPerson: 'Sunil Deshmukh',
      email: 'ap@surajpaints.co.in',
      mobile: '+91 99220 33445',
      paymentTerms: 'Net 30',
      buyer: 'Rohit Jain',
      bankAccountName: 'HDFC Bank — Current A/c',
      bankVerificationStatus: 'Verified',
      msmeCategory: 'Small',
      msmeStatus: 'Registered',
      paymentHold: null,
      masterVendorId: 'mvnd-paint-01',
    },
    {
      id: 'apvnd-04',
      code: 'VND-FRT',
      name: 'Western Logistics Co',
      gstin: '27AAACW9012C1Z8',
      pan: 'AAACW9012C',
      state: 'Maharashtra',
      creditDays: 15,
      creditLimit: 400_000,
      outstanding: 0,
      overdue: 0,
      status: 'Active',
      category: 'Freight & Logistics',
      vendorGroup: 'Logistics',
      contactPerson: 'Mahesh Wagh',
      email: 'finance@westernlogistics.in',
      mobile: '+91 97660 77881',
      paymentTerms: 'Net 15',
      buyer: 'Priya Sharma',
      bankAccountName: 'HDFC Bank — Current A/c',
      bankVerificationStatus: 'Changed Recently',
      msmeCategory: 'Not MSME',
      msmeStatus: 'Not Applicable',
      paymentHold: null,
      masterVendorId: 'party-v-freight',
    },
    {
      id: 'apvnd-05',
      code: 'VND-SUB',
      name: 'Nashik Subcontract Fabricators',
      gstin: '27AABCN3456D1Z3',
      pan: 'AABCN3456D',
      state: 'Maharashtra',
      creditDays: 30,
      creditLimit: 1_200_000,
      outstanding: 0,
      overdue: 0,
      status: 'On Hold',
      category: 'Subcontract Job-work',
      vendorGroup: 'Job-work Vendors',
      contactPerson: 'Sanjay More',
      email: 'billing@nashiksubfab.in',
      mobile: '+91 97660 88990',
      paymentTerms: 'Net 30 — TDS u/s 194C',
      buyer: 'Rohit Jain',
      bankAccountName: 'Bank of Baroda — Current A/c',
      bankVerificationStatus: 'Pending Verification',
      msmeCategory: 'Medium',
      msmeStatus: 'Registered',
      paymentHold: vendorHold,
      masterVendorId: 'mvnd-sub-01',
    },
    {
      id: 'apvnd-06',
      code: 'VND-UTIL',
      name: 'Pune Industrial Utilities Board',
      gstin: '27AAACU7890E1Z1',
      pan: 'AAACU7890E',
      state: 'Maharashtra',
      creditDays: 7,
      creditLimit: 200_000,
      outstanding: 0,
      overdue: 0,
      status: 'Active',
      category: 'Utilities',
      vendorGroup: 'Utilities & Services',
      contactPerson: 'Accounts Section',
      email: 'billing@piutilities.gov.in',
      mobile: '+91 20 2567 1100',
      paymentTerms: 'Net 7',
      buyer: 'Priya Sharma',
      bankAccountName: 'State Bank of India — Current A/c',
      bankVerificationStatus: 'Verified',
      msmeCategory: 'Not MSME',
      msmeStatus: 'Not Applicable',
      paymentHold: null,
      masterVendorId: 'mvnd-util-01',
    },
  ]
}

type InvSeed = {
  id: string
  num: string
  vendorNum: string
  vndIdx: number
  invDays: number
  dueDays: number
  taxable: number
  intra: boolean
  paid: number
  dnAmt: number
  status: PayableInvoiceStatus
  plant: string
  cc: string
  po?: string
  grn?: string
  ref?: string
  hasDispute?: boolean
  hasDN?: boolean
  matchStatus?: MatchStatus
  approvalStatus?: PayableInvoice['approvalStatus']
  holdId?: string
  tdsAmount?: number
  tdsSection?: string
  duplicateWarning?: boolean
}

function buildInvoice(s: InvSeed, vendors: PayableVendor[], holds: PaymentHold[]): PayableInvoice {
  const v = vendors[s.vndIdx]
  const invoiceDate = dateOnly(s.invDays)
  const dueDate = dateOnly(s.dueDays)
  const { overdueDays, ageingBucket } = computeAgeing(dueDate)
  const tax = gstSplit(s.taxable, s.intra)
  const originalAmount = s.taxable + tax.cgst + tax.sgst + tax.igst
  const outstandingBalance = Math.max(0, originalAmount - s.paid - s.dnAmt)
  let status = s.status
  if (status !== 'Paid' && status !== 'Disputed' && status !== 'Cancelled') {
    if (outstandingBalance <= 0) status = 'Paid'
    else if (s.paid > 0) status = 'Partially Paid'
    else if (overdueDays > 0) status = 'Overdue'
    else status = 'Open'
  }
  const hold = s.holdId ? holds.find((h) => h.id === s.holdId) ?? null : null
  return {
    id: s.id,
    invoiceNumber: s.num,
    vendorInvoiceNumber: s.vendorNum,
    vendorId: v.id,
    vendorCode: v.code,
    vendorName: v.name,
    invoiceDate,
    dueDate,
    postingDate: invoiceDate,
    originalAmount,
    taxableAmount: s.taxable,
    ...tax,
    paidAmount: s.paid,
    debitNoteAmount: s.dnAmt,
    outstandingBalance,
    status,
    matchStatus: s.matchStatus ?? 'Fully Matched',
    approvalStatus: s.approvalStatus ?? 'Approved',
    paymentHold: hold,
    ageingBucket: outstandingBalance > 0 ? ageingBucket : 'Not Due',
    overdueDays: outstandingBalance > 0 ? overdueDays : 0,
    plant: s.plant,
    location: s.plant,
    costCentre: s.cc,
    buyer: v.buyer,
    poNumber: s.po ?? null,
    grnNumber: s.grn ?? null,
    reference: s.ref ?? null,
    tdsAmount: s.tdsAmount ?? 0,
    tdsSection: s.tdsSection ?? null,
    msmeVendor: v.msmeCategory !== 'Not MSME',
    duplicateWarning: s.duplicateWarning ?? false,
    gstRegistrationType: 'Regular',
    hasDispute: s.hasDispute ?? false,
    hasDebitNote: s.hasDN ?? false,
    sourcePurchaseInvoiceId: `pi-${s.id}`,
  }
}

export function seedPayableInvoices(): PayableInvoice[] {
  const vendors = seedPayableVendors()
  const holds = seedPaymentHolds()
  const seeds: InvSeed[] = [
    { id: 'apinv-01', num: 'BST/INV/8842', vendorNum: 'BST-8842', vndIdx: 0, invDays: -68, dueDays: -38, taxable: 250_000, intra: true, paid: 205_000, dnAmt: 0, status: 'Partially Paid', plant: 'Main Plant — Pune', cc: 'Production', po: 'PO-2026-0088', grn: 'GRN-2026-0441', ref: 'MS plate 12mm' },
    { id: 'apinv-02', num: 'BST/INV/8891', vendorNum: 'BST-8891', vndIdx: 0, invDays: -22, dueDays: 8, taxable: 180_000, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Production', po: 'PO-2026-0112', grn: 'GRN-2026-0512', ref: 'MS angle 50x50' },
    { id: 'apinv-03', num: 'PFI/INV/2204', vendorNum: 'PFI-2204', vndIdx: 1, invDays: -45, dueDays: 0, taxable: 42_000, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Assembly', po: 'PO-2026-0095', grn: 'GRN-2026-0488', ref: 'HT bolts M12', matchStatus: 'Fully Matched' },
    { id: 'apinv-04', num: 'PFI/INV/2218', vendorNum: 'PFI-2218', vndIdx: 1, invDays: -82, dueDays: -37, taxable: 68_000, intra: true, paid: 0, dnAmt: 0, status: 'Overdue', plant: 'Main Plant — Pune', cc: 'Assembly', po: 'PO-2026-0071', grn: 'GRN-2026-0395', matchStatus: 'Quantity Mismatch', holdId: 'phold-02' },
    { id: 'apinv-05', num: 'SPC/INV/1188', vendorNum: 'SPC-1188', vndIdx: 2, invDays: -18, dueDays: 12, taxable: 95_000, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Painting', po: 'PO-2026-0104', grn: 'GRN-2026-0501', ref: 'Epoxy primer 20L' },
    { id: 'apinv-06', num: 'SPC/INV/1195', vendorNum: 'SPC-1195', vndIdx: 2, invDays: -55, dueDays: -25, taxable: 38_000, intra: true, paid: 20_000, dnAmt: 0, status: 'Partially Paid', plant: 'Main Plant — Pune', cc: 'Painting', po: 'PO-2026-0082', grn: 'GRN-2026-0422' },
    { id: 'apinv-07', num: 'WLC/INV/4421', vendorNum: 'WLC-4421', vndIdx: 3, invDays: -48, dueDays: -33, taxable: 28_000, intra: true, paid: 0, dnAmt: 0, status: 'Overdue', plant: 'Main Plant — Pune', cc: 'Logistics', po: 'LR-88421', ref: 'Inbound RM freight', holdId: 'phold-03' },
    { id: 'apinv-08', num: 'WLC/INV/4455', vendorNum: 'WLC-4455', vndIdx: 3, invDays: -8, dueDays: 7, taxable: 15_500, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Logistics', ref: 'FG dispatch freight' },
    { id: 'apinv-09', num: 'NSF/INV/3340', vendorNum: 'NSF-3340', vndIdx: 4, invDays: -35, dueDays: -5, taxable: 185_000, intra: true, paid: 0, dnAmt: 0, status: 'Disputed', plant: 'Main Plant — Pune', cc: 'Fabrication', po: 'PO-2026-0099', grn: 'GRN-2026-0466', hasDispute: true, matchStatus: 'Pending Verification', approvalStatus: 'Pending' },
    { id: 'apinv-10', num: 'NSF/INV/3355', vendorNum: 'NSF-3355', vndIdx: 4, invDays: -12, dueDays: 18, taxable: 120_000, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Fabrication', po: 'PO-2026-0118', grn: 'GRN-2026-0520', ref: 'Chassis welding job-work', tdsAmount: 12_000, tdsSection: '194C' },
    { id: 'apinv-11', num: 'CON/INV/1188', vendorNum: 'CON-1188', vndIdx: 4, invDays: -42, dueDays: -12, taxable: 50_000, intra: true, paid: 45_000, dnAmt: 0, status: 'Partially Paid', plant: 'Main Plant — Pune', cc: 'Fabrication', po: 'PO-2026-0088', grn: 'GRN-2026-0433', ref: 'TDS u/s 194C deducted', tdsAmount: 5_000, tdsSection: '194C' },
    { id: 'apinv-12', num: 'PIU/INV/JUN26', vendorNum: 'PIU-JUN26', vndIdx: 5, invDays: -28, dueDays: -21, taxable: 72_000, intra: true, paid: 0, dnAmt: 0, status: 'Overdue', plant: 'Main Plant — Pune', cc: 'Admin', ref: 'Electricity — June 2026' },
    { id: 'apinv-13', num: 'PIU/INV/JUL26', vendorNum: 'PIU-JUL26', vndIdx: 5, invDays: -5, dueDays: 2, taxable: 78_500, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Admin', ref: 'Electricity — July 2026' },
    { id: 'apinv-14', num: 'BST/INV/8750', vendorNum: 'BST-8750', vndIdx: 0, invDays: -95, dueDays: -65, taxable: 320_000, intra: true, paid: 377_600, dnAmt: 0, status: 'Paid', plant: 'Main Plant — Pune', cc: 'Production', po: 'PO-2026-0062', grn: 'GRN-2026-0310' },
    { id: 'apinv-15', num: 'PFI/INV/2150', vendorNum: 'PFI-2150', vndIdx: 1, invDays: -15, dueDays: 30, taxable: 55_000, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Assembly', po: 'PO-2026-0108', grn: 'GRN-2026-0499' },
    { id: 'apinv-16', num: 'SPC/INV/1172', vendorNum: 'SPC-1172', vndIdx: 2, invDays: -72, dueDays: -42, taxable: 22_000, intra: true, paid: 0, dnAmt: 0, status: 'Disputed', plant: 'Main Plant — Pune', cc: 'Painting', hasDispute: true, po: 'PO-2026-0075', grn: 'GRN-2026-0388', matchStatus: 'Quantity Mismatch' },
    { id: 'apinv-17', num: 'BST/INV/8905', vendorNum: 'BST-8905', vndIdx: 0, invDays: -3, dueDays: 27, taxable: 95_000, intra: true, paid: 0, dnAmt: 0, status: 'Open', plant: 'Main Plant — Pune', cc: 'Production', po: 'PO-2026-0120', ref: 'Possible duplicate of BST/INV/8891', duplicateWarning: true, matchStatus: 'Pending Verification', approvalStatus: 'Pending' },
  ]
  return seeds.map((s) => buildInvoice(s, vendors, holds))
}

export function seedThreeWayMatches(): ThreeWayMatchResult[] {
  return [
    {
      invoiceId: 'apinv-04',
      invoiceNumber: 'PFI/INV/2218',
      vendorName: 'Precision Fasteners India',
      poNumber: 'PO-2026-0071',
      grnNumber: 'GRN-2026-0395',
      overallStatus: 'Quantity Mismatch',
      totalDifference: 4_240,
      toleranceAmount: 500,
      withinTolerance: false,
      verifiedBy: null,
      verifiedAt: null,
      lines: [
        {
          itemDescription: 'HT bolts M12 x 80',
          poQty: 1000,
          grnQty: 950,
          invoiceQty: 1000,
          poRate: 42,
          grnRate: 42,
          invoiceRate: 42,
          poTax: 7_560,
          grnTax: 7_182,
          invoiceTax: 7_560,
          poValue: 49_560,
          grnValue: 47_082,
          invoiceValue: 49_560,
          difference: 2_478,
          tolerance: 250,
          status: 'Quantity Mismatch',
          comment: 'GRN received 50 pcs short — stores confirmation pending',
        },
        {
          itemDescription: 'Nyloc nuts M12',
          poQty: 500,
          grnQty: 480,
          invoiceQty: 500,
          poRate: 18,
          grnRate: 18,
          invoiceRate: 18,
          poTax: 1_620,
          grnTax: 1_555,
          invoiceTax: 1_620,
          poValue: 10_620,
          grnValue: 10_195,
          invoiceValue: 10_620,
          difference: 1_762,
          tolerance: 250,
          status: 'Quantity Mismatch',
          comment: 'Short supply of 20 pcs on GRN',
        },
      ],
    },
    {
      invoiceId: 'apinv-01',
      invoiceNumber: 'BST/INV/8842',
      vendorName: 'Bharat Steel Traders',
      poNumber: 'PO-2026-0088',
      grnNumber: 'GRN-2026-0441',
      overallStatus: 'Fully Matched',
      totalDifference: 0,
      toleranceAmount: 2_500,
      withinTolerance: true,
      verifiedBy: APPROVED_BY,
      verifiedAt: dateTime(-65, 11, 0),
      lines: [
        {
          itemDescription: 'MS plate 12mm',
          poQty: 10,
          grnQty: 10,
          invoiceQty: 10,
          poRate: 25_000,
          grnRate: 25_000,
          invoiceRate: 25_000,
          poTax: 45_000,
          grnTax: 45_000,
          invoiceTax: 45_000,
          poValue: 295_000,
          grnValue: 295_000,
          invoiceValue: 295_000,
          difference: 0,
          tolerance: 2_500,
          status: 'Fully Matched',
          comment: null,
        },
      ],
    },
  ]
}

export function seedPaymentProposals(): PaymentProposal[] {
  const invoices = seedPayableInvoices()
  const inv = (id: string) => invoices.find((x) => x.id === id)!

  const draftLines: PaymentProposalLine[] = [
    { id: 'ppl-01', invoiceId: 'apinv-02', invoiceNumber: inv('apinv-02').invoiceNumber, vendorId: inv('apinv-02').vendorId, vendorName: inv('apinv-02').vendorName, dueDate: inv('apinv-02').dueDate, outstanding: inv('apinv-02').outstandingBalance, proposedAmount: inv('apinv-02').outstandingBalance, selected: true },
    { id: 'ppl-02', invoiceId: 'apinv-03', invoiceNumber: inv('apinv-03').invoiceNumber, vendorId: inv('apinv-03').vendorId, vendorName: inv('apinv-03').vendorName, dueDate: inv('apinv-03').dueDate, outstanding: inv('apinv-03').outstandingBalance, proposedAmount: inv('apinv-03').outstandingBalance, selected: true },
    { id: 'ppl-03', invoiceId: 'apinv-05', invoiceNumber: inv('apinv-05').invoiceNumber, vendorId: inv('apinv-05').vendorId, vendorName: inv('apinv-05').vendorName, dueDate: inv('apinv-05').dueDate, outstanding: inv('apinv-05').outstandingBalance, proposedAmount: inv('apinv-05').outstandingBalance, selected: false },
  ]

  const submittedLines: PaymentProposalLine[] = [
    { id: 'ppl-04', invoiceId: 'apinv-01', invoiceNumber: inv('apinv-01').invoiceNumber, vendorId: inv('apinv-01').vendorId, vendorName: inv('apinv-01').vendorName, dueDate: inv('apinv-01').dueDate, outstanding: inv('apinv-01').outstandingBalance, proposedAmount: inv('apinv-01').outstandingBalance, selected: true },
    { id: 'ppl-05', invoiceId: 'apinv-07', invoiceNumber: inv('apinv-07').invoiceNumber, vendorId: inv('apinv-07').vendorId, vendorName: inv('apinv-07').vendorName, dueDate: inv('apinv-07').dueDate, outstanding: inv('apinv-07').outstandingBalance, proposedAmount: inv('apinv-07').outstandingBalance, selected: true },
    { id: 'ppl-06', invoiceId: 'apinv-12', invoiceNumber: inv('apinv-12').invoiceNumber, vendorId: inv('apinv-12').vendorId, vendorName: inv('apinv-12').vendorName, dueDate: inv('apinv-12').dueDate, outstanding: inv('apinv-12').outstandingBalance, proposedAmount: inv('apinv-12').outstandingBalance, selected: true },
  ]

  const approvedLines: PaymentProposalLine[] = [
    { id: 'ppl-07', invoiceId: 'apinv-04', invoiceNumber: inv('apinv-04').invoiceNumber, vendorId: inv('apinv-04').vendorId, vendorName: inv('apinv-04').vendorName, dueDate: inv('apinv-04').dueDate, outstanding: inv('apinv-04').outstandingBalance, proposedAmount: inv('apinv-04').outstandingBalance, selected: true },
    { id: 'ppl-08', invoiceId: 'apinv-06', invoiceNumber: inv('apinv-06').invoiceNumber, vendorId: inv('apinv-06').vendorId, vendorName: inv('apinv-06').vendorName, dueDate: inv('apinv-06').dueDate, outstanding: inv('apinv-06').outstandingBalance, proposedAmount: inv('apinv-06').outstandingBalance, selected: true },
  ]

  return [
    {
      id: 'aprop-01',
      proposalNumber: 'PP-2026-00018',
      status: 'Draft',
      proposedPaymentDate: dateOnly(5),
      totalAmount: draftLines.filter((l) => l.selected).reduce((s, l) => s + l.proposedAmount, 0),
      vendorCount: new Set(draftLines.filter((l) => l.selected).map((l) => l.vendorId)).size,
      invoiceCount: draftLines.filter((l) => l.selected).length,
      lines: draftLines,
      createdBy: CREATED_BY,
      approvedBy: null,
      rejectionReason: null,
      createdAt: dateTime(-2),
      submittedAt: null,
      approvedAt: null,
    },
    {
      id: 'aprop-02',
      proposalNumber: 'PP-2026-00019',
      status: 'Submitted',
      proposedPaymentDate: dateOnly(3),
      totalAmount: submittedLines.reduce((s, l) => s + l.proposedAmount, 0),
      vendorCount: new Set(submittedLines.map((l) => l.vendorId)).size,
      invoiceCount: submittedLines.length,
      lines: submittedLines,
      createdBy: CREATED_BY,
      approvedBy: null,
      rejectionReason: null,
      createdAt: dateTime(-4),
      submittedAt: dateTime(-1, 11, 0),
      approvedAt: null,
    },
    {
      id: 'aprop-03',
      proposalNumber: 'PP-2026-00017',
      status: 'Approved',
      proposedPaymentDate: dateOnly(1),
      totalAmount: approvedLines.reduce((s, l) => s + l.proposedAmount, 0),
      vendorCount: new Set(approvedLines.map((l) => l.vendorId)).size,
      invoiceCount: approvedLines.length,
      lines: approvedLines,
      createdBy: CREATED_BY,
      approvedBy: APPROVED_BY,
      rejectionReason: null,
      createdAt: dateTime(-6),
      submittedAt: dateTime(-5, 10, 0),
      approvedAt: dateTime(-3, 14, 30),
    },
    {
      id: 'aprop-04',
      proposalNumber: 'PP-2026-00016',
      status: 'Partially Processed',
      proposedPaymentDate: dateOnly(-5),
      totalAmount: 205_000,
      vendorCount: 1,
      invoiceCount: 1,
      lines: [
        { id: 'ppl-09', invoiceId: 'apinv-01', invoiceNumber: inv('apinv-01').invoiceNumber, vendorId: inv('apinv-01').vendorId, vendorName: inv('apinv-01').vendorName, dueDate: inv('apinv-01').dueDate, outstanding: 0, proposedAmount: 205_000, selected: true },
      ],
      createdBy: CREATED_BY,
      approvedBy: APPROVED_BY,
      rejectionReason: null,
      createdAt: dateTime(-40),
      submittedAt: dateTime(-39, 10, 0),
      approvedAt: dateTime(-38, 14, 0),
    },
  ]
}

export function seedVendorPayments(): VendorPayment[] {
  const vendors = seedPayableVendors()
  const invoices = seedPayableInvoices()
  const banks = seedVendorBankDetails()
  const inv = (id: string) => invoices.find((x) => x.id === id)!
  const bank = (id: string) => PAYABLE_BANK_ACCOUNTS.find((b) => b.id === id)!
  const masked = (vndId: string) => banks.find((b) => b.vendorId === vndId)?.accountNumberMasked ?? null

  const pay01Alloc = 205_000
  const pay01Lines = [allocLine('pal-01', inv('apinv-01'), 0, pay01Alloc)]
  const pay02Alloc = 45_000
  const pay02Tds = 5_000
  const pay02Lines = [allocLine('pal-02', inv('apinv-11'), 0, pay02Alloc, pay02Tds)]
  const pay03Alloc = 20_000
  const pay03Lines = [allocLine('pal-03', inv('apinv-06'), 0, pay03Alloc)]

  return [
    {
      id: 'apay-01',
      paymentNumber: 'PAY-2026-00089',
      status: 'Posted',
      vendorId: vendors[0].id,
      vendorCode: vendors[0].code,
      vendorName: vendors[0].name,
      paymentDate: dateOnly(-38),
      postingDate: dateOnly(-38),
      paymentMode: 'NEFT',
      bankAccountId: 'bank-hdfc',
      bankAccountName: bank('bank-hdfc').name,
      transactionReference: 'NEFT-8842910',
      chequeNumber: null,
      chequeDate: null,
      ...paymentExtras(pay01Alloc, 0, 0, 0, null, null, masked(vendors[0].id)),
      unallocatedAmount: 0,
      allocatedAmount: pay01Alloc,
      allocationStatus: 'Fully Allocated',
      allocationLines: pay01Lines,
      voucherId: 'vch-led-003',
      voucherNumber: 'PAY-2026-00089',
      ledgerEntryIds: ['gle-pay-01', 'gle-pay-02'],
      narration: 'NEFT payment to Bharat Steel Traders — BST/INV/8842 balance',
      internalRemarks: 'Matched with bank statement',
      createdBy: CREATED_BY,
      approvedBy: APPROVED_BY,
      postedBy: APPROVED_BY,
      postedAt: dateTime(-38, 14, 0),
      proposalId: 'aprop-04',
    },
    {
      id: 'apay-02',
      paymentNumber: 'PAY-2026-00112',
      status: 'Posted',
      vendorId: vendors[4].id,
      vendorCode: vendors[4].code,
      vendorName: vendors[4].name,
      paymentDate: dateOnly(-12),
      postingDate: dateOnly(-12),
      paymentMode: 'NEFT',
      bankAccountId: 'bank-hdfc',
      bankAccountName: bank('bank-hdfc').name,
      transactionReference: 'NEFT-194C-1188',
      chequeNumber: null,
      chequeDate: null,
      ...paymentExtras(45_000, pay02Tds, 0, 0, '194C', 2, masked(vendors[4].id)),
      unallocatedAmount: 0,
      allocatedAmount: pay02Alloc,
      allocationStatus: 'Fully Allocated',
      allocationLines: pay02Lines,
      voucherId: 'vch-led-016',
      voucherNumber: 'PAY-2026-00112',
      ledgerEntryIds: ['gle-tds-01', 'gle-tds-02', 'gle-tds-03'],
      narration: 'Subcontract payment after TDS u/s 194C — CON/INV/1188',
      internalRemarks: 'TDS challan filed for Q1',
      createdBy: CREATED_BY,
      approvedBy: APPROVED_BY,
      postedBy: APPROVED_BY,
      postedAt: dateTime(-12, 11, 30),
      proposalId: null,
    },
    {
      id: 'apay-03',
      paymentNumber: 'PAY-2026-00118',
      status: 'Posted',
      vendorId: vendors[2].id,
      vendorCode: vendors[2].code,
      vendorName: vendors[2].name,
      paymentDate: dateOnly(-5),
      postingDate: dateOnly(-5),
      paymentMode: 'RTGS',
      bankAccountId: 'bank-icici',
      bankAccountName: bank('bank-icici').name,
      transactionReference: 'RTGS-ICIC772104',
      chequeNumber: null,
      chequeDate: null,
      ...paymentExtras(50_000, 0, 0, 25, null, null, masked(vendors[2].id)),
      unallocatedAmount: 30_000,
      allocatedAmount: pay03Alloc,
      allocationStatus: 'Partially Allocated',
      allocationLines: pay03Lines,
      voucherId: 'vch-pay-118',
      voucherNumber: 'PAY-2026-00118',
      ledgerEntryIds: ['gle-pay-demo-118a', 'gle-pay-demo-118b'],
      narration: 'RTGS to Suraj Paints — partial against SPC/INV/1195',
      internalRemarks: '₹30,000 unallocated — advance carry-forward',
      createdBy: CREATED_BY,
      approvedBy: APPROVED_BY,
      postedBy: APPROVED_BY,
      postedAt: dateTime(-5, 16, 0),
      proposalId: null,
    },
    {
      id: 'apay-04',
      paymentNumber: 'PAY-DRAFT-0019',
      status: 'Draft',
      vendorId: vendors[3].id,
      vendorCode: vendors[3].code,
      vendorName: vendors[3].name,
      paymentDate: dateOnly(2),
      postingDate: dateOnly(2),
      paymentMode: 'Demand Draft',
      bankAccountId: 'bank-hdfc',
      bankAccountName: bank('bank-hdfc').name,
      transactionReference: null,
      chequeNumber: null,
      chequeDate: null,
      ...paymentExtras(33_040, 0, 0, 0, null, null, masked(vendors[3].id)),
      unallocatedAmount: 33_040,
      allocatedAmount: 0,
      allocationStatus: 'Unallocated',
      allocationLines: [],
      voucherId: null,
      voucherNumber: null,
      ledgerEntryIds: null,
      narration: 'Draft DD payment — Western Logistics overdue invoices',
      internalRemarks: 'Pending approval from accounts head',
      createdBy: CREATED_BY,
      approvedBy: null,
      postedBy: null,
      postedAt: null,
      proposalId: 'aprop-02',
    },
  ]
}

export function seedVendorAdvances(): VendorAdvance[] {
  const vendors = seedPayableVendors()
  return [
    {
      id: 'apadv-01',
      advanceNumber: 'ADV-2026-00012',
      advanceDate: dateOnly(-5),
      vendorId: vendors[2].id,
      vendorCode: vendors[2].code,
      vendorName: vendors[2].name,
      poNumber: 'PO-2026-0104',
      originalAmount: 30_000,
      adjustedAmount: 0,
      remainingAmount: 30_000,
      status: 'Open',
      paymentId: 'apay-03',
      narration: 'Unallocated portion from PAY-2026-00118 — carry as advance',
      createdBy: CREATED_BY,
    },
    {
      id: 'apadv-02',
      advanceNumber: 'ADV-2026-00008',
      advanceDate: dateOnly(-45),
      vendorId: vendors[0].id,
      vendorCode: vendors[0].code,
      vendorName: vendors[0].name,
      poNumber: 'PO-2026-0112',
      originalAmount: 150_000,
      adjustedAmount: 0,
      remainingAmount: 150_000,
      status: 'Open',
      paymentId: null,
      narration: 'Advance against MS angle order — PO-2026-0112',
      createdBy: CREATED_BY,
    },
  ]
}

export function seedPayableDebitNotes(): PayableDebitNote[] {
  const vendors = seedPayableVendors()
  return [
    {
      id: 'apdn-01',
      debitNoteNumber: 'DN-2026-00031',
      debitNoteDate: dateOnly(-10),
      vendorId: vendors[4].id,
      vendorName: vendors[4].name,
      referenceInvoiceId: 'apinv-09',
      referenceInvoiceNumber: 'NSF/INV/3340',
      reason: 'Quality Rejection',
      originalAmount: 28_500,
      appliedAmount: 0,
      remainingAmount: 28_500,
      gstAdjustment: 5_130,
      status: 'Pending Approval',
      sourceDocument: 'qc-rejection-NSF3340.pdf',
      relatedVoucherId: null,
    },
    {
      id: 'apdn-02',
      debitNoteNumber: 'DN-2026-00028',
      debitNoteDate: dateOnly(-35),
      vendorId: vendors[2].id,
      vendorName: vendors[2].name,
      referenceInvoiceId: 'apinv-16',
      referenceInvoiceNumber: 'SPC/INV/1172',
      reason: 'Quantity Shortage',
      originalAmount: 8_200,
      appliedAmount: 0,
      remainingAmount: 8_200,
      gstAdjustment: 1_476,
      status: 'Draft',
      sourceDocument: 'grn-shortage-report.pdf',
      relatedVoucherId: null,
    },
  ]
}

export function seedVendorDisputes(): VendorDispute[] {
  const vendors = seedPayableVendors()
  return [
    {
      id: 'apdisp-01',
      disputeNumber: 'VDP-2026-0001',
      vendorId: vendors[4].id,
      vendorName: vendors[4].name,
      invoiceId: 'apinv-09',
      invoiceNumber: 'NSF/INV/3340',
      disputeDate: dateOnly(-8),
      disputeType: 'Quality Issue',
      disputedAmount: 28_500,
      description: 'Welding porosity on 12 chassis brackets — QC rejected at incoming inspection.',
      owner: AP_OWNERS[0],
      responsibleDepartment: 'Quality',
      priority: 'High',
      targetResolutionDate: dateOnly(10),
      status: 'Under Review',
      resolution: null,
      debitNoteRequired: true,
      paymentHold: true,
      supportingDocuments: ['qc-report-NSF3340.pdf', 'rejection-photos.zip'],
      createdAt: dateTime(-8, 14, 0),
    },
    {
      id: 'apdisp-02',
      disputeNumber: 'VDP-2026-0002',
      vendorId: vendors[2].id,
      vendorName: vendors[2].name,
      invoiceId: 'apinv-16',
      invoiceNumber: 'SPC/INV/1172',
      disputeDate: dateOnly(-40),
      disputeType: 'Short Supply',
      disputedAmount: 8_200,
      description: 'GRN shows 4 drums received vs 5 invoiced on epoxy primer delivery.',
      owner: AP_OWNERS[1],
      responsibleDepartment: 'Stores',
      priority: 'Medium',
      targetResolutionDate: dateOnly(5),
      status: 'Awaiting Vendor',
      resolution: null,
      debitNoteRequired: true,
      paymentHold: false,
      supportingDocuments: ['grn-1172.pdf', 'vendor-email-thread.pdf'],
      createdAt: dateTime(-40, 10, 30),
    },
  ]
}

export function seedMsmeAgeingRows(): MsmeAgeingRow[] {
  const vendors = seedPayableVendors()
  const invoices = seedPayableInvoices()
  const msmeVendors = vendors.filter((v) => v.msmeCategory !== 'Not MSME')
  return msmeVendors.map((v) => {
    const invs = invoices.filter((i) => i.vendorId === v.id && i.outstandingBalance > 0)
    const bucketAmt = (b: PayableAgeingBucket) =>
      invs.filter((i) => i.ageingBucket === b).reduce((s, i) => s + i.outstandingBalance, 0)
    const total = invs.reduce((s, i) => s + i.outstandingBalance, 0)
    const maxOverdue = invs.reduce((m, i) => Math.max(m, i.overdueDays), 0)
    const complianceRisk =
      maxOverdue > 45 ? 'Critical' : maxOverdue > 30 ? 'High' : maxOverdue > 15 ? 'Medium' : 'Low'
    return {
      vendorId: v.id,
      vendorName: v.name,
      msmeCategory: v.msmeCategory,
      udyamNumber: v.msmeStatus === 'Registered' ? `UDYAM-MH-${v.code.replace('VND-', '')}` : null,
      notDue: bucketAmt('Not Due'),
      d1to30: bucketAmt('1–30 Days'),
      d31to60: bucketAmt('31–60 Days'),
      d61to90: bucketAmt('61–90 Days'),
      d91to180: bucketAmt('91–180 Days'),
      above180: bucketAmt('Above 180 Days'),
      totalOutstanding: total,
      msmePaymentDueDays: v.msmeCategory === 'Micro' ? 45 : 30,
      daysSinceDue: maxOverdue,
      complianceRisk,
    }
  })
}

export function seedPayablesSetup(): PayablesSetup {
  return {
    general: {
      defaultPaymentTerms: 30,
      autoMatchTolerancePercent: 1,
      autoMatchToleranceAmount: 500,
      requireThreeWayMatch: true,
      blockPaymentWithoutGrn: false,
      msmePriorityEnabled: true,
      msmePaymentDays: 45,
    },
    approval: {
      paymentProposalApprovalRequired: true,
      paymentApprovalRequired: true,
      paymentApprovalThreshold: 100_000,
      debitNoteApprovalRequired: true,
      bankVerificationRequired: true,
    },
    tds: {
      autoCalculateTds: true,
      defaultTdsSection: '194C',
      tdsThresholdAmount: 30_000,
      showTdsOnPaymentAdvice: true,
    },
    notifications: {
      notifyOnOverdue: true,
      notifyOnProposalPending: true,
      notifyOnBankChange: true,
      notifyOnMsmeDue: true,
    },
    lastUpdatedBy: APPROVED_BY,
    lastUpdatedAt: dateTime(-7, 16, 0),
  }
}

export const PAYABLES_REPORT_CATALOG: PayablesReportCatalogEntry[] = [
  { id: 'ap-rpt-outstanding', name: 'Vendor Outstanding', description: 'Open balances by vendor with credit utilization', category: 'Outstanding', permission: 'accounting.payables.view_vendor', formats: ['excel', 'csv', 'pdf'] },
  { id: 'ap-rpt-ageing', name: 'Vendor Ageing', description: 'Ageing analysis by due date / invoice date', category: 'Ageing', permission: 'accounting.payables.view_ageing', formats: ['excel', 'csv', 'pdf'] },
  { id: 'ap-rpt-msme', name: 'MSME Ageing', description: 'MSME vendor outstanding with compliance risk flags', category: 'Ageing', permission: 'accounting.payables.view_ageing', formats: ['excel', 'csv'] },
  { id: 'ap-rpt-payments', name: 'Payment Register', description: 'Vendor payments with TDS and allocation status', category: 'Payments', permission: 'accounting.payables.view', formats: ['excel', 'csv', 'pdf'] },
  { id: 'ap-rpt-tds', name: 'TDS Summary', description: 'TDS deducted on vendor payments by section', category: 'Compliance', permission: 'accounting.payables.view_tds', formats: ['excel', 'csv'] },
  { id: 'ap-rpt-match', name: 'Match Exceptions', description: 'Three-way match failures and pending verification', category: 'Matching', permission: 'accounting.payables.view_invoice', formats: ['excel', 'csv'] },
  { id: 'ap-rpt-proposals', name: 'Payment Proposals', description: 'Proposal status and approval trail', category: 'Payments', permission: 'accounting.payables.view_payment_planning', formats: ['excel', 'csv'] },
  { id: 'ap-rpt-disputes', name: 'Vendor Disputes', description: 'Open disputes with hold and debit note linkage', category: 'Disputes', permission: 'accounting.payables.view', formats: ['excel', 'csv', 'pdf'] },
]

export function seedPayablesAudit(): PayablesAuditEntry[] {
  return [
    { id: 'apaud-01', entityType: 'payment', entityId: 'apay-01', action: 'Posted', details: 'NEFT payment ₹2,05,000 posted against BST/INV/8842', performedBy: APPROVED_BY, performedAt: dateTime(-38, 14, 0), isDemo: true },
    { id: 'apaud-02', entityType: 'proposal', entityId: 'aprop-02', action: 'Submitted', details: 'Payment proposal PP-2026-00019 submitted for approval', performedBy: CREATED_BY, performedAt: dateTime(-1, 11, 0), isDemo: true },
    { id: 'apaud-03', entityType: 'hold', entityId: 'phold-01', action: 'Placed', details: 'Payment hold placed on Nashik Subcontract Fabricators — dispute', performedBy: AP_OWNERS[0], performedAt: dateTime(-8, 15, 0), isDemo: true },
    { id: 'apaud-04', entityType: 'bank', entityId: 'apvnd-04', action: 'Bank Changed', details: 'Western Logistics bank details changed — re-verification required', performedBy: 'System', performedAt: dateTime(-3, 16, 0), isDemo: true },
    { id: 'apaud-05', entityType: 'dispute', entityId: 'apdisp-01', action: 'Created', details: 'Quality dispute raised on NSF/INV/3340 — ₹28,500', performedBy: AP_OWNERS[0], performedAt: dateTime(-8, 14, 0), isDemo: true },
    { id: 'apaud-06', entityType: 'setup', entityId: 'payables-setup', action: 'Updated', details: 'MSME priority enabled; bank verification required', performedBy: APPROVED_BY, performedAt: dateTime(-7, 16, 0), isDemo: true },
  ]
}
