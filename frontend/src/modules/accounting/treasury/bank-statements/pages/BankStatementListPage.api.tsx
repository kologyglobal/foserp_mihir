import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileUp, PenLine, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { mergeAllowedAction, useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import { fetchBankStatements, fetchTreasuryBankAccounts } from '../api/bank-statement.api'
import type { BankStatementListItem, BankStatementStatus, TreasuryAccountSummary } from '../api/bank-statement.types'
import { BankStatementStatusChip } from '../components/BankStatementStatusChip'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'
import { parseListFilters, syncListSearchParams } from '../utils/list-filters'
import { parseDecimal, STATEMENT_STATUS_LABELS } from '../utils/bankStatementUi'

const STATUS_OPTIONS: Array<{ value: '' | BankStatementStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(STATEMENT_STATUS_LABELS).map(([value, label]) => ({
    value: value as BankStatementStatus,
    label,
  })),
]

export function ApiBankStatementListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useTreasuryStatementPermissions()
  const [rows, setRows] = useState<BankStatementListItem[]>([])
  const [accounts, setAccounts] = useState<TreasuryAccountSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [status, setStatus] = useState<'' | BankStatementStatus>((searchParams.get('status') as BankStatementStatus) || '')
  const [treasuryAccountId, setTreasuryAccountId] = useState(searchParams.get('treasuryAccountId') || '')
  const [loading, setLoading] = useState(true)

  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const syncUrl = useCallback(
    (next: { status?: string; treasuryAccountId?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams)
      syncListSearchParams(params, {
        status: next.status ?? status,
        treasuryAccountId: next.treasuryAccountId ?? treasuryAccountId,
        page: next.page ?? page,
      })
      setSearchParams(params, { replace: true })
    },
    [page, searchParams, setSearchParams, status, treasuryAccountId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, accts] = await Promise.all([
        fetchBankStatements(parseListFilters(searchParams, legalEntityId)),
        accounts.length ? Promise.resolve({ items: accounts }) : fetchTreasuryBankAccounts(legalEntityId),
      ])
      setRows(list.items)
      setTotal(list.total)
      if (!accounts.length) setAccounts(accts.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load bank statements')
    } finally {
      setLoading(false)
    }
  }, [accounts.length, legalEntityId, searchParams])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const accountLabel = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, `${a.code} — ${a.name}`]))
    return (id: string) => map.get(id) ?? id.slice(0, 8)
  }, [accounts])

  if (!perms.canView) {
    return (
      <BankStatementWorkspaceShell title="Bank Statements">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank statements.</p>
      </BankStatementWorkspaceShell>
    )
  }

  return (
    <BankStatementWorkspaceShell
      title="Bank Statements"
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canImport, true) ? (
            <ErpButton icon={FileUp} onClick={() => navigate('/accounting/bank-cash/statements/import')}>
              Import
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canManualEntry, true) ? (
            <ErpButton variant="secondary" icon={PenLine} onClick={() => navigate('/accounting/bank-cash/statements/manual')}>
              Manual
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canViewMapping, true) ? (
            <ErpButton variant="secondary" icon={Settings2} onClick={() => navigate('/accounting/bank-cash/mapping-templates')}>
              Mapping Templates
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Select
          className="h-9 min-w-[180px] text-[12px]"
          value={treasuryAccountId}
          aria-label="Bank account"
          onChange={(e) => {
            setTreasuryAccountId(e.target.value)
            setPage(1)
            syncUrl({ treasuryAccountId: e.target.value, page: 1 })
          }}
        >
          <option value="">All bank accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
        <Select
          className="h-9 min-w-[160px] text-[12px]"
          value={status}
          aria-label="Status"
          onChange={(e) => {
            setStatus(e.target.value as '' | BankStatementStatus)
            setPage(1)
            syncUrl({ status: e.target.value, page: 1 })
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}

      {!loading && rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">No bank statements yet.</p>
          {perms.canImport ? (
            <ErpButton className="mt-3" icon={Plus} onClick={() => navigate('/accounting/bank-cash/statements/import')}>
              Import first statement
            </ErpButton>
          ) : null}
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <EnterpriseRegisterTableShell>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                <th className="px-2 py-1.5">Reference</th>
                <th className="px-2 py-1.5">Account</th>
                <th className="px-2 py-1.5">Period</th>
                <th className="px-2 py-1.5 text-right">Closing</th>
                <th className="px-2 py-1.5">Lines</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                  <td className="px-2 py-1.5">
                    <TableLink to={`/accounting/bank-cash/statements/${row.id}`}>{row.statementReference}</TableLink>
                  </td>
                  <td className="px-2 py-1.5">{accountLabel(row.treasuryAccountId)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {formatDate(row.periodStartDate)} – {formatDate(row.periodEndDate)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(parseDecimal(row.closingBalance))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{row.lineCount}</td>
                  <td className="px-2 py-1.5">
                    <BankStatementStatusChip status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EnterpriseRegisterTableShell>
      ) : null}

      {!loading && total > 20 ? (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="text-erp-muted">
            Page {page} · {total} total
          </span>
          <div className="flex gap-2">
            <ErpButton
              variant="secondary"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1)
                syncUrl({ page: page - 1 })
              }}
            >
              Previous
            </ErpButton>
            <ErpButton
              variant="secondary"
              disabled={page * 20 >= total}
              onClick={() => {
                setPage((p) => p + 1)
                syncUrl({ page: page + 1 })
              }}
            >
              Next
            </ErpButton>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] text-erp-muted">
        Matching and reconciliation workbench remain preview — use validated statements as the source for future matching (Phase 5B).
      </p>
    </BankStatementWorkspaceShell>
  )
}
