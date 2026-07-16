import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { erpStorage, ERP_STORAGE_KEYS } from './persistConfig'

export type MobileDraftKind =
  | 'gate_entry'
  | 'stock_count'
  | 'job_card_daily'
  | 'qc_inspection'
  | 'grn_receive'

export interface MobileDraft {
  id: string
  kind: MobileDraftKind
  title: string
  payload: Record<string, unknown>
  updatedAt: string
  entityId?: string
}

interface MobileDraftState {
  drafts: MobileDraft[]
  syncQueue: MobileDraft[]
  isOnline: boolean
  setOnline: (online: boolean) => void
  saveDraft: (draft: Omit<MobileDraft, 'id' | 'updatedAt'> & { id?: string }) => string
  removeDraft: (id: string) => void
  queueForSync: (id: string) => void
  dequeueSync: (id: string) => void
  getDraftsByKind: (kind: MobileDraftKind) => MobileDraft[]
}

function genDraftId() {
  return `mob-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useMobileDraftStore = create<MobileDraftState>()(
  persist(
    (set, get) => ({
      drafts: [],
      syncQueue: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

      setOnline: (online) => set({ isOnline: online }),

      saveDraft: (input) => {
        const id = input.id ?? genDraftId()
        const draft: MobileDraft = {
          ...input,
          id,
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          drafts: [draft, ...s.drafts.filter((d) => d.id !== id)],
        }))
        return id
      },

      removeDraft: (id) =>
        set((s) => ({
          drafts: s.drafts.filter((d) => d.id !== id),
          syncQueue: s.syncQueue.filter((d) => d.id !== id),
        })),

      queueForSync: (id) => {
        const draft = get().drafts.find((d) => d.id === id)
        if (!draft) return
        set((s) => ({
          syncQueue: s.syncQueue.some((d) => d.id === id) ? s.syncQueue : [...s.syncQueue, draft],
        }))
      },

      dequeueSync: (id) =>
        set((s) => ({
          syncQueue: s.syncQueue.filter((d) => d.id !== id),
          drafts: s.drafts.filter((d) => d.id !== id),
        })),

      getDraftsByKind: (kind) => get().drafts.filter((d) => d.kind === kind),
    }),
    {
      name: ERP_STORAGE_KEYS.mobileDrafts,
      storage: erpStorage,
      partialize: (s) => ({ drafts: s.drafts, syncQueue: s.syncQueue }),
    },
  ),
)
