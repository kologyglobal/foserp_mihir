import type { LucideIcon } from 'lucide-react'
import { FileText, ListTree } from 'lucide-react'
import {
  PurchaseDocumentWorkspaceTabs,
  type DocumentWorkspaceTabModel,
  type DocumentWorkspaceTabStatus,
} from '@/components/purchase/PurchaseDocumentWorkspaceTabs'

export type ReceiptWorkspaceId = 'information' | 'allocation'

export type ReceiptWorkspaceTabModel = DocumentWorkspaceTabModel<ReceiptWorkspaceId>

export function deriveReceiptWorkspaceTabs(opts: {
  infoStatus: DocumentWorkspaceTabStatus
  infoDetail: string
  allocationStatus: DocumentWorkspaceTabStatus
  allocationDetail: string
}): ReceiptWorkspaceTabModel[] {
  return [
    {
      id: 'information',
      label: 'Receipt Information',
      icon: FileText as LucideIcon,
      status: opts.infoStatus,
      statusDetail: opts.infoDetail,
    },
    {
      id: 'allocation',
      label: 'Invoice Allocation',
      icon: ListTree as LucideIcon,
      status: opts.allocationStatus,
      statusDetail: opts.allocationDetail,
    },
  ]
}

export function ReceiptWorkspaceTabs({
  active,
  onChange,
  tabs,
}: {
  active: ReceiptWorkspaceId
  onChange: (id: ReceiptWorkspaceId) => void
  tabs: ReceiptWorkspaceTabModel[]
}) {
  return (
    <PurchaseDocumentWorkspaceTabs
      active={active}
      onChange={onChange}
      tabs={tabs}
      ariaLabel="Receipt workspaces"
      idPrefix="receipt"
    />
  )
}
