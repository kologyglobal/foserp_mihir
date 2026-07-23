/**
 * GST & TDS Compliance — frontend types (demo / UI only).
 * Not a statutory calculation engine. Rates/thresholds/sections come from setup config seed.
 */

export type TaxCompliancePeriod = {
  periodKey: string
  label: string
  fyLabel: string
  month: number
  year: number
}

export type GstinProfile = {
  id: string
  gstin: string
  legalName: string
  tradeName: string
  stateCode: string
  stateName: string
  isDefault: boolean
}

export type ComplianceStatus =
  | 'Open'
  | 'In Progress'
  | 'Ready for Review'
  | 'Marked Filed Externally'
  | 'Exception'
  | 'Overdue'

export type MatchConfidence = 'High' | 'Medium' | 'Low' | 'Manual'

export type ItcMatchStatus =
  | 'Matched'
  | 'Partial Match'
  | 'Mismatch'
  | 'Books Only'
  | '2B Only'
  | 'Pending Review'
  | 'Accepted'
  | 'Rejected'
  | 'Deferred'

export type GstSupplyRow = {
  id: string
  docType: string
  docNo: string
  docDate: string
  partyName: string
  partyGstin: string
  placeOfSupply: string
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
  invoiceTotal: number
  hsnSac: string
  supplyType: 'B2B' | 'B2C' | 'Export' | 'SEZ' | 'Deemed Export' | 'Nil Rated' | 'Exempt'
  reverseCharge: boolean
  sourceDocPath?: string
  status: ComplianceStatus
  notes?: string
}

export type Gstr2bLine = {
  id: string
  supplierGstin: string
  supplierName: string
  invoiceNo: string
  invoiceDate: string
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  itcAvailability: 'Y' | 'N' | 'P'
  returnPeriod: string
}

export type ItcReconRow = {
  id: string
  books?: GstSupplyRow
  gstr2b?: Gstr2bLine
  matchStatus: ItcMatchStatus
  confidence: MatchConfidence
  varianceTaxable: number
  varianceTax: number
  overrideReason?: string
  reviewerNote?: string
}

export type GstReturnPrep = {
  id: string
  returnType: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B'
  periodKey: string
  status: ComplianceStatus
  outwardTaxable: number
  taxLiability: number
  itcAvailable: number
  netPayable: number
  markedFiledAt?: string
  markedFiledBy?: string
  acknowledgmentRef?: string
  filedOnPortalDate?: string
  remarks?: string
}

export type EInvoiceRow = {
  id: string
  invoiceNo: string
  invoiceDate: string
  customerName: string
  customerGstin: string
  taxableValue: number
  taxAmount: number
  irnStatus:
    | 'Pending'
    | 'Ready'
    | 'Generated'
    | 'IRN Captured Externally'
    | 'Cancelled'
    | 'Cancelled Externally'
    | 'Exception'
  irn?: string
  ackNo?: string
  ackDate?: string
  sourceDocPath?: string
  salesInvoiceId?: string
  providerMode?: string
}

export type EWayBillRow = {
  id: string
  docNo: string
  docDate: string
  partyName: string
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNo?: string
  ewbStatus:
    | 'Required'
    | 'Not Required'
    | 'Generated'
    | 'Generated Externally'
    | 'Cancelled'
    | 'Expired'
    | 'Exception'
  ewbNo?: string
  validUpto?: string
  sourceDocPath?: string
  sourceType?: 'SALES_INVOICE' | 'DELIVERY_CHALLAN'
  salesInvoiceId?: string
  deliveryChallanId?: string
  providerMode?: string
}

export type GstExceptionRow = {
  id: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  category: string
  description: string
  entityRef: string
  periodKey: string
  status: 'Open' | 'In Review' | 'Resolved' | 'Ignored'
  owner: string
}

export type ComplianceNotice = {
  id: string
  noticeType: string
  refNo: string
  issuedOn: string
  dueDate: string
  authority: 'GST' | 'Income Tax' | 'Other'
  summary: string
  status: 'Open' | 'Responded' | 'Closed' | 'Escalated'
  relatedPeriod?: string
}

export type TdsTransaction = {
  id: string
  txnDate: string
  vendorName: string
  vendorPan: string
  sectionCode: string
  sectionLabel: string
  natureOfPayment: string
  taxableAmount: number
  thresholdApplicable: boolean
  ratePercent: number
  tdsAmount: number
  status: 'Pending Deduction' | 'Deducted' | 'Deposited' | 'Exception' | 'Lower Rate'
  challanId?: string
  sourceDocPath?: string
  overrideReason?: string
}

export type TdsChallan = {
  id: string
  challanNo: string
  bsrCode: string
  paidOn: string
  amount: number
  sectionCode: string
  quarter: string
  status: 'Draft' | 'Paid Externally' | 'Linked' | 'Unused'
  cin?: string
  linkedTxnCount: number
}

export type TdsReturn = {
  id: string
  formType: '24Q' | '26Q' | '27Q' | '27EQ'
  quarter: string
  fyLabel: string
  status: ComplianceStatus
  deducteeCount: number
  totalTds: number
  markedFiledAt?: string
  acknowledgmentNo?: string
}

export type TdsCertificate = {
  id: string
  formType: 'Form 16' | 'Form 16A'
  deducteeName: string
  deducteePan: string
  quarter: string
  tdsAmount: number
  status: 'Draft Preview' | 'Ready' | 'Issued Externally' | 'Cancelled'
  certificateNo?: string
}

export type TcsRow = {
  id: string
  txnDate: string
  partyName: string
  partyPan: string
  sectionCode: string
  collectibleAmount: number
  ratePercent: number
  tcsAmount: number
  status: 'Pending' | 'Collected' | 'Deposited' | 'Exception'
}

export type ComplianceCalendarItem = {
  id: string
  title: string
  dueDate: string
  category: 'GST' | 'TDS' | 'TCS' | 'Other'
  status: 'Upcoming' | 'Due Soon' | 'Overdue' | 'Completed Externally'
  periodKey?: string
  href?: string
}

export type TaxReportCard = {
  id: string
  title: string
  description: string
  category: 'GST' | 'TDS' | 'TCS' | 'Combined'
  href: string
}

export type EffectiveDatedRule = {
  id: string
  ruleType: string
  code: string
  label: string
  ratePercent?: number
  thresholdAmount?: number
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
  notes?: string
}

export type TaxComplianceSetup = {
  companyTan: string
  defaultGstinId: string
  gstins: GstinProfile[]
  filingFrequency: 'Monthly' | 'Quarterly'
  eInvoiceApplicableFrom?: string
  eWayBillThresholdPreview: number
  tdsSections: EffectiveDatedRule[]
  tcsSections: EffectiveDatedRule[]
  gstRateSlabs: EffectiveDatedRule[]
  autoMatchHighOnly: boolean
  previewDisclaimer: string
}

export type TaxComplianceDashboard = {
  period: TaxCompliancePeriod
  gstin: GstinProfile
  kpis: {
    outwardTaxable: number
    inwardTaxable: number
    itcAvailable: number
    itcMatched: number
    itcPending: number
    gstPayablePreview: number
    tdsDeducted: number
    tdsPendingDeposit: number
    openExceptions: number
    openNotices: number
    overdueFilings: number
  }
  filingWatch: { label: string; dueDate: string; status: ComplianceStatus; href: string }[]
  exceptionHighlights: GstExceptionRow[]
  recentActivity: { id: string; when: string; text: string }[]
}

export type GstDashboardData = {
  period: TaxCompliancePeriod
  gstin: GstinProfile
  kpis: {
    outwardSupplies: number
    inwardSupplies: number
    outputTax: number
    itcEligible: number
    rcmLiability: number
    netLiabilityPreview: number
    eInvoicePending: number
    eWayPending: number
    exceptions: number
  }
  suppliesMix: { name: string; value: number }[]
  returnStatus: GstReturnPrep[]
}

export type PeriodFilterState = {
  periodKey: string
  gstinId: string
}
