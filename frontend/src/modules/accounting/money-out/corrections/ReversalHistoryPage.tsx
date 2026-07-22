import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listApReversalHistory } from '@/services/bridges/payablesApiBridge'
import type { ApReversalHistoryRow } from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { AP_REVERSAL_TYPE_LABELS } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function ReversalHistoryPage() {
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<ApReversalHistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!perms.canViewCorrections || !isApiMode()) {
      setLoading(false)
      return
    }
    listApReversalHistory()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [perms.canViewCorrections])

  if (!perms.canViewCorrections) {
    return (
      <MoneyOutWorkspaceShell title="Reversal History">
        <p className="text-[13px] text-erp-muted">You do not have permission to view reversal history.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell title="Reversal History">
      <p className="mb-3 text-[12px] text-erp-muted">
        <Link to="/accounting/money-out/corrections" className="text-erp-accent hover:underline">
          ← Corrections workspace
        </Link>
      </p>

      {loading ? (
        <LoadingState variant="card" />
      ) : rows.length === 0 ? (
        <div className="rounded border border-erp-border bg-slate-50 p-4 text-[13px] text-erp-muted">
          No reversal history is available yet. The backend history list endpoint is not wired — reversals are recorded on each document and allocation batch.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Document</th>
                <th className="py-2 pr-3 font-medium">Reversal date</th>
                <th className="py-2 pr-3 font-medium">Reason</th>
                <th className="py-2 font-medium">Voucher</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/60">
                  <td className="py-2 pr-3">{AP_REVERSAL_TYPE_LABELS[row.documentType] ?? row.documentType}</td>
                  <td className="py-2 pr-3">{row.documentNumber ?? row.documentId}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.reversalDate}</td>
                  <td className="py-2 pr-3">{row.reason}</td>
                  <td className="py-2">{row.reversalVoucherNumber ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
