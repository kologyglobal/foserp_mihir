/** Document Management — registry, versioning, entity links */

export type DmsDocumentType =
  | 'engineering_drawing'
  | 'customer_approved_drawing'
  | 'bom_document'
  | 'routing_document'
  | 'qc_report'
  | 'ncr_photo'
  | 'dispatch_photo'
  | 'gate_pass'
  | 'invoice_copy'
  | 'vendor_certificate'
  | 'test_certificate'
  | 'warranty_document'
  | 'purchase_attachment'
  | 'sales_attachment'
  // Legacy category aliases (persisted data)
  | 'customer_drawing'
  | 'vendor_drawing'
  | 'certificate'
  | 'test_report'
  | 'photo'

/** @deprecated Use DmsDocumentType — kept as alias for existing imports */
export type DmsDocumentCategory = DmsDocumentType

export type DmsWorkflowStatus =
  | 'draft'
  | 'uploaded'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'obsolete'
  // Legacy version-row status
  | 'active'
  | 'superseded'
  | 'archived'

export type DmsEntityType =
  | 'product'
  | 'bom'
  | 'routing'
  | 'eco'
  | 'work_order'
  | 'job_work'
  | 'qc_inspection'
  | 'ncr'
  | 'dispatch'
  | 'invoice'
  | 'customer'
  | 'vendor'
  | 'item'

export type DmsDocumentSource =
  | 'dms_registry'
  | 'product_attachment'
  | 'inquiry_attachment'
  | 'dispatch_photo'
  | 'qc_parameter'
  | 'bom_revision'

export const DMS_DOCUMENT_TYPE_LABELS: Record<DmsDocumentType, string> = {
  engineering_drawing: 'Engineering Drawing',
  customer_approved_drawing: 'Customer Approved Drawing',
  bom_document: 'BOM Document',
  routing_document: 'Routing Document',
  qc_report: 'QC Report',
  ncr_photo: 'NCR Photo',
  dispatch_photo: 'Dispatch Photo',
  gate_pass: 'Gate Pass',
  invoice_copy: 'Invoice Copy',
  vendor_certificate: 'Vendor Certificate',
  test_certificate: 'Test Certificate',
  warranty_document: 'Warranty Document',
  purchase_attachment: 'Purchase Attachment',
  sales_attachment: 'Sales Attachment',
  customer_drawing: 'Customer Approved Drawing',
  vendor_drawing: 'Vendor Certificate',
  certificate: 'Vendor Certificate',
  test_report: 'QC Report',
  photo: 'Dispatch Photo',
}

/** @deprecated */
export const DMS_CATEGORY_LABELS = DMS_DOCUMENT_TYPE_LABELS

export const DMS_WORKFLOW_STATUS_LABELS: Record<DmsWorkflowStatus, string> = {
  draft: 'Draft',
  uploaded: 'Uploaded',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  obsolete: 'Obsolete',
  active: 'Uploaded',
  superseded: 'Superseded',
  archived: 'Obsolete',
}

export const DMS_ENTITY_LABELS: Record<DmsEntityType, string> = {
  product: 'Product',
  bom: 'BOM',
  routing: 'Routing',
  eco: 'ECO',
  work_order: 'Work Order',
  job_work: 'Job Work',
  qc_inspection: 'QC Inspection',
  ncr: 'NCR',
  dispatch: 'Dispatch',
  invoice: 'Invoice',
  customer: 'Customer',
  vendor: 'Vendor',
  item: 'Item',
}

export interface DmsEntityLink {
  entityType: DmsEntityType
  entityId: string
  entityLabel?: string
  linkedAt: string
  linkedByName?: string
}

export interface DmsEngineeringMeta {
  drawingNo?: string
  drawingRevision?: string
  productId?: string | null
  bomId?: string | null
  ecoId?: string | null
  customerApproved?: boolean
  effectiveDate?: string | null
  locked?: boolean
}

export interface DmsTimelineEvent {
  id: string
  kind: 'upload' | 'approve' | 'reject' | 'supersede' | 'obsolete' | 'review'
  label: string
  at: string
  byName?: string
  details?: string
}

/** Persisted document in the central DMS registry */
export interface DmsRegistryDocument {
  id: string
  documentNo: string
  title: string
  fileName: string
  category: DmsDocumentType
  mimeType?: string
  storageRef?: string
  revision?: string
  version?: number
  isLatest?: boolean
  status?: DmsWorkflowStatus
  workflowStatus?: DmsWorkflowStatus
  supersededById?: string | null
  vendorId?: string
  vendorName?: string
  notes?: string
  remarks?: string
  uploadedAt: string
  uploadedByName: string
  approvedBy?: string | null
  approvedAt?: string | null
  engineeringMeta?: DmsEngineeringMeta
  entityLinks: DmsEntityLink[]
}

/** Unified view row — registry + federated sources */
export interface DmsLinkedDocument {
  id: string
  registryId?: string
  documentNo?: string
  title: string
  fileName: string
  category: DmsDocumentType
  entityType: DmsEntityType
  entityId: string
  entityLabel?: string
  source: DmsDocumentSource
  revision?: string
  version?: number
  isLatest?: boolean
  workflowStatus?: DmsWorkflowStatus
  uploadedAt: string
  uploadedByName?: string
  approvedBy?: string | null
  approvedAt?: string | null
  mimeType?: string
  storageRef?: string
  notes?: string
}

export interface DmsSearchFilters {
  query?: string
  category?: DmsDocumentType | 'all'
  entityType?: DmsEntityType | 'all'
  entityId?: string
  workflowStatus?: DmsWorkflowStatus | 'all'
  uploadedBy?: string
  dateFrom?: string
  dateTo?: string
  revision?: string
}

export function normalizeDocumentType(type: DmsDocumentType): DmsDocumentType {
  switch (type) {
    case 'customer_drawing':
      return 'customer_approved_drawing'
    case 'vendor_drawing':
    case 'certificate':
      return 'vendor_certificate'
    case 'test_report':
      return 'qc_report'
    case 'photo':
      return 'dispatch_photo'
    default:
      return type
  }
}

export function normalizeWorkflowStatus(doc: Pick<DmsRegistryDocument, 'workflowStatus' | 'status'>): DmsWorkflowStatus {
  return doc.workflowStatus ?? doc.status ?? 'uploaded'
}

export function isDocumentUsable(status: DmsWorkflowStatus | undefined): boolean {
  const s = status ?? 'uploaded'
  return s !== 'obsolete' && s !== 'rejected' && s !== 'superseded' && s !== 'archived'
}
