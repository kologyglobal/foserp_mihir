import { Badge } from '../ui/Badge'
import { StatusBadge } from '../ui/StatusBadge'
import {
  DMS_DOCUMENT_TYPE_LABELS,
  normalizeDocumentType,
  type DmsDocumentType,
  type DmsDocumentSource,
  type DmsWorkflowStatus,
} from '../../types/dms'

const TYPE_COLORS: Partial<Record<DmsDocumentType, 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'gray'>> = {
  engineering_drawing: 'purple',
  customer_approved_drawing: 'blue',
  customer_drawing: 'blue',
  bom_document: 'purple',
  routing_document: 'purple',
  qc_report: 'red',
  test_report: 'red',
  ncr_photo: 'red',
  dispatch_photo: 'gray',
  photo: 'gray',
  gate_pass: 'yellow',
  invoice_copy: 'green',
  vendor_certificate: 'yellow',
  vendor_drawing: 'yellow',
  certificate: 'green',
  test_certificate: 'green',
  warranty_document: 'blue',
  purchase_attachment: 'yellow',
  sales_attachment: 'blue',
}

export function DmsCategoryBadge({ category }: { category: DmsDocumentType }) {
  const norm = normalizeDocumentType(category)
  return <Badge color={TYPE_COLORS[norm] ?? 'gray'}>{DMS_DOCUMENT_TYPE_LABELS[category] ?? DMS_DOCUMENT_TYPE_LABELS[norm]}</Badge>
}

export function DmsWorkflowBadge({ status }: { status?: DmsWorkflowStatus }) {
  if (!status) return <StatusBadge status="pending" />
  return <StatusBadge status={status} />
}

const SOURCE_LABELS: Record<DmsDocumentSource, string> = {
  dms_registry: 'DMS',
  product_attachment: 'Product',
  inquiry_attachment: 'Inquiry',
  dispatch_photo: 'Dispatch',
  qc_parameter: 'QC',
  bom_revision: 'BOM',
}

export function DmsSourceBadge({ source }: { source: DmsDocumentSource }) {
  return <Badge color="gray">{SOURCE_LABELS[source]}</Badge>
}

export function DmsLatestBadge({ isLatest }: { isLatest?: boolean }) {
  if (isLatest === false) return <Badge color="gray">Superseded</Badge>
  return <Badge color="green">Latest</Badge>
}
