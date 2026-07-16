import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkCenter } from '../types/workcenter'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { mergeWorkCentersWithSeed, type WorkCenterPersistSlice } from '../utils/persistMigration'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

interface WorkCenterState {
  workCenters: WorkCenter[]

  getWorkCenter: (id: string) => WorkCenter | undefined
  getWorkCenterByCode: (code: string) => WorkCenter | undefined
  getActiveWorkCenters: () => WorkCenter[]

  addWorkCenter: (data: Omit<WorkCenter, 'id' | 'createdAt'>) => string
  updateWorkCenter: (id: string, data: Partial<WorkCenter>) => void
}

const initialWorkCenters = mergeWorkCentersWithSeed(null).workCenters

export const useWorkCenterStore = create<WorkCenterState>()(
  persist(
    (set, get) => ({
      workCenters: initialWorkCenters,

      getWorkCenter: (id) => get().workCenters.find((w) => w.id === id),
      getWorkCenterByCode: (code) => get().workCenters.find((w) => w.workCenterCode === code),
      getActiveWorkCenters: () => get().workCenters.filter((w) => w.isActive),

      addWorkCenter: (data) => {
        const id = genId('wc')
        set((s) => ({
          workCenters: [...s.workCenters, { ...data, id, createdAt: new Date().toISOString() }],
        }))
        return id
      },

      updateWorkCenter: (id, data) => {
        set((s) => ({
          workCenters: s.workCenters.map((w) => (w.id === id ? { ...w, ...data } : w)),
        }))
      },
    }),
    {
      name: ERP_STORAGE_KEYS.workCenters,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({ workCenters: s.workCenters }),
      merge: (persisted, current) => {
        const merged = mergeWorkCentersWithSeed(persisted as Partial<WorkCenterPersistSlice> | undefined)
        return { ...current, ...merged }
      },
    },
  ),
)

/** @deprecated Use useActiveWorkCenters hook in UI — store method kept for engines. */