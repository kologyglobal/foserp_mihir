import { useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useTreasuryChequePermissions } from '@/utils/permissions/treasuryCheque'
import { useChequeDetail } from '../hooks/useChequeDetail'
import { ChequeStatusChip } from '../components/ChequeStatusChip'
import { ChequeSummaryPanel } from '../components/ChequeSummaryPanel'
import { ChequeValidationPanel } from '../components/ChequeValidationPanel'
import { ChequeAccountingPreviewPanel } from '../components/ChequeAccountingPreviewPanel'
import { ChequeTimeline } from '../components/ChequeTimeline'
import { ChequeActionBar } from '../components/ChequeActionBar'
import { ChequeWorkspaceShell } from '../components/ChequeWorkspaceShell'
import { formatChequeDateTime } from '../utils/format'

export function ApiChequeDetailPage() {
  const { id } = useParams()
  const perms = useTreasuryChequePermissions()
  const { cheque, setCheque, loading, reload } = useChequeDetail(id, perms.canView)

  if (!perms.canView) {
    return (
      <ChequeWorkspaceShell title="Cheque">
        <p className="text-[13px] text-erp-muted">You do not have permission to view treasury cheques.</p>
      </ChequeWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />

  if (!cheque) {
    return (
      <ChequeWorkspaceShell title="Cheque">
        <p className="text-[13px] text-erp-muted">Cheque not found.</p>
      </ChequeWorkspaceShell>
    )
  }

  return (
    <ChequeWorkspaceShell
      title={cheque.chequeRegisterNumber ?? cheque.chequeNumber}
      actions={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
          Refresh
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/cheques" label="Back to cheques" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ChequeStatusChip status={cheque.status} />
        <span className="text-[12px] text-erp-muted">Updated {formatChequeDateTime(cheque.updatedAt)}</span>
      </div>

      <div className="mb-4">
        <ChequeActionBar cheque={cheque} onUpdated={setCheque} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ChequeSummaryPanel cheque={cheque} />
          <ChequeAccountingPreviewPanel preview={cheque.accountingPreview} />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Validation</h3>
            <ChequeValidationPanel snapshot={cheque.validation} />
          </div>
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Timeline</h3>
            <ChequeTimeline cheque={cheque} />
          </div>
        </div>
      </div>
    </ChequeWorkspaceShell>
  )
}
