import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrmTypedAttachment } from '../types/crmDocuments'
import { erpStorage } from './persistConfig'

interface OpportunityAttachmentState {
  items: CrmTypedAttachment[]
  getForOpportunity: (opportunityId: string) => CrmTypedAttachment[]
  setForOpportunity: (opportunityId: string, attachments: CrmTypedAttachment[]) => void
  add: (attachment: CrmTypedAttachment) => void
  remove: (attachmentId: string) => void
  bindDraftToOpportunity: (draftKey: string, opportunityId: string) => void
}

export const useOpportunityAttachmentStore = create<OpportunityAttachmentState>()(
  persist(
    (set, get) => ({
      items: [],
      getForOpportunity: (opportunityId) => get().items.filter((a) => a.opportunityId === opportunityId),
      setForOpportunity: (opportunityId, attachments) => {
        set((state) => ({
          items: [
            ...state.items.filter((a) => a.opportunityId !== opportunityId),
            ...attachments.map((a) => ({ ...a, opportunityId })),
          ],
        }))
      },
      add: (attachment) => set((state) => ({ items: [...state.items, attachment] })),
      remove: (attachmentId) => set((state) => ({ items: state.items.filter((a) => a.id !== attachmentId) })),
      bindDraftToOpportunity: (draftKey, opportunityId) => {
        set((state) => ({
          items: state.items.map((a) =>
            a.opportunityId === draftKey ? { ...a, opportunityId } : a,
          ),
        }))
      },
    }),
    {
      name: 'erp-opportunity-attachments',
      storage: erpStorage,
    },
  ),
)
