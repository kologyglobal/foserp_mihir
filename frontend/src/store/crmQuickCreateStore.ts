import { create } from 'zustand'

export type CrmQuickCreateTarget =
  | 'lead'
  | 'customer'
  | 'opportunity'
  | 'rfq'
  | 'quotation'
  | 'follow_up'

interface CrmQuickCreateState {
  target: CrmQuickCreateTarget | null
  /** Optional prefills (e.g. customerId when opening opp from company). */
  context: { customerId?: string | null }
  openQuickCreate: (target: CrmQuickCreateTarget, context?: { customerId?: string | null }) => void
  closeQuickCreate: () => void
}

export const useCrmQuickCreateStore = create<CrmQuickCreateState>((set) => ({
  target: null,
  context: {},
  openQuickCreate: (target, context) => set({ target, context: context ?? {} }),
  closeQuickCreate: () => set({ target: null, context: {} }),
}))
