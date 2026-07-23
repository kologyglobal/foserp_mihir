import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listCustomerReceipts } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { CustomerReceiptListItemDto, CustomerReceiptStatus } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { RECEIPT_STATUS_LABELS, receiptDisplayNumber, receiptStatusTone, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | CustomerReceiptStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function ReceiptListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<CustomerReceiptListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | CustomerReceiptStatus>(
    (searchParams.get('status') as CustomerReceiptStatus) || '',
  )
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCustomerReceipts({
        legalEntityId: resolveLegalEntityId(),
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load receipts')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    if (perms.canViewReceipt) void load()
  }, [load, perms.canViewReceipt])

  if (!perms.canViewReceipt) {
    return (
      <MoneyInWorkspaceShell title="Receipts">
        <p className="text-[13px] text-erp-muted">You do not have permission to view customer receipts.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Receipts"
      commandBar={
        <div className="flex flex-nowrap items-center gap-2">
          <Select className="h-9 min-w-[160px] text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as '' | CustomerReceiptStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input className="h-9 w-[200px] text-[12px]" placeholder="Search receipt / customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          {mergeAllowedAction(perms.canCreateReceipt) ? (
            <ErpButton variant="primary" icon={Plus} onClick={() => navigate('/accounting/money-in/receipts/new')}>
              New Receipt
            </ErpButton>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No receipts match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Receipt</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Method</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 text-right font-medium">Gross Amount</th>
                <th className="py-2 pr-3 text-right font-medium">Unallocated</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((receipt) => {
                const actions = receipt.allowedActions
                return (
                  <tr key={receipt.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link to={`/accounting/money-in/receipts/${receipt.id}`} className="font-medium text-erp-accent hover:underline">
                        {receiptDisplayNumber(receipt)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{receipt.customerNameSnapshot}</td>
                    <td className="py-2 pr-3 tabular-nums">{receipt.receiptDate}</td>
                    <td className="py-2 pr-3">{receipt.paymentMethod.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3">
                      <ErpStatusChip label={RECEIPT_STATUS_LABELS[receipt.status]} tone={receiptStatusTone(receipt.status)} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(receipt.grossReceiptAmount))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(receipt.unallocatedAmount))}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/receipts/${receipt.id}`)}>
                          View
                        </ErpButton>
                        {mergeAllowedAction(perms.canEditReceipt, actions?.edit) && (
                          <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/receipts/${receipt.id}/edit`)}>
                            Edit
                          </ErpButton>
                        )}
                        {mergeAllowedAction(perms.canAllocate, actions?.allocate) && (
                          <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/receipts/${receipt.id}/allocate`)}>
                            Allocate
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
