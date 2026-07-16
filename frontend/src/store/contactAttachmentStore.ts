import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrmTypedAttachment } from '../types/crmDocuments'
import { erpStorage } from './persistConfig'

interface ContactAttachmentState {
  items: CrmTypedAttachment[]
  getForContact: (contactId: string) => CrmTypedAttachment[]
  setForContact: (contactId: string, attachments: CrmTypedAttachment[]) => void
  add: (attachment: CrmTypedAttachment) => void
  remove: (attachmentId: string) => void
  bindDraftToContact: (draftKey: string, contactId: string) => void
}

export const useContactAttachmentStore = create<ContactAttachmentState>()(
  persist(
    (set, get) => ({
      items: [],
      getForContact: (contactId) => get().items.filter((a) => a.contactId === contactId),
      setForContact: (contactId, attachments) => {
        set((state) => ({
          items: [
            ...state.items.filter((a) => a.contactId !== contactId),
            ...attachments.map((a) => ({ ...a, contactId })),
          ],
        }))
      },
      add: (attachment) => set((state) => ({ items: [...state.items, attachment] })),
      remove: (attachmentId) => set((state) => ({ items: state.items.filter((a) => a.id !== attachmentId) })),
      bindDraftToContact: (draftKey, contactId) => {
        set((state) => ({
          items: state.items.map((a) =>
            a.contactId === draftKey ? { ...a, contactId } : a,
          ),
        }))
      },
    }),
    {
      name: 'erp-contact-attachments',
      storage: erpStorage,
    },
  ),
)
