import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listCustomerCreditNotes } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { CustomerCreditNoteListItemDto, CustomerCreditNoteStatus } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { CREDIT_NOTE_STATUS_LABELS, creditNoteDisplayNumber, creditNoteStatusTone, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | CustomerCreditNoteStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function CreditNoteListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<CustomerCreditNoteListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | CustomerCreditNoteStatus>(
    (searchParams.get('status') as CustomerCreditNoteStatus) || '',
  )
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCustomerCreditNotes({
        legalEntityId: resolveLegalEntityId(),
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load credit notes')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    if (perms.canViewCreditNote) void load()
  }, [load, perms.canViewCreditNote])

  if (!perms.canViewCreditNote) {
    return (
      <MoneyInWorkspaceShell title="Credit Notes">
        <p className="text-[13px] text-erp-muted">You do not have permission to view credit notes.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Credit Notes"
      actions={
        mergeAllowedAction(perms.canCreateCreditNote) ? (
          <ErpButton variant="primary" icon={Plus} onClick={() => navigate('/accounting/money-in/credit-notes/new')}>
            New Credit Note
          </ErpButton>
        ) : null
      }
      commandBar={
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-9 min-w-[180px] text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as '' | CustomerCreditNoteStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input className="h-9 min-w-[200px] text-[12px]" placeholder="Search credit note / customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No credit notes match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Credit Note</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Purpose</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((note) => {
                const actions = note.allowedActions
                return (
                  <tr key={note.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link to={`/accounting/money-in/credit-notes/${note.id}`} className="font-medium text-erp-accent hover:underline">
                        {creditNoteDisplayNumber(note)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{note.customerNameSnapshot}</td>
                    <td className="py-2 pr-3 tabular-nums">{note.creditNoteDate}</td>
                    <td className="py-2 pr-3">{note.purpose.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3">
                      <ErpStatusChip label={CREDIT_NOTE_STATUS_LABELS[note.status]} tone={creditNoteStatusTone(note.status)} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(note.grandTotal))}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/credit-notes/${note.id}`)}>
                          View
                        </ErpButton>
                        {mergeAllowedAction(perms.canEditCreditNote, actions?.edit) && (
                          <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/credit-notes/${note.id}/edit`)}>
                            Edit
                          </ErpButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
