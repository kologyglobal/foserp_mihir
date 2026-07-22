import { useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useTreasuryAccountOptions } from '../../transfers/hooks/useTreasuryAccountOptions'
import { downloadBankbookCsv, downloadCashbookCsv } from '../api/treasury-books.api'
import { useBook } from '../hooks/useBook'
import { BookTable } from '../components/BookTable'
import { BookWorkspaceShell } from '../components/BookWorkspaceShell'
import { formatBookAmount, firstOfMonthIsoDate, todayIsoDate } from '../utils/format'

/** Shared bankbook/cashbook read-only ledger page — identical UX, differs only by treasury account type + export endpoint. */
export function ApiBookPage({ kind }: { kind: 'bank' | 'cash' }) {
  const perms = useTreasuryAdjustmentPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts: allAccounts, loading: accountsLoading } = useTreasuryAccountOptions(legalEntityId)
  const accounts = useMemo(
    () => allAccounts.filter((a) => a.accountType === (kind === 'bank' ? 'BANK' : 'CASH')),
    [allAccounts, kind],
  )
  const [treasuryAccountId, setTreasuryAccountId] = useState('')
  const [dateFrom, setDateFrom] = useState(firstOfMonthIsoDate())
  const [dateTo, setDateTo] = useState(todayIsoDate())
  const [exporting, setExporting] = useState(false)

  const query = useMemo(
    () => (treasuryAccountId ? { legalEntityId, treasuryAccountId, dateFrom, dateTo, limit: 200 } : null),
    [legalEntityId, treasuryAccountId, dateFrom, dateTo],
  )
  const { result, loading, reload } = useBook(kind, query, perms.canViewBooks)

  if (!perms.canViewBooks) {
    return (
      <BookWorkspaceShell kind={kind} title={kind === 'bank' ? 'Bankbook' : 'Cashbook'}>
        <p className="text-[13px] text-erp-muted">You do not have permission to view this book.</p>
      </BookWorkspaceShell>
    )
  }

  const exportCsv = async () => {
    if (!query) return
    setExporting(true)
    try {
      const { blob, filename } = kind === 'bank' ? await downloadBankbookCsv(query) : await downloadCashbookCsv(query)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename ?? `${kind}book-${dateFrom}-${dateTo}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <BookWorkspaceShell
      kind={kind}
      title={kind === 'bank' ? 'Bankbook' : 'Cashbook'}
      actions={
        <>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()} disabled={!treasuryAccountId}>
            Refresh
          </ErpButton>
          <ErpButton variant="secondary" icon={Download} loading={exporting} onClick={() => void exportCsv()} disabled={!treasuryAccountId}>
            Export CSV
          </ErpButton>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
            {kind === 'bank' ? 'Bank account' : 'Cash account'}
          </label>
          <Select
            className="h-9 min-w-[220px] text-[12px]"
            value={treasuryAccountId}
            disabled={accountsLoading}
            onChange={(e) => setTreasuryAccountId(e.target.value)}
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">From</label>
          <Input type="date" className="h-9 text-[12px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">To</label>
          <Input type="date" className="h-9 text-[12px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {!treasuryAccountId ? (
        <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">Select {kind === 'bank' ? 'a bank account' : 'a cash account'} to view its ledger.</p>
        </div>
      ) : null}

      {treasuryAccountId && loading ? <LoadingState variant="table" rows={6} /> : null}

      {treasuryAccountId && !loading && result ? (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-[12px]">
            <span className="text-erp-muted">
              Opening balance: <strong className="text-erp-text">{formatBookAmount(result.openingBalance)}</strong>
            </span>
            <span className="text-erp-muted">
              Closing balance: <strong className="text-erp-text">{formatBookAmount(result.closingBalance)}</strong>
            </span>
            <span className="text-erp-muted">{result.total} entries</span>
          </div>
          <BookTable result={result} />
        </>
      ) : null}
    </BookWorkspaceShell>
  )
}
