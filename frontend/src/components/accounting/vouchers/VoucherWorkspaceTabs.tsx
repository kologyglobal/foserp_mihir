import type { LucideIcon } from 'lucide-react'
import { FileText, ListTree } from 'lucide-react'
import {
  PurchaseDocumentWorkspaceTabs,
  type DocumentWorkspaceTabModel,
  type DocumentWorkspaceTabStatus,
} from '@/components/purchase/PurchaseDocumentWorkspaceTabs'
import type { VoucherWorkspaceId } from '@/types/vouchers'

export type VoucherWorkspaceTabModel = DocumentWorkspaceTabModel<VoucherWorkspaceId>

export function deriveVoucherWorkspaceTabs(opts: {
  infoStatus: DocumentWorkspaceTabStatus
  infoDetail: string
  entriesStatus: DocumentWorkspaceTabStatus
  entriesDetail: string
}): VoucherWorkspaceTabModel[] {
  return [
    {
      id: 'information',
      label: 'Voucher Information',
      icon: FileText as LucideIcon,
      status: opts.infoStatus,
      statusDetail: opts.infoDetail,
    },
    {
      id: 'entries',
      label: 'Accounting Entries',
      icon: ListTree as LucideIcon,
      status: opts.entriesStatus,
      statusDetail: opts.entriesDetail,
    },
  ]
}

export function VoucherWorkspaceTabs({
  active,
  onChange,
  tabs,
}: {
  active: VoucherWorkspaceId
  onChange: (id: VoucherWorkspaceId) => void
  tabs: VoucherWorkspaceTabModel[]
}) {
  return (
    <PurchaseDocumentWorkspaceTabs
      active={active}
      onChange={onChange}
      tabs={tabs}
      ariaLabel="Voucher workspaces"
      idPrefix="voucher"
    />
  )
}
