import { useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useAdjustmentDetail } from '../hooks/useAdjustmentDetail'
import { AdjustmentStatusChip } from '../components/AdjustmentStatusChip'
import { AdjustmentSummaryPanel } from '../components/AdjustmentSummaryPanel'
import { AdjustmentAccountingPreviewPanel } from '../components/AdjustmentAccountingPreviewPanel'
import { AdjustmentActionBar } from '../components/AdjustmentActionBar'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { formatAdjustmentDateTime } from '../utils/format'

export function ApiAdjustmentDetailPage() {
  const { id } = useParams()
  const perms = useTreasuryAdjustmentPermissions()
  const { adjustment, setAdjustment, loading, reload } = useAdjustmentDetail(id, perms.canView)

  if (!perms.canView) {
    return (
      <AdjustmentWorkspaceShell title="Treasury Adjustment">
        <p className="text-[13px] text-erp-muted">You do not have permission to view treasury adjustments.</p>
      </AdjustmentWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />

  if (!adjustment) {
    return (
      <AdjustmentWorkspaceShell title="Treasury Adjustment">
        <p className="text-[13px] text-erp-muted">Treasury adjustment not found.</p>
      </AdjustmentWorkspaceShell>
    )
  }

  return (
    <AdjustmentWorkspaceShell
      title={adjustment.adjustmentNumber ?? adjustment.draftReference}
      actions={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
          Refresh
        </ErpButton>
      }
    >
      <PageBackLink to="/accounting/bank-cash/treasury-adjustments" label="Back to treasury adjustments" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdjustmentStatusChip status={adjustment.status} />
        <span className="text-[12px] text-erp-muted">Updated {formatAdjustmentDateTime(adjustment.updatedAt)}</span>
        {adjustment.hasActiveReconciliationMatch ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Matched to bank statement line
          </span>
        ) : null}
      </div>

      <div className="mb-4">
        <AdjustmentActionBar adjustment={adjustment} onUpdated={setAdjustment} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AdjustmentSummaryPanel adjustment={adjustment} />
        </div>
        <div className="space-y-4">
          <AdjustmentAccountingPreviewPanel preview={adjustment.accountingPreview} />
          {adjustment.validation ? (
            <div className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Validation</h3>
              {adjustment.validation.isValid ? (
                <p className="text-[12px] text-emerald-600">No validation issues.</p>
              ) : (
                <ul className="space-y-1">
                  {adjustment.validation.errors.map((issue, i) => (
                    <li key={i} className="text-[12px] text-rose-600">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {adjustment.validation.warnings.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {adjustment.validation.warnings.map((issue, i) => (
                    <li key={i} className="text-[12px] text-amber-600">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AdjustmentWorkspaceShell>
  )
}
