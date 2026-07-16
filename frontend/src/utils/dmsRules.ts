/** DMS validation rules — side-effect checks without changing core transaction shapes */
import type { DmsDocumentType, DmsEntityType } from '../types/dms'
import { isDocumentUsable, normalizeDocumentType } from '../types/dms'
import { getDocumentsForEntity } from './dmsIntegration'
import { useDmsStore } from '../store/dmsStore'
import { useDispatchStore } from '../store/dispatchStore'
import { getBomStoreState } from '../store/storeBridge'

const DRAWING_TYPES: DmsDocumentType[] = ['engineering_drawing', 'customer_approved_drawing', 'customer_drawing']

export function assertProductHasRequiredDrawing(productId: string): { ok: boolean; error?: string } {
  const docs = getDocumentsForEntity('product', productId)
  const hasDrawing = docs.some(
    (d) => DRAWING_TYPES.includes(d.category) && isDocumentUsable(d.workflowStatus),
  )
  if (!hasDrawing) {
    return { ok: false, error: 'Product cannot be released without a required engineering drawing' }
  }
  return { ok: true }
}

export function assertBomReleaseDocuments(bomHeaderId: string): { ok: boolean; error?: string } {
  const bom = getBomStoreState()?.getBom(bomHeaderId)
  if (!bom?.productId) return { ok: true }
  return assertProductHasRequiredDrawing(bom.productId)
}

export function assertDispatchHasPodDocument(dispatchId: string): { ok: boolean; error?: string } {
  const plan = useDispatchStore.getState().getDispatch(dispatchId)
  if (!plan) return { ok: false, error: 'Dispatch plan not found' }

  const hasPodPhoto = plan.photos.some((p) => p.category === 'pod')
  const hasPodAck = Boolean(plan.customerAck?.acknowledgedBy?.trim())
  const docs = getDocumentsForEntity('dispatch', dispatchId)
  const hasPodDoc = docs.some((d) => {
    const norm = normalizeDocumentType(d.category)
    if (norm === 'gate_pass') return isDocumentUsable(d.workflowStatus)
    if (norm === 'dispatch_photo' && /pod/i.test(d.title)) return isDocumentUsable(d.workflowStatus)
    return false
  })

  if (!hasPodPhoto && !hasPodDoc && !hasPodAck) {
    return { ok: false, error: 'POD document required before dispatch closure' }
  }
  return { ok: true }
}

export function assertDispatchCloseDocuments(dispatchId: string): { ok: boolean; error?: string } {
  return assertDispatchHasPodDocument(dispatchId)
}

export function assertDocumentUsableForTransaction(documentId: string): { ok: boolean; error?: string } {
  const doc = useDmsStore.getState().getDocument(documentId)
  if (!doc) return { ok: false, error: 'Document not found' }
  const status = doc.workflowStatus ?? doc.status ?? 'uploaded'
  if (!isDocumentUsable(status)) {
    return { ok: false, error: 'Obsolete or rejected documents cannot be used in new transactions' }
  }
  return { ok: true }
}

export function hasEcoDrawingPair(ecoId: string): boolean {
  const docs = useDmsStore.getState().documents.filter((d) =>
    d.entityLinks.some((l) => l.entityType === 'eco' && l.entityId === ecoId),
  )
  const engineering = docs.filter((d) => normalizeDocumentType(d.category) === 'engineering_drawing')
  const hasOld = engineering.some((d) => !d.isLatest || d.status === 'superseded' || d.workflowStatus === 'obsolete')
  const hasNew = engineering.some((d) => d.isLatest && isDocumentUsable(d.workflowStatus ?? d.status))
  return hasOld && hasNew
}

export function linkEcoDrawingRevision(
  ecoId: string,
  input: {
    oldDocumentId: string
    newFileName: string
    newRevision: string
    storageRef?: string
    drawingNo?: string
    bomId?: string
    productId?: string
  },
): { ok: boolean; error?: string; newDocumentId?: string } {
  const store = useDmsStore.getState()
  const old = store.getDocument(input.oldDocumentId)
  if (!old) return { ok: false, error: 'Source drawing not found' }

  const supersede = store.supersedeDocument(input.oldDocumentId, {
    fileName: input.newFileName,
    revision: input.newRevision,
    storageRef: input.storageRef,
    notes: `ECO revision ${input.newRevision}`,
  })
  if (!supersede.ok || !supersede.newDocumentId) return supersede

  store.linkDocument(supersede.newDocumentId, {
    entityType: 'eco',
    entityId: ecoId,
    entityLabel: ecoId,
  })

  const newDoc = store.getDocument(supersede.newDocumentId)
  if (newDoc) {
    useDmsStore.setState((s) => ({
      documents: s.documents.map((d) =>
        d.id === supersede.newDocumentId
          ? {
              ...d,
              engineeringMeta: {
                ...d.engineeringMeta,
                drawingNo: input.drawingNo ?? d.engineeringMeta?.drawingNo,
                drawingRevision: input.newRevision,
                ecoId,
                bomId: input.bomId ?? d.engineeringMeta?.bomId,
                productId: input.productId ?? d.engineeringMeta?.productId,
                effectiveDate: new Date().toISOString().slice(0, 10),
              },
            }
          : d,
      ),
    }))
  }

  return supersede
}

export function countRegistryDocumentsForEntity(entityType: DmsEntityType, entityId: string): number {
  return useDmsStore.getState().documents.filter((d) =>
    d.entityLinks.some((l) => l.entityType === entityType && l.entityId === entityId),
  ).length
}
