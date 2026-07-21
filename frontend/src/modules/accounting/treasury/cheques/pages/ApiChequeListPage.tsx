import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { mergeAllowedAction, useTreasuryChequePermissions } from '@/utils/permissions/treasuryCheque'
import { useChequeList } from '../hooks/useChequeList'
import { useChequeOverviewCounts } from '../hooks/useChequeOverviewCounts'
import { parseChequeListFilters, syncChequeListSearchParams } from '../utils/list-filters'
import { formatChequeAmount, formatChequeDate } from '../utils/format'
import { CHEQUE_DIRECTION_OPTIONS, CHEQUE_STATUS_OPTIONS } from '../utils/treasuryChequeUi'
import { ChequeDirectionChip, ChequeStatusChip } from '../components/ChequeStatusChip'
import { ChequeWorkspaceShell } from '../components/ChequeWorkspaceShell'
import type { TreasuryChequeStatus } from '../api/treasury-cheque.types'

export function ApiChequeListPage() {
  const navigate = useNavigate()
  const perms = useTreasuryChequePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [status, setStatus] = useState((searchParams.get('status') as TreasuryChequeStatus | '') || '')
  const [direction, setDirection] = useState(searchParams.get('direction') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const query = useMemo(
    () => ({
      ...parseChequeListFilters(searchParams, legalEntityId),
      page,
      ...(status ? { status: status as TreasuryChequeStatus } : {}),
      ...(direction ? { direction: direction as 'ISSUED' | 'RECEIVED' } : {}),
      ...(search ? { search } : {}),
    }),
    [searchParams, legalEntityId, page, status, direction, search],
  )

  const { items, total, loading, reload } = useChequeList(query, perms.canView)
  const { counts } = useChequeOverviewCounts(legalEntityId, perms.canView)

  const kpis: EnterpriseKpiItem[] = useMemo(
    () => [
      { id: 'total', label: 'Cheques (filtered)', value: total, accent: 'blue' },
      { id: 'pdc', label: 'PDC', value: counts.pdc, accent: 'amber' },
      { id: 'pending', label: 'Awaiting clearance', value: counts.postedAwaitingClearance, accent: 'amber' },
      { id: 'bounced', label: 'Bounced', value: counts.bounced, accent: counts.bounced > 0 ? 'red' : 'slate' },
    ],
    [total, counts],
  )

  const syncUrl = useCallback(
    (next: { status?: string; direction?: string; search?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams)
      syncChequeListSearchParams(params, {
        status: next.status ?? status,
        direction: next.direction ?? direction,
        search: next.search ?? search,
        page: next.page ?? page,
      })
      setSearchParams(params, { replace: true })
    },
    [direction, page, search, searchParams, setSearchParams, status],
  )

  if (!perms.canView) {
    return (
      <ChequeWorkspaceShell title="Cheques">
        <p className="text-[13px] text-erp-muted">You do not have permission to view treasury cheques.</p>
      </ChequeWorkspaceShell>
    )
  }

  return (
    <ChequeWorkspaceShell
      title="Cheques"
      actions={
        mergeAllowedAction(perms.canCreate, true) ? (
          <ErpButton icon={Plus} onClick={() => navigate('/accounting/bank-cash/cheques/new')}>
            New Cheque
          </ErpButton>
        ) : undefined
      }
    >
      <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.id} className="rounded-lg border border-erp-border bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{k.label}</p>
            <p className="mt-1 text-[18px] font-semibold text-erp-text">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
            syncUrl({ search: v, page: 1 })
          }}
          placeholder="Cheque no, payee/drawer…"
          className="w-full max-w-xs"
          size="sm"
        />
        <Select
          className="h-9 min-w-[170px] text-[12px]"
          value={status}
          aria-label="Status"
          onChange={(e) => {
            setStatus(e.target.value as TreasuryChequeStatus | '')
            setPage(1)
            syncUrl({ status: e.target.value, page: 1 })
          }}
        >
          {CHEQUE_STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          className="h-9 min-w-[160px] text-[12px]"
          value={direction}
          aria-label="Direction"
          onChange={(e) => {
            setDirection(e.target.value)
            setPage(1)
            syncUrl({ direction: e.target.value, page: 1 })
          }}
        >
          {CHEQUE_DIRECTION_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
          Refresh
        </ErpButton>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">No cheques found.</p>
          {perms.canCreate ? (
            <ErpButton className="mt-3" icon={Plus} onClick={() => navigate('/accounting/bank-cash/cheques/new')}>
              New cheque
            </ErpButton>
          ) : null}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full rounded-lg border border-erp-border bg-white p-3 text-left text-[12px] shadow-sm"
                onClick={() => navigate(`/accounting/bank-cash/cheques/${c.id}`)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-erp-primary">{c.chequeRegisterNumber ?? c.chequeNumber}</span>
                  <ChequeStatusChip status={c.status} />
                </div>
                <p className="mt-1 text-erp-muted">{formatChequeDate(c.chequeDate)}</p>
                <p className="mt-1 font-medium text-erp-text">{c.payeeOrDrawerName}</p>
                <div className="mt-2 flex items-center justify-between">
                  <ChequeDirectionChip direction={c.direction} />
                  <span className="font-semibold tabular-nums">{formatChequeAmount(c.amount)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <EnterpriseRegisterTableShell>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                    <th className="px-2 py-1.5">Cheque No</th>
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">Direction</th>
                    <th className="px-2 py-1.5">Payee / Drawer</th>
                    <th className="px-2 py-1.5">PDC / Maturity</th>
                    <th className="px-2 py-1.5 text-right">Amount</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                      <td className="px-2 py-1.5">
                        <TableLink to={`/accounting/bank-cash/cheques/${c.id}`}>{c.chequeRegisterNumber ?? c.chequeNumber}</TableLink>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatChequeDate(c.chequeDate)}</td>
                      <td className="px-2 py-1.5">
                        <ChequeDirectionChip direction={c.direction} />
                      </td>
                      <td className="px-2 py-1.5">{c.payeeOrDrawerName}</td>
                      <td className="px-2 py-1.5">{c.isPdc ? formatChequeDate(c.pdcMaturityDate) : '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatChequeAmount(c.amount)}</td>
                      <td className="px-2 py-1.5">
                        <ChequeStatusChip status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </EnterpriseRegisterTableShell>
          </div>
        </>
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
    </ChequeWorkspaceShell>
  )
}
