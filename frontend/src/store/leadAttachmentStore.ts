import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrmTypedAttachment } from '../types/crmDocuments'
import { erpStorage } from './persistConfig'

interface LeadAttachmentState {
  items: CrmTypedAttachment[]
  getForLead: (leadId: string) => CrmTypedAttachment[]
  setForLead: (leadId: string, attachments: CrmTypedAttachment[]) => void
  add: (attachment: CrmTypedAttachment) => void
  remove: (attachmentId: string) => void
  bindDraftToLead: (draftKey: string, leadId: string) => void
}

export const useLeadAttachmentStore = create<LeadAttachmentState>()(
  persist(
    (set, get) => ({
      items: [],
      getForLead: (leadId) => get().items.filter((a) => a.leadId === leadId),
      setForLead: (leadId, attachments) => {
        set((state) => ({
          items: [
            ...state.items.filter((a) => a.leadId !== leadId),
            ...attachments.map((a) => ({ ...a, leadId })),
          ],
        }))
      },
      add: (attachment) => set((state) => ({ items: [...state.items, attachment] })),
      remove: (attachmentId) => set((state) => ({ items: state.items.filter((a) => a.id !== attachmentId) })),
      bindDraftToLead: (draftKey, leadId) => {
        set((state) => ({
          items: state.items.map((a) =>
            a.leadId === draftKey ? { ...a, leadId } : a,
          ),
        }))
      },
    }),
    {
      name: 'erp-lead-attachments',
      storage: erpStorage,
    },
  ),
)
