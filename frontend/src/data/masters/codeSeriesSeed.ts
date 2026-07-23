import type {
  CodeFormatSegment,
  CodeSeries,
  CodeSeriesEntityType,
  CodeSeriesModule,
} from '../../types/codeSeriesMaster'
import { defaultFormatSegments } from '../../utils/codeSeriesFormat'

const now = () => new Date().toISOString()

function series(
  seriesCode: string,
  seriesName: string,
  module: CodeSeriesModule,
  entityType: CodeSeriesEntityType,
  opts: {
    prefix: string
    runningNumberLength?: number
    startingNumber?: number
    currentNumber?: number
    financialYearRequired?: boolean
    monthRequired?: boolean
    branchRequired?: boolean
    formatSegments?: CodeFormatSegment[]
    description?: string
    resetFrequency?: CodeSeries['resetFrequency']
  },
): CodeSeries {
  const financialYearRequired = opts.financialYearRequired ?? false
  const monthRequired = opts.monthRequired ?? false
  const branchRequired = opts.branchRequired ?? false
  const formatSegments =
    opts.formatSegments ??
    defaultFormatSegments({ financialYearRequired, monthRequired, branchRequired })

  const startingNumber = opts.startingNumber ?? 1
  const currentNumber = opts.currentNumber ?? startingNumber - 1

  return {
    id: `cs-${seriesCode.toLowerCase()}`,
    seriesCode,
    seriesName,
    module,
    entityType,
    description: opts.description ?? `${seriesName} numbering series`,
    isActive: true,
    prefix: opts.prefix,
    separator: '-',
    financialYearRequired,
    yearFormat: 'YYYY',
    monthRequired,
    branchRequired,
    departmentRequired: false,
    locationRequired: false,
    runningNumberLength: opts.runningNumberLength ?? 4,
    startingNumber,
    currentNumber,
    incrementBy: 1,
    suffix: '',
    formatSegments,
    resetFrequency: opts.resetFrequency ?? 'never',
    allowManualNumber: false,
    allowOverride: false,
    allowGap: false,
    allowDuplicate: false,
    lockAfterPosting: true,
    createdBy: 'system',
    createdAt: now(),
    modifiedBy: 'system',
    updatedAt: now(),
    lastUsedNumber: currentNumber >= startingNumber ? currentNumber : undefined,
    lastUsedDate: currentNumber >= startingNumber ? now().slice(0, 10) : undefined,
  }
}

export const seedCodeSeries: CodeSeries[] = [
  series('LEAD', 'CRM Lead', 'crm', 'lead', { prefix: 'LEAD', currentNumber: 12 }),
  series('OPP', 'Opportunity', 'crm', 'opportunity', { prefix: 'OPP', financialYearRequired: true, currentNumber: 8 }),
  series('QT', 'Quotation', 'crm', 'quotation', { prefix: 'QT', financialYearRequired: true, currentNumber: 15 }),
  series('SO', 'Sales Order', 'sales', 'sales_order', { prefix: 'SO', financialYearRequired: true, currentNumber: 6 }),
  series('CUST', 'Customer', 'masters', 'customer', { prefix: 'CUST', currentNumber: 24 }),
  series('COMP', 'Company', 'masters', 'company', { prefix: 'COMP', currentNumber: 12 }),
  series('CONT', 'Contact', 'masters', 'contact', { prefix: 'CONT', currentNumber: 6 }),
  series('VEND', 'Vendor', 'masters', 'vendor', { prefix: 'VEND', currentNumber: 18 }),
  series('ITEM', 'Item', 'masters', 'item', { prefix: 'ITEM', currentNumber: 120 }),
  series('ICAT', 'Item Category', 'masters', 'item_category', { prefix: 'ICAT', runningNumberLength: 3, currentNumber: 5 }),
  series('PR', 'Purchase Requisition', 'purchase', 'purchase_requisition', { prefix: 'PR', financialYearRequired: true, currentNumber: 9 }),
  series('RFQ', 'RFQ', 'purchase', 'rfq', { prefix: 'RFQ', financialYearRequired: true, currentNumber: 5 }),
  series('PO', 'Purchase Order', 'purchase', 'purchase_order', { prefix: 'PO', financialYearRequired: true, runningNumberLength: 5, currentNumber: 11 }),
  series('GRN', 'GRN', 'purchase', 'grn', { prefix: 'GRN', financialYearRequired: true, currentNumber: 7 }),
  series('PROD', 'Production Order', 'production', 'production_order', { prefix: 'PROD', financialYearRequired: true, currentNumber: 4 }),
  // Anchor SO-0001 MRP creates WO-0001…WO-0005 (Tank SA first). Keep counter at 0 for that contract.
  series('WO', 'Work Order', 'production', 'work_order', { prefix: 'WO', currentNumber: 0 }),
  series('QC', 'QC Inspection', 'quality', 'qc_inspection', { prefix: 'QC', financialYearRequired: true, runningNumberLength: 5, currentNumber: 3 }),
  series('INV', 'Invoice', 'finance', 'invoice', { prefix: 'INV', financialYearRequired: true, currentNumber: 2 }),
  series('BOM', 'BOM', 'engineering', 'bom', { prefix: 'BOM', currentNumber: 6 }),
  series('ROUTE', 'Routing', 'engineering', 'routing', { prefix: 'RTG', currentNumber: 4 }),
  series('WH', 'Warehouse', 'masters', 'warehouse', { prefix: 'WH', currentNumber: 5 }),
  series('UOM', 'Unit of Measure', 'masters', 'uom', { prefix: 'UOM', runningNumberLength: 3, currentNumber: 8 }),
  series('HSN', 'HSN', 'masters', 'hsn', { prefix: 'HSN', runningNumberLength: 3, currentNumber: 10 }),
  series('GST', 'GST Group', 'masters', 'gst_group', { prefix: 'GSTG', runningNumberLength: 3, currentNumber: 4 }),
  series('GSTR', 'GST Rate', 'masters', 'gst_rate', { prefix: 'GSTR', runningNumberLength: 4, currentNumber: 2 }),
  series('WC', 'Work Center', 'masters', 'work_center', { prefix: 'WC', runningNumberLength: 3, currentNumber: 4 }),
  series('DEPT', 'Department', 'masters', 'department', { prefix: 'DEPT', runningNumberLength: 3, currentNumber: 3 }),
  series('TERR', 'Territory', 'masters', 'territory', { prefix: 'TERR', runningNumberLength: 3, currentNumber: 4 }),
  series('IND', 'Industry', 'masters', 'industry', { prefix: 'IND', runningNumberLength: 3, currentNumber: 5 }),
  series('PTERM', 'Payment Terms', 'masters', 'payment_terms', { prefix: 'PTERM', runningNumberLength: 3, currentNumber: 3 }),
  series('PLIST', 'Price List', 'masters', 'price_list', { prefix: 'PLIST', runningNumberLength: 3, currentNumber: 2 }),
  series('APWF', 'Approval Workflow', 'masters', 'approval_workflow', { prefix: 'APWF', runningNumberLength: 3, currentNumber: 2 }),
  series('ROLE', 'Role', 'masters', 'role', { prefix: 'ROLE', runningNumberLength: 3, currentNumber: 8 }),
  series('PERM', 'Permission', 'masters', 'permission', { prefix: 'PERM', runningNumberLength: 4, currentNumber: 10 }),
  series('QTG', 'Quality Test Group', 'masters', 'quality_test_group', { prefix: 'QTG', runningNumberLength: 3, currentNumber: 5 }),
  series('EMP', 'Employee', 'masters', 'employee', { prefix: 'EMP', runningNumberLength: 4, currentNumber: 6 }),
  series('LSRC', 'Lead Source', 'crm', 'lead_source', { prefix: 'LSRC', runningNumberLength: 3, currentNumber: 4 }),
  series('LSTG', 'Lead Stage', 'crm', 'lead_stage', { prefix: 'LSTG', runningNumberLength: 3, currentNumber: 6 }),
  series('LPRI', 'Lead Priority', 'crm', 'lead_priority', { prefix: 'LPRI', runningNumberLength: 3, currentNumber: 3 }),
  series('LRSN', 'Lead Reason', 'crm', 'lead_reason', { prefix: 'LRSN', runningNumberLength: 3, currentNumber: 4 }),
  series('OSTG', 'Opportunity Stage', 'crm', 'opportunity_stage', { prefix: 'OSTG', runningNumberLength: 3, currentNumber: 6 }),
  series('OPRI', 'Opportunity Priority', 'crm', 'opportunity_priority', { prefix: 'OPRI', runningNumberLength: 3, currentNumber: 3 }),
  series('ACTT', 'Activity Type', 'crm', 'activity_type', { prefix: 'ACTT', runningNumberLength: 3, currentNumber: 5 }),
  series('LOST', 'Lost Reason', 'crm', 'lost_reason', { prefix: 'LOST', runningNumberLength: 3, currentNumber: 3 }),
  series('CTRM', 'Commercial Term', 'crm', 'commercial_term', { prefix: 'CTRM', runningNumberLength: 3, currentNumber: 3 }),
  series('DTRM', 'Delivery Term', 'crm', 'delivery_term', { prefix: 'DTRM', runningNumberLength: 3, currentNumber: 3 }),
  series('WTRM', 'Warranty Term', 'crm', 'warranty_term', { prefix: 'WTRM', runningNumberLength: 3, currentNumber: 2 }),
  series('APRL', 'Approval Rule', 'crm', 'approval_rule', { prefix: 'APRL', runningNumberLength: 3, currentNumber: 2 }),
  series('DTYP', 'Document Type', 'crm', 'document_type', { prefix: 'DTYP', runningNumberLength: 3, currentNumber: 4 }),
  series('PINT', 'Product Interest', 'crm', 'product_interest', { prefix: 'PINT', runningNumberLength: 3, currentNumber: 3 }),
  series('INQ', 'Inquiry', 'crm', 'inquiry', { prefix: 'INQ', currentNumber: 3 }),
  series('PI', 'Proforma Invoice', 'sales', 'proforma_invoice', { prefix: 'PI', currentNumber: 2 }),
  series('VQ', 'Vendor Quotation', 'purchase', 'vendor_quotation', { prefix: 'VQ', currentNumber: 2 }),
  series('PRET', 'Purchase Return', 'purchase', 'purchase_return', { prefix: 'PRET', currentNumber: 1 }),
  series('DC', 'Dispatch', 'logistics', 'dispatch', { prefix: 'DC', currentNumber: 5 }),
  series('GP', 'Gate Pass', 'logistics', 'gate_pass', { prefix: 'GP', runningNumberLength: 5, currentNumber: 2 }),
  series('ECR', 'ECR', 'engineering', 'ecr', { prefix: 'ECR', currentNumber: 2 }),
  series('ECO', 'ECO', 'engineering', 'eco', { prefix: 'ECO', currentNumber: 2 }),
  series('NCR', 'NCR', 'quality', 'ncr', { prefix: 'NCR', financialYearRequired: true, currentNumber: 2 }),
  series('RWK', 'Rework', 'quality', 'rework', { prefix: 'RWK', currentNumber: 1 }),
  series('DOC', 'Document', 'administration', 'document', { prefix: 'DOC', currentNumber: 10 }),
  series('BC', 'Barcode', 'administration', 'barcode', { prefix: 'BC', currentNumber: 20 }),
  series('QR', 'QR Code', 'administration', 'qr', { prefix: 'QR', currentNumber: 15 }),
  series('MRP', 'MRP Run', 'production', 'mrp_run', { prefix: 'MRP', currentNumber: 3 }),
  series('JC', 'Job Card', 'production', 'job_card', { prefix: 'JC', currentNumber: 8 }),
]
