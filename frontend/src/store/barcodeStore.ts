import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BarcodeEntityType,
  BarcodeEventType,
  BarcodeHistoryEntry,
  BarcodeRecord,
  BarcodeStatus,
} from '../types/barcode'
import { getSessionUser } from '../utils/permissions'
import { nextDocumentNo } from '../utils/documentNumbers'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'

const ENTITY_PREFIX: Record<BarcodeEntityType, string> = {
  item: 'ITM',
  batch: 'BAT',
  grn: 'GRN',
  sub_assembly: 'SA',
  work_order: 'WO',
  finished_goods: 'FG',
  trailer: 'TRL',
}

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function tsDate() {
  return new Date().toISOString().slice(0, 10)
}

function ts() {
  return new Date().toISOString()
}

export function buildBarcodeValue(entityType: BarcodeEntityType, entityId: string, seq: number): string {
  const slug = entityId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() || 'X'
  return `VT-${ENTITY_PREFIX[entityType]}-${slug}-${String(seq).padStart(4, '0')}`
}

export function buildQrValue(record: Pick<BarcodeRecord, 'entityType' | 'entityId' | 'barcodeValue'>): string {
  return JSON.stringify({
    v: 1,
    bc: record.barcodeValue,
    t: record.entityType,
    id: record.entityId,
  })
}

interface BarcodeState {
  barcodes: BarcodeRecord[]
  history: BarcodeHistoryEntry[]

  getBarcode: (barcodeId: string) => BarcodeRecord | undefined
  getByValue: (scan: string) => BarcodeRecord | undefined
  getForEntity: (entityType: BarcodeEntityType, entityId: string) => BarcodeRecord[]
  getHistory: (barcodeId: string) => BarcodeHistoryEntry[]
  getAllHistory: () => BarcodeHistoryEntry[]

  generateBarcode: (input: {
    entityType: BarcodeEntityType
    entityId: string
    entityLabel: string
    batchNo?: string
    trailerNo?: string
    chassisNo?: string
  }) => BarcodeRecord

  updateStatus: (barcodeId: string, status: BarcodeStatus) => void

  recordEvent: (input: {
    barcodeId: string
    eventType: BarcodeEventType
    referenceNo: string
    details: string
    entityType?: BarcodeEntityType
    entityId?: string
  }) => BarcodeHistoryEntry
}

export const useBarcodeStore = create<BarcodeState>()(
  persist(
    (set, get) => ({
      barcodes: [],
      history: [],

      getBarcode: (barcodeId) => get().barcodes.find((b) => b.barcodeId === barcodeId),

      getByValue: (scan) => {
        const q = scan.trim()
        if (!q) return undefined
        const upper = q.toUpperCase()
        return get().barcodes.find(
          (b) =>
            b.status !== 'void' &&
            (b.barcodeValue.toUpperCase() === upper ||
              b.qrValue === q ||
              b.barcodeId === q ||
              b.entityId === q ||
              (b.trailerNo && b.trailerNo.toUpperCase() === upper) ||
              (b.chassisNo && b.chassisNo.toUpperCase() === upper)),
        )
      },

      getForEntity: (entityType, entityId) =>
        get().barcodes.filter((b) => b.entityType === entityType && b.entityId === entityId),

      getHistory: (barcodeId) =>
        get()
          .history.filter((h) => h.barcodeId === barcodeId)
          .sort((a, b) => b.eventDate.localeCompare(a.eventDate)),

      getAllHistory: () => [...get().history].sort((a, b) => b.eventDate.localeCompare(a.eventDate)),

      generateBarcode: (input) => {
        const existing = get().barcodes.filter((b) => b.entityType === input.entityType && b.entityId === input.entityId)
        const seq = existing.length + 1
        const barcodeValue = buildBarcodeValue(input.entityType, input.entityId, seq)
        const record: BarcodeRecord = {
          barcodeId: nextDocumentNo('BC-', get().barcodes.map((b) => b.barcodeId)),
          entityType: input.entityType,
          entityId: input.entityId,
          entityLabel: input.entityLabel,
          barcodeValue,
          qrValue: '',
          status: 'active',
          createdDate: tsDate(),
          batchNo: input.batchNo,
          trailerNo: input.trailerNo,
          chassisNo: input.chassisNo,
        }
        record.qrValue = buildQrValue(record)
        set((s) => ({
          barcodes: [record, ...s.barcodes],
        }))
        get().recordEvent({
          barcodeId: record.barcodeId,
          eventType: 'created',
          referenceNo: record.barcodeId,
          details: `Generated for ${input.entityLabel}`,
          entityType: input.entityType,
          entityId: input.entityId,
        })
        return record
      },

      updateStatus: (barcodeId, status) => {
        set((s) => ({
          barcodes: s.barcodes.map((b) => (b.barcodeId === barcodeId ? { ...b, status } : b)),
        }))
      },

      recordEvent: (input) => {
        const bc = get().getBarcode(input.barcodeId)
        const user = getSessionUser()
        const entry: BarcodeHistoryEntry = {
          id: genId('bch'),
          barcodeId: input.barcodeId,
          barcodeValue: bc?.barcodeValue ?? input.barcodeId,
          eventType: input.eventType,
          entityType: input.entityType ?? bc?.entityType ?? 'item',
          entityId: input.entityId ?? bc?.entityId ?? '',
          referenceNo: input.referenceNo,
          details: input.details,
          eventDate: ts(),
          userName: user.name,
        }
        set((s) => ({ history: [entry, ...s.history] }))
        return entry
      },
    }),
    {
      name: ERP_STORAGE_KEYS.barcode,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)
