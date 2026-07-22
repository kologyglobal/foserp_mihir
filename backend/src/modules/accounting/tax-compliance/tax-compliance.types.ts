/** Read-only GST register row (outward or inward). Amounts are decimal strings. */
export type GstSupplyExtractRow = {
  id: string
  documentNumber: string
  documentDate: string
  invoiceDate: string
  postingDate: string | null
  partyName: string
  partyGstin: string | null
  placeOfSupply: string | null
  stateCode: string | null
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalAmount: string
  supplyType: string | null
  taxTreatment: string | null
  currencyCode: string
  reverseCharge: boolean
}

export type GstExtractSummary = {
  documentCount: number
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalAmount: string
}

export type GstExtractListResult = {
  fromDate: string
  toDate: string
  legalEntityId: string
  items: GstSupplyExtractRow[]
  summary: GstExtractSummary
  page: number
  pageSize: number
  total: number
}

export type GstComplianceSummaryResult = {
  fromDate: string
  toDate: string
  legalEntityId: string
  outward: GstExtractSummary
  inward: GstExtractSummary
}
