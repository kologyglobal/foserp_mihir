import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CodeReservation,
  CodeSeries,
  CodeSeriesAuditEntry,
  CodeSeriesEntityType,
} from '../types/codeSeriesMaster'
import { seedCodeSeries } from '../data/masters/codeSeriesSeed'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function mergeSeriesWithSeed(persisted: CodeSeries[] | undefined): CodeSeries[] {
  const map = new Map<string, CodeSeries>()
  for (const s of seedCodeSeries) map.set(s.id, { ...s })
  for (const s of persisted ?? []) {
    const existing = map.get(s.id)
    map.set(s.id, existing ? { ...existing, ...s } : s)
  }
  return Array.from(map.values())
}

interface CodeSeriesState {
  series: CodeSeries[]
  reservations: CodeReservation[]
  auditLog: CodeSeriesAuditEntry[]
  confirmedCodes: Record<string, string[]>

  addSeries: (data: Omit<CodeSeries, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateSeries: (id: string, data: Partial<CodeSeries>, meta?: { by: string; reason?: string }) => void
  getSeries: (id: string) => CodeSeries | undefined
  getSeriesByCode: (code: string) => CodeSeries | undefined
  getActiveSeriesByEntity: (entityType: CodeSeriesEntityType) => CodeSeries | undefined
  duplicateSeries: (id: string, by: string) => string | null
  resetSeries: (id: string, by: string, reason: string) => void
  deactivateSeries: (id: string, by: string) => void

  addReservation: (reservation: Omit<CodeReservation, 'id'>) => CodeReservation
  updateReservation: (id: string, data: Partial<CodeReservation>) => void
  getReservationByCode: (entityType: CodeSeriesEntityType, code: string) => CodeReservation | undefined

  pushAudit: (entry: Omit<CodeSeriesAuditEntry, 'id'>) => void
  trackConfirmedCode: (entityType: CodeSeriesEntityType, code: string) => void
  isCodeUsed: (entityType: CodeSeriesEntityType, code: string) => boolean
}

export const useCodeSeriesStore = create<CodeSeriesState>()(
  persist(
    (set, get) => ({
      series: seedCodeSeries,
      reservations: [],
      auditLog: [],
      confirmedCodes: {},

      addSeries: (data) => {
        const id = genId('cs')
        const ts = new Date().toISOString()
        const by = data.modifiedBy ?? 'admin'
        set((s) => ({
          series: [
            ...s.series,
            {
              ...data,
              id,
              createdBy: data.createdBy ?? by,
              modifiedBy: by,
              createdAt: ts,
              updatedAt: ts,
            },
          ],
        }))
        get().pushAudit({ seriesId: id, action: 'created', at: ts, by, detail: data.seriesCode })
        return id
      },

      updateSeries: (id, data, meta) => {
        const ts = new Date().toISOString()
        const by = meta?.by ?? data.modifiedBy ?? 'admin'
        set((s) => ({
          series: s.series.map((row) =>
            row.id === id ? { ...row, ...data, modifiedBy: by, updatedAt: ts } : row,
          ),
        }))
        get().pushAudit({
          seriesId: id,
          action: 'updated',
          at: ts,
          by,
          reason: meta?.reason,
          detail: Object.keys(data).join(', '),
        })
      },

      getSeries: (id) => get().series.find((s) => s.id === id),
      getSeriesByCode: (code) => get().series.find((s) => s.seriesCode === code),
      getActiveSeriesByEntity: (entityType) =>
        get().series.find((s) => s.entityType === entityType && s.isActive),

      duplicateSeries: (id, by) => {
        const source = get().getSeries(id)
        if (!source) return null
        const copyCode = `${source.seriesCode}-COPY`.slice(0, 20)
        return get().addSeries({
          ...source,
          seriesCode: copyCode,
          seriesName: `${source.seriesName} (Copy)`,
          isActive: false,
          currentNumber: source.startingNumber - 1,
          modifiedBy: by,
        })
      },

      resetSeries: (id, by, reason) => {
        const row = get().getSeries(id)
        if (!row) return
        const ts = new Date().toISOString()
        set((s) => ({
          series: s.series.map((r) =>
            r.id === id
              ? {
                  ...r,
                  currentNumber: r.startingNumber - 1,
                  lastResetDate: ts.slice(0, 10),
                  nextResetDate: undefined,
                  modifiedBy: by,
                  updatedAt: ts,
                }
              : r,
          ),
        }))
        get().pushAudit({ seriesId: id, action: 'reset', at: ts, by, reason })
      },

      deactivateSeries: (id, by) => {
        get().updateSeries(id, { isActive: false, modifiedBy: by })
        get().pushAudit({
          seriesId: id,
          action: 'deactivated',
          at: new Date().toISOString(),
          by,
        })
      },

      addReservation: (reservation) => {
        const id = genId('csr')
        const row: CodeReservation = { ...reservation, id }
        set((s) => ({ reservations: [...s.reservations, row] }))
        get().pushAudit({
          seriesId: reservation.seriesId,
          action: 'reserved',
          at: reservation.reservedAt,
          by: 'system',
          detail: reservation.code,
        })
        return row
      },

      updateReservation: (id, data) =>
        set((s) => ({
          reservations: s.reservations.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),

      getReservationByCode: (entityType, code) =>
        get().reservations.find(
          (r) => r.entityType === entityType && r.code === code && r.status !== 'released',
        ),

      pushAudit: (entry) =>
        set((s) => ({
          auditLog: [{ ...entry, id: genId('csa') }, ...s.auditLog].slice(0, 500),
        })),

      trackConfirmedCode: (entityType, code) =>
        set((s) => ({
          confirmedCodes: {
            ...s.confirmedCodes,
            [entityType]: [...(s.confirmedCodes[entityType] ?? []), code],
          },
        })),

      isCodeUsed: (entityType, code) => {
        const confirmed = get().confirmedCodes[entityType] ?? []
        if (confirmed.includes(code)) return true
        return get().reservations.some(
          (r) => r.entityType === entityType && r.code === code && r.status !== 'released',
        )
      },
    }),
    {
      name: ERP_STORAGE_KEYS.codeSeries,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        series: s.series,
        reservations: s.reservations,
        auditLog: s.auditLog,
        confirmedCodes: s.confirmedCodes,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<CodeSeriesState> | undefined
        return {
          ...current,
          series: mergeSeriesWithSeed(p?.series),
          reservations: p?.reservations ?? [],
          auditLog: p?.auditLog ?? [],
          confirmedCodes: p?.confirmedCodes ?? {},
        }
      },
    },
  ),
)
