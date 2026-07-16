import type { ProductAttachmentCategory } from '../types/productMaster'
import type {
  DmsDocumentCategory,
  DmsEntityType,
  DmsLinkedDocument,
  DmsRegistryDocument,
  DmsSearchFilters,
} from '../types/dms'
import { useDmsStore } from '../store/dmsStore'
import { useMasterStore } from '../store/masterStore'
import { useSalesStore } from '../store/salesStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useQualityStore } from '../store/qualityStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useBomStore } from '../store/bomStore'

function productCategoryToDms(cat: ProductAttachmentCategory): DmsDocumentCategory {
  switch (cat) {
    case 'customer_approved_drawing':
      return 'customer_drawing'
    case 'drawing':
    case 'technical_spec':
      return 'engineering_drawing'
    case 'certificate':
      return 'certificate'
    default:
      return 'engineering_drawing'
  }
}

function registryToLinked(doc: DmsRegistryDocument, link: DmsRegistryDocument['entityLinks'][0]): DmsLinkedDocument {
  return {
    id: `${doc.id}::${link.entityType}::${link.entityId}`,
    registryId: doc.id,
    documentNo: doc.documentNo,
    title: doc.title,
    fileName: doc.fileName,
    category: doc.category,
    entityType: link.entityType,
    entityId: link.entityId,
    entityLabel: link.entityLabel,
    source: 'dms_registry',
    revision: doc.revision,
    version: doc.version,
    isLatest: doc.isLatest,
    workflowStatus: doc.workflowStatus ?? doc.status,
    uploadedAt: doc.uploadedAt,
    uploadedByName: doc.uploadedByName,
    approvedBy: doc.approvedBy,
    approvedAt: doc.approvedAt,
    mimeType: doc.mimeType,
    storageRef: doc.storageRef,
    notes: doc.notes,
  }
}

function collectRegistryForEntity(entityType: DmsEntityType, entityId: string): DmsLinkedDocument[] {
  const docs = useDmsStore.getState().documents
  const rows: DmsLinkedDocument[] = []
  for (const doc of docs) {
    for (const link of doc.entityLinks) {
      if (link.entityType === entityType && link.entityId === entityId) {
        rows.push(registryToLinked(doc, link))
      }
    }
  }
  return rows
}

function collectProductAttachments(productId: string): DmsLinkedDocument[] {
  const product = useMasterStore.getState().getProduct(productId)
  if (!product) return []
  return product.attachments.map((att) => ({
    id: `prod-att-${att.id}`,
    title: att.name,
    fileName: att.name,
    category: productCategoryToDms(att.category),
    entityType: 'product' as const,
    entityId: productId,
    entityLabel: product.productName,
    source: 'product_attachment' as const,
    uploadedAt: att.uploadedAt,
    uploadedByName: att.uploadedByName,
  }))
}

function collectInquiryAttachmentsForProduct(productId: string): DmsLinkedDocument[] {
  const product = useMasterStore.getState().getProduct(productId)
  if (!product) return []
  const inquiries = useSalesStore.getState().inquiries.filter((i) => i.productId === productId)
  const rows: DmsLinkedDocument[] = []
  for (const inq of inquiries) {
    for (const att of inq.attachments) {
      rows.push({
        id: `inq-att-${att.id}`,
        title: att.name,
        fileName: att.name,
        category: 'customer_drawing',
        entityType: 'product',
        entityId: productId,
        entityLabel: product.productName,
        source: 'inquiry_attachment',
        uploadedAt: att.uploadedAt,
      })
    }
  }
  return rows
}

function collectBomRevisionDocs(bomId: string): DmsLinkedDocument[] {
  const bom = useBomStore.getState().getBom(bomId)
  if (!bom) return []
  const revisions = useBomStore.getState().bomHeaders.filter((b) => b.bomNo === bom.bomNo)
  return revisions.map((r) => ({
    id: `bom-rev-${r.id}`,
    title: `${r.bomNo} Rev ${r.revision}`,
    fileName: `${r.bomNo}-Rev-${r.revision}.csv`,
    category: 'engineering_drawing' as const,
    entityType: 'bom' as const,
    entityId: bomId,
    entityLabel: `${bom.bomNo} Rev ${bom.revision}`,
    source: 'bom_revision' as const,
    revision: r.revision,
    uploadedAt: r.updatedAt,
    uploadedByName: r.approvedBy ?? undefined,
  }))
}

function collectDispatchPhotos(dispatchId: string): DmsLinkedDocument[] {
  const plan = useDispatchStore.getState().getDispatch(dispatchId)
  if (!plan) return []
  return plan.photos.map((p) => ({
    id: `disp-photo-${p.id}`,
    title: p.label,
    fileName: `${p.label.replace(/\s+/g, '-').toLowerCase()}.jpg`,
    category: 'photo' as const,
    entityType: 'dispatch' as const,
    entityId: dispatchId,
    entityLabel: plan.dispatchNo,
    source: 'dispatch_photo' as const,
    uploadedAt: p.capturedAt,
    storageRef: p.dataUrl,
    mimeType: 'image/jpeg',
  }))
}

function collectQcParameterAttachments(qcId: string): DmsLinkedDocument[] {
  const inspection = useQualityStore.getState().getInspection(qcId)
  if (!inspection?.parameterResults?.length) return []
  const rows: DmsLinkedDocument[] = []
  for (const param of inspection.parameterResults) {
    const ref = param.attachmentRef?.trim()
    if (!ref) continue
    rows.push({
      id: `qc-param-${inspection.id}-${param.parameterId}`,
      title: `${param.parameterName} — attachment`,
      fileName: ref,
      category: param.parameterType === 'photo_required' ? 'photo' : 'test_report',
      entityType: 'qc_inspection',
      entityId: qcId,
      entityLabel: inspection.inspectionNo,
      source: 'qc_parameter',
      uploadedAt: inspection.inspectionDate ?? inspection.createdAt,
      uploadedByName: inspection.inspector ?? undefined,
      storageRef: ref.startsWith('data:') ? ref : undefined,
    })
  }
  return rows
}

function resolveProductIdForBom(bomId: string): string | undefined {
  const bom = useBomStore.getState().getBom(bomId)
  if (!bom?.productId) return undefined
  return bom.productId
}

function resolveProductIdForWo(woId: string): string | undefined {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  return wo?.productId
}

function resolveBomIdForWo(woId: string): string | undefined {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  return wo?.bomHeaderId
}

function dedupe(rows: DmsLinkedDocument[]): DmsLinkedDocument[] {
  const seen = new Set<string>()
  const out: DmsLinkedDocument[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

/** All documents linked to a specific entity (registry + federated sources). */
export function getDocumentsForEntity(entityType: DmsEntityType, entityId: string): DmsLinkedDocument[] {
  const rows: DmsLinkedDocument[] = [...collectRegistryForEntity(entityType, entityId)]

  switch (entityType) {
    case 'product':
      rows.push(...collectProductAttachments(entityId), ...collectInquiryAttachmentsForProduct(entityId))
      break
    case 'bom': {
      rows.push(...collectBomRevisionDocs(entityId))
      const productId = resolveProductIdForBom(entityId)
      if (productId) {
        rows.push(
          ...collectProductAttachments(productId).map((d) => ({
            ...d,
            entityType: 'bom' as const,
            entityId,
            id: `${d.id}::bom-${entityId}`,
          })),
        )
      }
      break
    }
    case 'work_order': {
      const productId = resolveProductIdForWo(entityId)
      const bomId = resolveBomIdForWo(entityId)
      if (productId) {
        rows.push(
          ...collectProductAttachments(productId).map((d) => ({
            ...d,
            entityType: 'work_order' as const,
            entityId,
            id: `${d.id}::wo-${entityId}`,
          })),
        )
      }
      if (bomId) {
        rows.push(
          ...getDocumentsForEntity('bom', bomId).map((d) => ({
            ...d,
            entityType: 'work_order' as const,
            entityId,
            id: `${d.id}::wo-${entityId}`,
          })),
        )
      }
      const qcRows = useQualityStore
        .getState()
        .getInspectionsForWo(entityId)
        .flatMap((i) => getDocumentsForEntity('qc_inspection', i.id))
      rows.push(
        ...qcRows.map((d) => ({
          ...d,
          entityType: 'work_order' as const,
          entityId,
          id: `${d.id}::wo-${entityId}`,
        })),
      )
      break
    }
    case 'job_work':
      rows.push(...getDocumentsForEntity('work_order', entityId))
      break
    case 'qc_inspection':
      rows.push(...collectQcParameterAttachments(entityId))
      break
    case 'dispatch':
      rows.push(...collectDispatchPhotos(entityId))
      break
    case 'eco':
    case 'customer':
    case 'vendor':
    case 'invoice':
    case 'ncr':
    case 'routing':
    case 'item':
    case 'job_work':
      break
  }

  return dedupe(rows)
}

/** Global document index for hub search. */
export function searchDocuments(filters: DmsSearchFilters = {}): DmsLinkedDocument[] {
  let rows: DmsLinkedDocument[] = []

  if (filters.entityType && filters.entityType !== 'all' && filters.entityId) {
    rows = getDocumentsForEntity(filters.entityType, filters.entityId)
  } else {
    const registry = useDmsStore.getState().documents
    for (const doc of registry) {
      for (const link of doc.entityLinks) {
        rows.push(registryToLinked(doc, link))
      }
    }
    for (const p of useMasterStore.getState().products) {
      rows.push(...collectProductAttachments(p.id))
    }
    for (const d of useDispatchStore.getState().dispatches) {
      rows.push(...collectDispatchPhotos(d.id))
    }
    for (const i of useQualityStore.getState().inspections) {
      rows.push(...collectQcParameterAttachments(i.id))
    }
    for (const b of useBomStore.getState().bomHeaders) {
      if (b.status === 'released') rows.push(...collectBomRevisionDocs(b.id))
    }
  }

  rows = dedupe(rows)

  if (filters.category && filters.category !== 'all') {
    rows = rows.filter((r) => r.category === filters.category)
  }

  const q = filters.query?.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q) ||
        (r.documentNo?.toLowerCase().includes(q) ?? false) ||
        (r.entityLabel?.toLowerCase().includes(q) ?? false),
    )
  }

  if (filters.entityType && filters.entityType !== 'all' && !filters.entityId) {
    rows = rows.filter((r) => r.entityType === filters.entityType)
  }

  if (filters.workflowStatus && filters.workflowStatus !== 'all') {
    rows = rows.filter((r) => r.workflowStatus === filters.workflowStatus)
  }

  if (filters.uploadedBy?.trim()) {
    const u = filters.uploadedBy.trim().toLowerCase()
    rows = rows.filter((r) => r.uploadedByName?.toLowerCase().includes(u))
  }

  if (filters.dateFrom) {
    rows = rows.filter((r) => r.uploadedAt.slice(0, 10) >= filters.dateFrom!)
  }
  if (filters.dateTo) {
    rows = rows.filter((r) => r.uploadedAt.slice(0, 10) <= filters.dateTo!)
  }

  if (filters.revision?.trim()) {
    const rev = filters.revision.trim().toLowerCase()
    rows = rows.filter((r) => r.revision?.toLowerCase().includes(rev))
  }

  return rows
}

export function countDocumentsForEntity(entityType: DmsEntityType, entityId: string): number {
  return getDocumentsForEntity(entityType, entityId).length
}

export function getDmsCategoryCoverage(): Record<string, number> {
  const all = searchDocuments()
  const counts: Record<string, number> = {}
  for (const d of all) {
    const key = d.category
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
