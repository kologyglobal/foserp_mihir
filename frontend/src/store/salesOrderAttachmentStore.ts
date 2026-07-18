import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrmTypedAttachment } from '../types/crmDocuments'
import { erpStorage } from './persistConfig'

export type SalesOrderTypedAttachment = CrmTypedAttachment & {
  salesOrderId: string
}

interface SalesOrderAttachmentState {
  items: SalesOrderTypedAttachment[]
  getForSalesOrder: (salesOrderId: string) => SalesOrderTypedAttachment[]
  add: (attachment: SalesOrderTypedAttachment) => void
  remove: (attachmentId: string) => void
}

export const useSalesOrderAttachmentStore = create<SalesOrderAttachmentState>()(
  persist(
    (set, get) => ({
      items: [],
      getForSalesOrder: (salesOrderId) => get().items.filter((a) => a.salesOrderId === salesOrderId),
      add: (attachment) => set((state) => ({ items: [...state.items, attachment] })),
      remove: (attachmentId) =>
        set((state) => ({ items: state.items.filter((a) => a.id !== attachmentId) })),
    }),
    {
      name: 'erp-sales-order-attachments',
      storage: erpStorage,
    },
  ),
)
