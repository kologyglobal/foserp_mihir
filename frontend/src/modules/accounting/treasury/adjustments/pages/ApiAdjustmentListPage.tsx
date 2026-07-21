import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { notify } from '@/store/toastStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { mergeAllowedAction, useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { fetchAdjustments } from '../api/treasury-adjustment.api'
import type { ListTreasuryAdjustmentsQuery, TreasuryAdjustmentDto, TreasuryAdjustmentStatus, TreasuryAdjustmentType } from '../api/treasury-adjustment.types'
import { ADJUSTMENT_STATUS_OPTIONS, ADJUSTMENT_TYPE_LABELS, ADJUSTMENT_TYPE_OPTIONS, formatAdjustmentAmount, formatAdjustmentDate } from '../utils/format'
import { AdjustmentStatusChip } from '../components/AdjustmentStatusChip'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'

export function ApiAdjustmentListPage() {
  const navigate = useNavigate()
  const perms = useTreasuryAdjustmentPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [status, setStatus] = useState<TreasuryAdjustmentStatus | ''>((searchParams.get('status') as TreasuryAdjustmentStatus | '') || '')
  const [adjustmentType, setAdjustmentType] = useState<TreasuryAdjustmentType | ''>(
    (searchParams.get('type') as TreasuryAdjustmentType | '') || '',
  )
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const [items, setItems] = useState<TreasuryAdjustmentDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!perms.canView || !legalEntityId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const query: ListTreasuryAdjustmentsQuery = { legalEntityId, page, limit: 20 }
      if (status) query.status = status
      if (adjustmentType) query.adjustmentType = adjustmentType
      const res = await fetchAdjustments(query)
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load treasury adjustments')
    } finally {
      setLoading(false)
    }
  }, [perms.canView, legalEntityId, page, status, adjustmentType])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter(
      (a) =>
        a.draftReference.toLowerCase().includes(q) ||
        (a.adjustmentNumber ?? '').toLowerCase().includes(q) ||
        (a.narration ?? '').toLowerCase().includes(q),
    )
  }, [items, search])

  const syncUrl = useCallback(
    (next: { status?: string; type?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams)
      if (next.status !== undefined) {
        if (next.status) params.set('status', next.status)
        else params.delete('status')
      }
      if (next.type !== undefined) {
        if (next.type) params.set('type', next.type)
        else params.delete('type')
      }
      if (next.page !== undefined) params.set('page', String(next.page))
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  if (!perms.canView) {
    return (
      <AdjustmentWorkspaceShell title="Treasury Adjustments">
        <p className="text-[13px] text-erp-muted">You do not have permission to view treasury adjustments.</p>
      </AdjustmentWorkspaceShell>
    )
  }

  return (
    <AdjustmentWorkspaceShell
      title="Treasury Adjustments"
      actions={
        mergeAllowedAction(perms.canCreate, true) ? (
          <ErpButton icon={Plus} onClick={() => navigate('/accounting/bank-cash/treasury-adjustments/new')}>
            New Adjustment
          </ErpButton>
        ) : undefined
      }
    >
      <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-erp-border bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Adjustments (filtered)</p>
          <p className="mt-1 text-[18px] font-semibold text-erp-text">{total}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Reference, number, narrationâ€¦"
          className="w-full max-w-xs"
          size="sm"
        />
        <Select
          className="h-9 min-w-[170px] text-[12px]"
          value={status}
          aria-label="Status"
          onChange={(e) => {
            setStatus(e.target.value as TreasuryAdjustmentStatus | '')
            setPage(1)
            syncUrl({ status: e.target.value, page: 1 })
          }}
        >
          {ADJUSTMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          className="h-9 min-w-[190px] text-[12px]"
          value={adjustmentType}
          aria-label="Adjustment type"
          onChange={(e) => {
            setAdjustmentType(e.target.value as TreasuryAdjustmentType | '')
            setPage(1)
            syncUrl({ type: e.target.value, page: 1 })
          }}
        >
          <option value="">All types</option>
          {ADJUSTMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}

      {!loading && filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">No treasury adjustments found.</p>
          {perms.canCreate ? (
            <ErpButton className="mt-3" icon={Plus} onClick={() => navigate('/accounting/bank-cash/treasury-adjustments/new')}>
              New adjustment
            </ErpButton>
          ) : null}
        </div>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <EnterpriseRegisterTableShell>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                <th className="px-2 py-1.5">Reference</th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Source</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((a) => (
                <tr key={a.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                  <td className="px-2 py-1.5">
                    <TableLink to={`/accounting/bank-cash/treasury-adjustments/${a.id}`}>
                      {a.adjustmentNumber ?? a.draftReference}
                    </TableLink>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatAdjustmentDate(a.adjustmentDate)}</td>
                  <td className="px-2 py-1.5">{ADJUSTMENT_TYPE_LABELS[a.adjustmentType] ?? a.adjustmentType}</td>
                  <td className="px-2 py-1.5">{a.sourceMode === 'MANUAL' ? 'Manual' : a.sourceMode === 'BANK_STATEMENT' ? 'Statement' : 'Standing Instruction'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatAdjustmentAmount(a.bankAmount)}</td>
                  <td className="px-2 py-1.5">
                    <AdjustmentStatusChip status={a.status} />
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
            Page {page} Â· {total} total
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
    </AdjustmentWorkspaceShell>
  )
}
