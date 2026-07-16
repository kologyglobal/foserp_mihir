/** ERP module owning a code series */
export type CodeSeriesModule =
  | 'crm'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'production'
  | 'quality'
  | 'finance'
  | 'engineering'
  | 'logistics'
  | 'masters'
  | 'administration'

export const CODE_SERIES_MODULE_LABELS: Record<CodeSeriesModule, string> = {
  crm: 'CRM',
  sales: 'Sales',
  purchase: 'Purchase',
  inventory: 'Inventory',
  production: 'Production',
  quality: 'Quality',
  finance: 'Finance',
  engineering: 'Engineering',
  logistics: 'Logistics',
  masters: 'Master Data',
  administration: 'Administration',
}

/** Entity / document type — one active series per type */
export type CodeSeriesEntityType =
  | 'lead'
  | 'inquiry'
  | 'opportunity'
  | 'quotation'
  | 'sales_order'
  | 'company'
  | 'customer'
  | 'contact'
  | 'vendor'
  | 'item'
  | 'item_category'
  | 'purchase_requisition'
  | 'rfq'
  | 'vendor_quotation'
  | 'purchase_order'
  | 'grn'
  | 'purchase_return'
  | 'stock_transfer'
  | 'stock_count'
  | 'adjustment'
  | 'lot'
  | 'batch'
  | 'serial'
  | 'production_order'
  | 'work_order'
  | 'job_card'
  | 'material_issue'
  | 'fg_receipt'
  | 'qc_inspection'
  | 'ncr'
  | 'capa'
  | 'rework'
  | 'invoice'
  | 'proforma_invoice'
  | 'payment_receipt'
  | 'debit_note'
  | 'credit_note'
  | 'journal_voucher'
  | 'bom'
  | 'routing'
  | 'drawing_revision'
  | 'ecn'
  | 'ecr'
  | 'eco'
  | 'dispatch'
  | 'gate_pass'
  | 'warehouse'
  | 'uom'
  | 'hsn'
  | 'gst_group'
  | 'gst_rate'
  | 'work_center'
  | 'territory'
  | 'industry'
  | 'payment_terms'
  | 'price_list'
  | 'approval_workflow'
  | 'role'
  | 'permission'
  | 'quality_test_group'
  | 'lead_source'
  | 'lead_stage'
  | 'lead_priority'
  | 'lead_reason'
  | 'opportunity_stage'
  | 'opportunity_priority'
  | 'activity_type'
  | 'lost_reason'
  | 'commercial_term'
  | 'delivery_term'
  | 'warranty_term'
  | 'approval_rule'
  | 'document_type'
  | 'product_interest'
  | 'employee'
  | 'department'
  | 'cost_center'
  | 'document'
  | 'barcode'
  | 'qr'
  | 'mrp_run'

export const CODE_SERIES_ENTITY_LABELS: Record<CodeSeriesEntityType, string> = {
  lead: 'Lead No',
  inquiry: 'Inquiry No',
  opportunity: 'Opportunity No',
  quotation: 'Quotation No',
  sales_order: 'Sales Order No',
  company: 'Company Code',
  customer: 'Customer Code',
  contact: 'Contact Code',
  vendor: 'Vendor Code',
  item: 'Item Code',
  item_category: 'Item Category Code',
  purchase_requisition: 'Purchase Requisition No',
  rfq: 'RFQ No',
  vendor_quotation: 'Vendor Quotation No',
  purchase_order: 'Purchase Order No',
  grn: 'GRN No',
  purchase_return: 'Purchase Return No',
  stock_transfer: 'Stock Transfer No',
  stock_count: 'Stock Count No',
  adjustment: 'Adjustment No',
  lot: 'Lot No',
  batch: 'Batch No',
  serial: 'Serial No',
  production_order: 'Production Order No',
  work_order: 'Work Order No',
  job_card: 'Job Card No',
  material_issue: 'Material Issue No',
  fg_receipt: 'Finished Goods Receipt No',
  qc_inspection: 'QC Inspection No',
  ncr: 'NCR No',
  capa: 'CAPA No',
  rework: 'Rework No',
  invoice: 'Invoice No',
  proforma_invoice: 'Proforma Invoice No',
  payment_receipt: 'Payment Receipt No',
  debit_note: 'Debit Note No',
  credit_note: 'Credit Note No',
  journal_voucher: 'Journal Voucher No',
  bom: 'BOM No',
  routing: 'Routing No',
  drawing_revision: 'Drawing Revision No',
  ecn: 'ECN No',
  ecr: 'ECR No',
  eco: 'ECO No',
  dispatch: 'Dispatch No',
  gate_pass: 'Gate Pass No',
  warehouse: 'Warehouse Code',
  uom: 'UOM Code',
  hsn: 'HSN Code',
  gst_group: 'GST Group Code',
  gst_rate: 'GST Rate Code',
  work_center: 'Work Center Code',
  territory: 'Territory Code',
  industry: 'Industry Code',
  payment_terms: 'Payment Terms Code',
  price_list: 'Price List Code',
  approval_workflow: 'Approval Workflow Code',
  role: 'Role Code',
  permission: 'Permission Code',
  quality_test_group: 'Quality Test Group Code',
  lead_source: 'Lead Source Code',
  lead_stage: 'Lead Stage Code',
  lead_priority: 'Lead Priority Code',
  lead_reason: 'Lead Reason Code',
  opportunity_stage: 'Opportunity Stage Code',
  opportunity_priority: 'Opportunity Priority Code',
  activity_type: 'Activity Type Code',
  lost_reason: 'Lost Reason Code',
  commercial_term: 'Commercial Term Code',
  delivery_term: 'Delivery Term Code',
  warranty_term: 'Warranty Term Code',
  approval_rule: 'Approval Rule Code',
  document_type: 'Document Type Code',
  product_interest: 'Product Interest Code',
  employee: 'Employee Code',
  department: 'Department Code',
  cost_center: 'Cost Center Code',
  document: 'Document No',
  barcode: 'Barcode ID',
  qr: 'QR ID',
  mrp_run: 'MRP Run No',
}

export type CodeFormatSegment =
  | 'prefix'
  | 'separator'
  | 'financial_year'
  | 'month'
  | 'branch'
  | 'department'
  | 'location'
  | 'running_number'
  | 'suffix'

export const CODE_FORMAT_SEGMENT_LABELS: Record<CodeFormatSegment, string> = {
  prefix: 'Prefix',
  separator: 'Separator',
  financial_year: 'Financial Year',
  month: 'Month',
  branch: 'Branch Code',
  department: 'Department Code',
  location: 'Location Code',
  running_number: 'Running Number',
  suffix: 'Suffix',
}

export type CodeSeriesResetFrequency = 'never' | 'daily' | 'monthly' | 'financial_year' | 'calendar_year'

export const RESET_FREQUENCY_LABELS: Record<CodeSeriesResetFrequency, string> = {
  never: 'Never',
  daily: 'Daily',
  monthly: 'Monthly',
  financial_year: 'Financial Year',
  calendar_year: 'Calendar Year',
}

export type CodeSeriesYearFormat = 'YYYY' | 'YY'

export type CodeReservationStatus = 'reserved' | 'confirmed' | 'released'

export interface CodeSeries {
  id: string
  seriesCode: string
  seriesName: string
  module: CodeSeriesModule
  entityType: CodeSeriesEntityType
  description: string
  isActive: boolean

  prefix: string
  separator: string
  financialYearRequired: boolean
  yearFormat: CodeSeriesYearFormat
  monthRequired: boolean
  branchRequired: boolean
  departmentRequired: boolean
  locationRequired: boolean
  runningNumberLength: number
  startingNumber: number
  currentNumber: number
  incrementBy: number
  suffix: string
  formatSegments: CodeFormatSegment[]

  resetFrequency: CodeSeriesResetFrequency
  lastResetDate?: string
  nextResetDate?: string

  allowManualNumber: boolean
  allowOverride: boolean
  allowGap: boolean
  allowDuplicate: boolean
  lockAfterPosting: boolean

  createdBy: string
  createdAt: string
  modifiedBy: string
  updatedAt: string
  lastUsedNumber?: number
  lastUsedDate?: string
}

export interface CodeReservation {
  id: string
  seriesId: string
  entityType: CodeSeriesEntityType
  code: string
  runningNumber: number
  status: CodeReservationStatus
  reservedAt: string
  confirmedAt?: string
  releasedAt?: string
  posted?: boolean
  contextKey?: string
}

export interface CodeSeriesAuditEntry {
  id: string
  seriesId: string
  action: 'created' | 'updated' | 'reset' | 'deactivated' | 'activated' | 'reserved' | 'confirmed' | 'released' | 'manual_override'
  at: string
  by: string
  detail?: string
  reason?: string
}

export interface CodeSeriesContext {
  branchCode?: string
  departmentCode?: string
  locationCode?: string
  financialYear?: string
  month?: string
  existingNumbers?: string[]
  userId?: string
  posted?: boolean
}

export type CodeSeriesPermission =
  | 'codeSeries.view'
  | 'codeSeries.create'
  | 'codeSeries.edit'
  | 'codeSeries.delete'
  | 'codeSeries.reset'
  | 'codeSeries.override'
  | 'codeSeries.manualNumber'
  | 'codeSeries.deactivate'
