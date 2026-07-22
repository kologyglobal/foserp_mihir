import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw, Zap } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { mergeAllowedAction, useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useStandingInstructionList } from '../hooks/useStandingInstructionList'
import { parseSiListFilters, syncSiListSearchParams } from '../utils/list-filters'
import { formatSiAmount, formatSiDate } from '../utils/format'
import { ADJUSTMENT_TYPE_LABELS, SI_FREQUENCY_LABELS, SI_STATUS_OPTIONS } from '../utils/standingInstructionUi'
import { SIStatusChip } from '../components/SIStatusChip'
import { SIWorkspaceShell } from '../components/SIWorkspaceShell'
import { SIGenerateDraftsModal } from '../components/SIGenerateDraftsModal'
import type { StandingInstructionStatus } from '../api/standing-instruction.types'

export function ApiSIListPage() {
  const navigate = useNavigate()
  const perms = useTreasuryAdjustmentPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [status, setStatus] = useState((searchParams.get('status') as StandingInstructionStatus | '') || '')
  const [generateOpen, setGenerateOpen] = useState(false)

  const query = useMemo(
    () => ({
      ...parseSiListFilters(searchParams, legalEntityId),
      page,
      ...(status ? { status: status as StandingInstructionStatus } : {}),
    }),
    [searchParams, legalEntityId, page, status],
  )

  const { items, total, loading, reload } = useStandingInstructionList(query, perms.canViewStandingInstructions)

  const syncUrl = useCallback(
    (next: { status?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams)
      syncSiListSearchParams(params, { status: next.status ?? status, page: next.page ?? page })
      setSearchParams(params, { replace: true })
    },
    [page, searchParams, setSearchParams, status],
  )

  if (!perms.canViewStandingInstructions) {
    return (
      <SIWorkspaceShell title="Standing Instructions">
        <p className="text-[13px] text-erp-muted">You do not have permission to view standing instructions.</p>
      </SIWorkspaceShell>
    )
  }

  return (
    <SIWorkspaceShell
      title="Standing Instructions"
      actions={
        <>
          {mergeAllowedAction(perms.canGenerateStandingInstructions, true) ? (
            <ErpButton variant="secondary" icon={Zap} onClick={() => setGenerateOpen(true)}>
              Generate due drafts
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canManageStandingInstructions, true) ? (
            <ErpButton icon={Plus} onClick={() => navigate('/accounting/bank-cash/standing-instructions/new')}>
              New Standing Instruction
            </ErpButton>
          ) : null}
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Select
          className="h-9 min-w-[170px] text-[12px]"
          value={status}
          aria-label="Status"
          onChange={(e) => {
            setStatus(e.target.value as StandingInstructionStatus | '')
            setPage(1)
            syncUrl({ status: e.target.value, page: 1 })
          }}
        >
          {SI_STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
          Refresh
        </ErpButton>
      </div>

      {loading ? <LoadingState variant="table" rows={6} /> : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">No standing instructions found.</p>
          {mergeAllowedAction(perms.canManageStandingInstructions, true) ? (
            <ErpButton className="mt-3" icon={Plus} onClick={() => navigate('/accounting/bank-cash/standing-instructions/new')}>
              New standing instruction
            </ErpButton>
          ) : null}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="hidden md:block">
          <EnterpriseRegisterTableShell>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Type</th>
                  <th className="px-2 py-1.5">Frequency</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                  <th className="px-2 py-1.5">Next due</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((si) => (
                  <tr key={si.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                    <td className="px-2 py-1.5">
                      <TableLink to={`/accounting/bank-cash/standing-instructions/${si.id}`}>{si.name}</TableLink>
                    </td>
                    <td className="px-2 py-1.5">{ADJUSTMENT_TYPE_LABELS[si.adjustmentType] ?? si.adjustmentType}</td>
                    <td className="px-2 py-1.5">{SI_FREQUENCY_LABELS[si.frequency] ?? si.frequency}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {si.amountMode === 'FIXED' ? formatSiAmount(si.fixedAmount) : 'Variable'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatSiDate(si.nextDueDate)}</td>
                    <td className="px-2 py-1.5">
                      <SIStatusChip status={si.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </div>
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

      <SIGenerateDraftsModal
        open={generateOpen}
        legalEntityId={legalEntityId}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => void reload()}
      />
    </SIWorkspaceShell>
  )
}
