import { useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useTreasuryTransferPermissions } from '@/utils/permissions/treasuryTransfer'
import { useTransferDetail } from '../hooks/useTransferDetail'
import { TransferStatusChip } from '../components/TransferStatusChip'
import { TransferSummaryPanel } from '../components/TransferSummaryPanel'
import { TransferValidationPanel } from '../components/TransferValidationPanel'
import { TransferAccountingPreviewPanel } from '../components/TransferAccountingPreviewPanel'
import { TransferTimeline } from '../components/TransferTimeline'
import { TransferActionBar } from '../components/TransferActionBar'
import { TransferWorkspaceShell } from '../components/TransferWorkspaceShell'
import { formatTransferDateTime } from '../utils/format'

export function ApiTransferDetailPage() {
  const { id } = useParams()
  const perms = useTreasuryTransferPermissions()
  const { transfer, setTransfer, loading, reload } = useTransferDetail(id, perms.canView)

  if (!perms.canView) {
    return (
      <TransferWorkspaceShell title="Transfer">
        <p className="text-[13px] text-erp-muted">You do not have permission to view treasury transfers.</p>
      </TransferWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />

  if (!transfer) {
    return (
      <TransferWorkspaceShell title="Transfer">
        <p className="text-[13px] text-erp-muted">Transfer not found.</p>
      </TransferWorkspaceShell>
    )
  }

  return (
    <TransferWorkspaceShell
      title={transfer.transferNumber ?? transfer.draftReference}
      actions={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
          Refresh
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/transfers" label="Back to transfers" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TransferStatusChip status={transfer.status} />
        <span className="text-[12px] text-erp-muted">Updated {formatTransferDateTime(transfer.updatedAt)}</span>
      </div>

      <div className="mb-4">
        <TransferActionBar transfer={transfer} onUpdated={setTransfer} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransferSummaryPanel transfer={transfer} />
          <TransferAccountingPreviewPanel preview={transfer.accountingPreviewSnapshot} />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Validation</h3>
            <TransferValidationPanel snapshot={transfer.validationSnapshot} />
          </div>
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Timeline</h3>
            <TransferTimeline transfer={transfer} />
          </div>
        </div>
      </div>
    </TransferWorkspaceShell>
  )
}
