import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DmsDocumentType,
  DmsEngineeringMeta,
  DmsEntityLink,
  DmsEntityType,
  DmsRegistryDocument,
  DmsTimelineEvent,
  DmsWorkflowStatus,
} from '../types/dms'
import { normalizeWorkflowStatus } from '../types/dms'
import { seedDmsDocuments } from '../data/dms/seedDocuments'
import { getSessionUser, assertPermission } from '../utils/permissions'
import { nextDocumentNo } from '../utils/documentNumbers'
import { createStorageRef, deleteFileContent, storeFileContent } from '../utils/fileStorage'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

interface DmsState {
  documents: DmsRegistryDocument[]
  timeline: DmsTimelineEvent[]

  getDocument: (id: string) => DmsRegistryDocument | undefined
  registerDocument: (input: {
    title: string
    fileName: string
    category: DmsDocumentType
    mimeType?: string
    storageRef?: string
    fileContent?: string
    revision?: string
    vendorId?: string
    vendorName?: string
    notes?: string
    remarks?: string
    workflowStatus?: DmsWorkflowStatus
    engineeringMeta?: DmsEngineeringMeta
    entityLinks?: Array<Omit<DmsEntityLink, 'linkedAt' | 'linkedByName'> & { linkedByName?: string }>
  }) => string
  uploadDocument: (input: {
    title: string
    fileName: string
    category: DmsDocumentType
    mimeType?: string
    fileContent: string
    revision?: string
    remarks?: string
    engineeringMeta?: DmsEngineeringMeta
    entityLinks?: Array<Omit<DmsEntityLink, 'linkedAt' | 'linkedByName'> & { linkedByName?: string }>
  }) => { ok: boolean; error?: string; documentId?: string }
  linkDocument: (documentId: string, link: Omit<DmsEntityLink, 'linkedAt' | 'linkedByName'> & { linkedByName?: string }) => boolean
  unlinkDocument: (documentId: string, entityType: DmsEntityType, entityId: string) => boolean
  supersedeDocument: (
    documentId: string,
    input: {
      title?: string
      fileName: string
      revision?: string
      storageRef?: string
      fileContent?: string
      notes?: string
    },
  ) => { ok: boolean; error?: string; newDocumentId?: string }
  approveDocument: (documentId: string, remarks?: string) => { ok: boolean; error?: string }
  rejectDocument: (documentId: string, remarks?: string) => { ok: boolean; error?: string }
  markObsolete: (documentId: string, remarks?: string) => { ok: boolean; error?: string }
  deleteDocument: (documentId: string) => { ok: boolean; error?: string }
  submitForReview: (documentId: string) => { ok: boolean; error?: string }
  getVersionHistory: (documentNo: string) => DmsRegistryDocument[]
  getApprovalQueue: () => DmsRegistryDocument[]
  getDocumentTimeline: (documentId: string) => DmsTimelineEvent[]
}

function pushTimeline(
  events: DmsTimelineEvent[],
  event: Omit<DmsTimelineEvent, 'id'>,
): DmsTimelineEvent[] {
  return [{ ...event, id: genId('dms-ev') }, ...events]
}

export const useDmsStore = create<DmsState>()(
  persist(
    (set, get) => ({
      documents: seedDmsDocuments.map((d) => ({
        ...d,
        version: d.version ?? 1,
        isLatest: d.isLatest ?? true,
        workflowStatus: d.workflowStatus ?? d.status ?? 'approved',
        status: d.status ?? d.workflowStatus ?? 'approved',
        entityLinks: d.entityLinks.map((l) => ({ ...l })),
      })),
      timeline: [],

      getDocument: (id) => get().documents.find((d) => d.id === id),

      registerDocument: (input) => {
        const perm = assertPermission('dms', 'create')
        if (!perm.ok) throw new Error(perm.error)
        const user = getSessionUser()
        const id = genId('dms')
        const storageRef =
          input.storageRef ??
          (input.fileContent ? createStorageRef(id, input.fileName) : undefined)
        if (input.fileContent && storageRef) {
          storeFileContent(storageRef, input.fileContent)
        }
        const workflowStatus = input.workflowStatus ?? 'uploaded'
        const doc: DmsRegistryDocument = {
          id,
          documentNo: nextDocumentNo('DOC-', get().documents.map((d) => d.documentNo)),
          title: input.title,
          fileName: input.fileName,
          category: input.category,
          mimeType: input.mimeType,
          storageRef,
          revision: input.revision,
          version: 1,
          isLatest: true,
          workflowStatus,
          status: workflowStatus,
          supersededById: null,
          vendorId: input.vendorId,
          vendorName: input.vendorName,
          notes: input.notes,
          remarks: input.remarks,
          engineeringMeta: input.engineeringMeta,
          uploadedAt: ts(),
          uploadedByName: user.name,
          approvedBy: null,
          approvedAt: null,
          entityLinks: (input.entityLinks ?? []).map((l) => ({
            ...l,
            linkedAt: ts(),
            linkedByName: l.linkedByName ?? user.name,
          })),
        }
        set((s) => ({
          documents: [...s.documents, doc],
          timeline: pushTimeline(s.timeline, {
            kind: 'upload',
            label: 'Document uploaded',
            at: doc.uploadedAt,
            byName: user.name,
            details: `${doc.documentNo} — ${doc.title}`,
          }),
        }))
        return id
      },

      uploadDocument: (input) => {
        try {
          const id = get().registerDocument({
            ...input,
            workflowStatus: 'uploaded',
          })
          return { ok: true, documentId: id }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Upload failed' }
        }
      },

      linkDocument: (documentId, link) => {
        const user = getSessionUser()
        let ok = false
        set((s) => ({
          documents: s.documents.map((d) => {
            if (d.id !== documentId) return d
            if (d.entityLinks.some((l) => l.entityType === link.entityType && l.entityId === link.entityId)) {
              ok = true
              return d
            }
            ok = true
            return {
              ...d,
              entityLinks: [
                ...d.entityLinks,
                {
                  ...link,
                  linkedAt: ts(),
                  linkedByName: link.linkedByName ?? user.name,
                },
              ],
            }
          }),
        }))
        return ok
      },

      unlinkDocument: (documentId, entityType, entityId) => {
        let ok = false
        set((s) => ({
          documents: s.documents.map((d) => {
            if (d.id !== documentId) return d
            const next = d.entityLinks.filter((l) => !(l.entityType === entityType && l.entityId === entityId))
            if (next.length !== d.entityLinks.length) ok = true
            return { ...d, entityLinks: next }
          }),
        }))
        return ok
      },

      supersedeDocument: (documentId, input) => {
        const perm = assertPermission('dms', 'edit')
        if (!perm.ok) return perm
        const source = get().getDocument(documentId)
        if (!source) return { ok: false, error: 'Document not found' }
        const user = getSessionUser()
        const now = ts()
        const newId = genId('dms')
        const storageRef =
          input.storageRef ??
          (input.fileContent ? createStorageRef(newId, input.fileName) : source.storageRef)
        if (input.fileContent && storageRef) {
          storeFileContent(storageRef, input.fileContent)
        }
        const nextVersion = (source.version ?? 1) + 1
        const newDoc: DmsRegistryDocument = {
          ...source,
          id: newId,
          title: input.title ?? source.title,
          fileName: input.fileName,
          revision: input.revision ?? source.revision,
          storageRef,
          notes: input.notes ?? source.notes,
          version: nextVersion,
          isLatest: true,
          workflowStatus: 'uploaded',
          status: 'uploaded',
          supersededById: null,
          uploadedAt: now,
          uploadedByName: user.name,
          approvedBy: null,
          approvedAt: null,
          entityLinks: source.entityLinks.map((l) => ({ ...l })),
        }
        set((s) => ({
          documents: [
            newDoc,
            ...s.documents.map((d) =>
              d.id === documentId
                ? {
                    ...d,
                    isLatest: false,
                    workflowStatus: 'superseded' as DmsWorkflowStatus,
                    status: 'superseded' as DmsWorkflowStatus,
                    supersededById: newId,
                  }
                : d,
            ),
          ],
          timeline: pushTimeline(s.timeline, {
            kind: 'supersede',
            label: `New version v${nextVersion}`,
            at: now,
            byName: user.name,
            details: `${source.documentNo} superseded`,
          }),
        }))
        return { ok: true, newDocumentId: newId }
      },

      submitForReview: (documentId) => {
        const doc = get().getDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === documentId ? { ...d, workflowStatus: 'under_review', status: 'under_review' } : d,
          ),
          timeline: pushTimeline(s.timeline, {
            kind: 'review',
            label: 'Submitted for review',
            at: now,
            byName: user.name,
            details: doc.documentNo,
          }),
        }))
        return { ok: true }
      },

      approveDocument: (documentId, remarks) => {
        const perm = assertPermission('dms', 'edit')
        if (!perm.ok) return perm
        const doc = get().getDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        const user = getSessionUser()
        const now = ts()
        const lockCustomer =
          doc.category === 'customer_approved_drawing' || doc.category === 'customer_drawing'
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  workflowStatus: 'approved',
                  status: 'approved',
                  approvedBy: user.name,
                  approvedAt: now,
                  remarks: remarks ?? d.remarks,
                  engineeringMeta: lockCustomer
                    ? { ...d.engineeringMeta, customerApproved: true, locked: true }
                    : d.engineeringMeta,
                }
              : d,
          ),
          timeline: pushTimeline(s.timeline, {
            kind: 'approve',
            label: 'Document approved',
            at: now,
            byName: user.name,
            details: doc.documentNo,
          }),
        }))
        return { ok: true }
      },

      rejectDocument: (documentId, remarks) => {
        const perm = assertPermission('dms', 'edit')
        if (!perm.ok) return perm
        const doc = get().getDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === documentId
              ? { ...d, workflowStatus: 'rejected', status: 'rejected', remarks: remarks ?? d.remarks }
              : d,
          ),
          timeline: pushTimeline(s.timeline, {
            kind: 'reject',
            label: 'Document rejected',
            at: now,
            byName: user.name,
            details: remarks,
          }),
        }))
        return { ok: true }
      },

      markObsolete: (documentId, remarks) => {
        const perm = assertPermission('dms', 'edit')
        if (!perm.ok) return perm
        const doc = get().getDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        const user = getSessionUser()
        const now = ts()
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === documentId
              ? { ...d, workflowStatus: 'obsolete', status: 'obsolete', remarks: remarks ?? d.remarks }
              : d,
          ),
          timeline: pushTimeline(s.timeline, {
            kind: 'obsolete',
            label: 'Marked obsolete',
            at: now,
            byName: user.name,
            details: doc.documentNo,
          }),
        }))
        return { ok: true }
      },

      deleteDocument: (documentId) => {
        const perm = assertPermission('dms', 'edit')
        if (!perm.ok) return perm
        const doc = get().getDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        const status = normalizeWorkflowStatus(doc)
        if (status === 'approved') {
          return { ok: false, error: 'Approved documents cannot be deleted' }
        }
        if (doc.storageRef) deleteFileContent(doc.storageRef)
        set((s) => ({
          documents: s.documents.filter((d) => d.id !== documentId),
        }))
        return { ok: true }
      },

      getVersionHistory: (documentNo) =>
        get()
          .documents.filter((d) => d.documentNo === documentNo)
          .sort((a, b) => (b.version ?? 1) - (a.version ?? 1)),

      getApprovalQueue: () =>
        get().documents.filter(
          (d) =>
            d.isLatest !== false &&
            (normalizeWorkflowStatus(d) === 'under_review' || normalizeWorkflowStatus(d) === 'uploaded'),
        ),

      getDocumentTimeline: (documentId) => {
        const doc = get().getDocument(documentId)
        if (!doc) return []
        const global = get().timeline.filter((e) => e.details?.includes(doc.documentNo))
        const built: DmsTimelineEvent[] = [
          {
            id: `${documentId}-upload`,
            kind: 'upload',
            label: 'Uploaded',
            at: doc.uploadedAt,
            byName: doc.uploadedByName,
          },
        ]
        if (doc.approvedAt) {
          built.push({
            id: `${documentId}-approve`,
            kind: 'approve',
            label: 'Approved',
            at: doc.approvedAt,
            byName: doc.approvedBy ?? undefined,
          })
        }
        if (normalizeWorkflowStatus(doc) === 'obsolete') {
          built.push({
            id: `${documentId}-obsolete`,
            kind: 'obsolete',
            label: 'Obsolete',
            at: doc.uploadedAt,
          })
        }
        return [...global, ...built].sort((a, b) => b.at.localeCompare(a.at))
      },
    }),
    {
      name: ERP_STORAGE_KEYS.dms,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)
