import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrmTypedAttachment } from '../types/crmDocuments'
import { erpStorage } from './persistConfig'

interface QuotationAttachmentState {
  items: CrmTypedAttachment[]
  getForQuotation: (quotationId: string) => CrmTypedAttachment[]
  setForQuotation: (quotationId: string, attachments: CrmTypedAttachment[]) => void
  add: (attachment: CrmTypedAttachment) => void
  remove: (attachmentId: string) => void
  bindDraftToQuotation: (draftKey: string, quotationId: string) => void
}

export const useQuotationAttachmentStore = create<QuotationAttachmentState>()(
  persist(
    (set, get) => ({
      items: [],
      getForQuotation: (quotationId) => get().items.filter((a) => a.quotationId === quotationId),
      setForQuotation: (quotationId, attachments) => {
        set((state) => ({
          items: [
            ...state.items.filter((a) => a.quotationId !== quotationId),
            ...attachments.map((a) => ({ ...a, quotationId })),
          ],
        }))
      },
      add: (attachment) => set((state) => ({ items: [...state.items, attachment] })),
      remove: (attachmentId) => set((state) => ({ items: state.items.filter((a) => a.id !== attachmentId) })),
      bindDraftToQuotation: (draftKey, quotationId) => {
        set((state) => ({
          items: state.items.map((a) =>
            a.quotationId === draftKey ? { ...a, quotationId } : a,
          ),
        }))
      },
    }),
    {
      name: 'erp-quotation-attachments',
      storage: erpStorage,
    },
  ),
)
