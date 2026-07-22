import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { mergeAllowedAction, useTreasuryTransferPermissions } from '@/utils/permissions/treasuryTransfer'
import { useTransferList } from '../hooks/useTransferList'
import { parseTransferListFilters, syncTransferListSearchParams } from '../utils/list-filters'
import { formatAccountLabel, formatTransferAmount, formatTransferDate } from '../utils/format'
import { TRANSFER_STATUS_OPTIONS, TRANSFER_TYPE_OPTIONS } from '../utils/treasuryTransferUi'
import { TransferStatusChip } from '../components/TransferStatusChip'
import { TransferTypeChip } from '../components/TransferTypeChip'
import { TransferWorkspaceShell } from '../components/TransferWorkspaceShell'
import type { TreasuryTransferDto, TreasuryTransferStatus } from '../api/treasury-transfer.types'

export function ApiTransferListPage({
  fixedStatus,
  title = 'Fund Transfers',
  description,
}: {
  fixedStatus?: TreasuryTransferStatus
  title?: string
  description?: string
}) {
  const navigate = useNavigate()
  const perms = useTreasuryTransferPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [status, setStatus] = useState(fixedStatus ?? (searchParams.get('status') as TreasuryTransferStatus | '') ?? '')
  const [transferType, setTransferType] = useState(searchParams.get('transferType') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const query = useMemo(
    () => ({
      ...parseTransferListFilters(searchParams, legalEntityId),
      page,
      ...(fixedStatus ? { status: fixedStatus } : status ? { status: status as TreasuryTransferStatus } : {}),
      ...(transferType ? { transferType: transferType as TreasuryTransferDto['transferType'] } : {}),
      ...(search ? { search } : {}),
    }),
    [searchParams, legalEntityId, page, fixedStatus, status, transferType, search],
  )

  const { items, total, loading, reload } = useTransferList(query, perms.canView)

  const syncUrl = useCallback(
    (next: { status?: string; transferType?: string; search?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams)
      syncTransferListSearchParams(params, {
        status: fixedStatus ? undefined : (next.status ?? status),
        transferType: next.transferType ?? transferType,
        search: next.search ?? search,
        page: next.page ?? page,
      })
      setSearchParams(params, { replace: true })
    },
    [fixedStatus, page, search, searchParams, setSearchParams, status, transferType],
  )

  if (!perms.canView) {
    return (
      <TransferWorkspaceShell title={title}>
        <p className="text-[13px] text-erp-muted">You do not have permission to view treasury transfers.</p>
      </TransferWorkspaceShell>
    )
  }

  return (
    <TransferWorkspaceShell
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canCreate, true) ? (
            <ErpButton icon={Plus} onClick={() => navigate('/accounting/bank-cash/transfers/new')}>
              New Transfer
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
            syncUrl({ search: v, page: 1 })
          }}
          placeholder="Transfer no, reference…"
          className="w-full max-w-xs"
          size="sm"
        />
        {!fixedStatus ? (
          <Select
            className="h-9 min-w-[170px] text-[12px]"
            value={status}
            aria-label="Status"
            onChange={(e) => {
              setStatus(e.target.value as TreasuryTransferStatus | '')
              setPage(1)
              syncUrl({ status: e.target.value, page: 1 })
            }}
          >
            {TRANSFER_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          className="h-9 min-w-[150px] text-[12px]"
          value={transferType}
          aria-label="Transfer type"
          onChange={(e) => {
            setTransferType(e.target.value)
            setPage(1)
            syncUrl({ transferType: e.target.value, page: 1 })
          }}
        >
          {TRANSFER_TYPE_OPTIONS.map((o) => (
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
          <p className="text-[13px] text-erp-muted">No transfers found.</p>
          {perms.canCreate && !fixedStatus ? (
            <ErpButton className="mt-3" icon={Plus} onClick={() => navigate('/accounting/bank-cash/transfers/new')}>
              New transfer
            </ErpButton>
          ) : null}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                className="w-full rounded-lg border border-erp-border bg-white p-3 text-left text-[12px] shadow-sm"
                onClick={() => navigate(`/accounting/bank-cash/transfers/${t.id}`)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-erp-primary">{t.transferNumber ?? t.draftReference}</span>
                  <TransferStatusChip status={t.status} />
                </div>
                <p className="mt-1 text-erp-muted">{formatTransferDate(t.transferDate)}</p>
                <p className="mt-1 font-medium text-erp-text">
                  {formatAccountLabel(t.sourceAccount)} → {formatAccountLabel(t.destinationAccount)}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <TransferTypeChip type={t.transferType} />
                  <span className="font-semibold tabular-nums">{formatTransferAmount(t.transferAmount)}</span>
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
                    <th className="px-2 py-1.5">Transfer No</th>
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">From</th>
                    <th className="px-2 py-1.5">To</th>
                    <th className="px-2 py-1.5">Type</th>
                    <th className="px-2 py-1.5 text-right">Amount</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                      <td className="px-2 py-1.5">
                        <TableLink to={`/accounting/bank-cash/transfers/${t.id}`}>{t.transferNumber ?? t.draftReference}</TableLink>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatTransferDate(t.transferDate)}</td>
                      <td className="px-2 py-1.5">{formatAccountLabel(t.sourceAccount)}</td>
                      <td className="px-2 py-1.5">{formatAccountLabel(t.destinationAccount)}</td>
                      <td className="px-2 py-1.5">
                        <TransferTypeChip type={t.transferType} />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatTransferAmount(t.transferAmount)}</td>
                      <td className="px-2 py-1.5">
                        <TransferStatusChip status={t.status} />
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
    </TransferWorkspaceShell>
  )
}
