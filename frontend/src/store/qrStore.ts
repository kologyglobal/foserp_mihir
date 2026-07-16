import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  QrEntityType,
  QrEventType,
  QrGenealogyEdge,
  QrHistoryEntry,
  QrMetadata,
  QrMovementKind,
  QrRecord,
  QrStatus,
} from '../types/qrTraceability'
import { buildQrPayload } from '../utils/qrPayload'
import { getSessionUser } from '../utils/permissions'
import { nextDocumentNo } from '../utils/documentNumbers'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

interface RegisterInput {
  entityType: QrEntityType
  entityId: string
  displayCode: string
  status?: QrStatus
  metadata?: QrMetadata
  payload?: Partial<{ wo: string; item: string; batch: string; grn: string; vendor: string; trailer: string; chassis: string }>
}

interface QrState {
  records: QrRecord[]
  history: QrHistoryEntry[]
  edges: QrGenealogyEdge[]

  getQr: (qrId: string) => QrRecord | undefined
  getByCode: (scan: string) => QrRecord | undefined
  getForEntity: (entityType: QrEntityType, entityId: string) => QrRecord[]
  getHistory: (qrId: string) => QrHistoryEntry[]
  getAllHistory: () => QrHistoryEntry[]
  getEdges: () => QrGenealogyEdge[]

  registerQr: (input: RegisterInput) => QrRecord
  updateStatus: (qrId: string, status: QrStatus) => void
  updateMetadata: (qrId: string, metadata: Partial<QrMetadata>) => void
  markScanned: (qrId: string) => void
  linkGenealogy: (fromQrId: string, toQrId: string, relation: string) => void

  recordEvent: (input: {
    qrId: string
    eventType: QrEventType
    referenceNo: string
    details: string
    movementKind?: QrMovementKind
    linkedQrId?: string
  }) => QrHistoryEntry
}

export const useQrStore = create<QrState>()(
  persist(
    (set, get) => ({
      records: [],
      history: [],
      edges: [],

      getQr: (qrId) => get().records.find((r) => r.qrId === qrId),

      getByCode: (scan) => {
        const q = scan.trim()
        if (!q) return undefined
        return get().records.find(
          (r) =>
            r.qrCode === q ||
            r.qrId === q ||
            r.displayCode === q ||
            r.entityId === q ||
            (r.metadata.trailerNo && r.metadata.trailerNo === q) ||
            (r.metadata.chassisNo && r.metadata.chassisNo === q) ||
            (r.metadata.batchNo && r.metadata.batchNo === q) ||
            (r.metadata.lotNo && r.metadata.lotNo === q),
        )
      },

      getForEntity: (entityType, entityId) =>
        get().records.filter((r) => r.entityType === entityType && r.entityId === entityId),

      getHistory: (qrId) =>
        get().history.filter((h) => h.qrId === qrId).sort((a, b) => b.eventAt.localeCompare(a.eventAt)),

      getAllHistory: () => [...get().history].sort((a, b) => b.eventAt.localeCompare(a.eventAt)),

      getEdges: () => get().edges,

      registerQr: (input) => {
        const user = getSessionUser()
        const existing = get().getForEntity(input.entityType, input.entityId).find((r) => r.status !== 'CLOSED')
        if (existing) return existing

        const qrId = nextDocumentNo('QR-', get().records.map((r) => r.qrId))
        const payload = buildQrPayload({
          type: input.entityType,
          id: input.displayCode,
          wo: input.payload?.wo,
          item: input.payload?.item,
          batch: input.payload?.batch,
          grn: input.payload?.grn,
          vendor: input.payload?.vendor,
          trailer: input.payload?.trailer,
          chassis: input.payload?.chassis,
        })
        const dupCode = get().records.find((r) => r.qrCode === payload && r.status !== 'CLOSED')
        if (dupCode && dupCode.entityType === input.entityType && dupCode.entityId === input.entityId) {
          return dupCode
        }
        const record: QrRecord = {
          qrId,
          qrCode: payload,
          entityType: input.entityType,
          entityId: input.entityId,
          displayCode: input.displayCode,
          status: input.status ?? 'CREATED',
          createdAt: ts(),
          createdBy: user.name,
          lastScannedAt: null,
          lastScannedBy: null,
          metadata: input.metadata ?? {},
        }
        set((s) => ({ records: [record, ...s.records] }))
        get().recordEvent({
          qrId,
          eventType: 'received',
          referenceNo: qrId,
          details: `QR registered for ${input.displayCode}`,
        })
        if (input.metadata?.parentQrId) {
          get().linkGenealogy(input.metadata.parentQrId, qrId, 'parent-child')
        }
        return record
      },

      updateStatus: (qrId, status) => {
        set((s) => ({
          records: s.records.map((r) => (r.qrId === qrId ? { ...r, status } : r)),
        }))
      },

      updateMetadata: (qrId, metadata) => {
        set((s) => ({
          records: s.records.map((r) =>
            r.qrId === qrId ? { ...r, metadata: { ...r.metadata, ...metadata } } : r,
          ),
        }))
      },

      markScanned: (qrId) => {
        const user = getSessionUser()
        set((s) => ({
          records: s.records.map((r) =>
            r.qrId === qrId ? { ...r, lastScannedAt: ts(), lastScannedBy: user.name } : r,
          ),
        }))
      },

      linkGenealogy: (fromQrId, toQrId, relation) => {
        if (fromQrId === toQrId) return
        const exists = get().edges.some((e) => e.fromQrId === fromQrId && e.toQrId === toQrId && e.relation === relation)
        if (exists) return
        set((s) => ({ edges: [{ fromQrId, toQrId, relation }, ...s.edges] }))
        get().updateMetadata(toQrId, { parentQrId: fromQrId })
      },

      recordEvent: (input) => {
        const user = getSessionUser()
        const entry: QrHistoryEntry = {
          id: genId('qre'),
          qrId: input.qrId,
          eventType: input.eventType,
          movementKind: input.movementKind,
          referenceNo: input.referenceNo,
          details: input.details,
          eventAt: ts(),
          userName: user.name,
          linkedQrId: input.linkedQrId,
        }
        set((s) => ({ history: [entry, ...s.history] }))
        return entry
      },
    }),
    {
      name: ERP_STORAGE_KEYS.qr,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)

export function ensureEntityQr(input: RegisterInput) {
  return useQrStore.getState().registerQr(input)
}
