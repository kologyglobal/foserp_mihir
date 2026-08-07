import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { apiRequest, tenantPath } from '@/services/api/client'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

type MigrationRow = {
  id: string
  receiptNo: string
  receiptDate: string
  customerId: string
  customerName: string
  amount: string
  paymentMode: string
  transactionRef: string | null
  commercialOnly: boolean
  accountingMigrationStatus: string
  accountingMigrationError: string | null
  accountingReceiptId: string | null
  proformaNo: string | null
}

export function CrmReceiptMigrationPage() {
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<MigrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('migrationStatus', status)
      if (search.trim()) qs.set('search', search.trim())
      qs.set('limit', '50')
      const data = await apiRequest<MigrationRow[]>(
        `${tenantPath('/accounting/receivables/crm-receipt-migration')}?${qs.toString()}`,
      )
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load CRM receipt migration list')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [status, search])

  useEffect(() => {
    void load()
  }, [load])

  if (!perms.canViewReceipt) {
    return (
      <MoneyInWorkspaceShell title="CRM Receipt Migration">
        <p className="text-sm text-erp-muted">You do not have permission to view this workspace.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="CRM Receipt Migration"
      description="Review commercial CRM receipts. Create Money In drafts one-by-one — never bulk post."
      actions={
        <ErpButton variant="secondary" onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="rounded border border-erp-border px-2 py-1.5 text-[13px]"
          placeholder="Search receipt / customer / ref"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded border border-erp-border px-2 py-1.5 text-[13px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All migration statuses</option>
          {[
            'UNREVIEWED',
            'NON_ACCOUNTING',
            'READY_TO_MIGRATE',
            'DRAFT_CREATED',
            'MIGRATED',
            'DUPLICATE',
            'REJECTED',
            'FAILED',
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ErpButton variant="secondary" onClick={() => void load()}>
          Apply
        </ErpButton>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-erp-muted">
              <tr>
                <th className="px-3 py-2">CRM receipt</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Accounting</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-erp-muted">
                    No CRM receipts match the filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-erp-border/70">
                    <td className="px-3 py-2 font-medium">
                      <Link className="text-erp-accent hover:underline" to={`/sales/receipts/${r.id}`}>
                        {r.receiptNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.receiptDate}</td>
                    <td className="px-3 py-2">{r.customerName}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(Number(r.amount))}</td>
                    <td className="px-3 py-2 uppercase">{r.paymentMode}</td>
                    <td className="px-3 py-2">{r.accountingMigrationStatus}</td>
                    <td className="px-3 py-2">
                      {r.accountingReceiptId ? (
                        <Link
                          className="text-erp-accent hover:underline"
                          to={`/accounting/money-in/receipts/${r.accountingReceiptId}`}
                        >
                          Open AR receipt
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.accountingReceiptId ? (
                        <Link
                          className="text-erp-accent hover:underline"
                          to={`/accounting/money-in/receipts/${r.accountingReceiptId}`}
                        >
                          Review
                        </Link>
                      ) : (
                        <Link
                          className="text-erp-accent hover:underline"
                          to={`/accounting/money-in/receipts/new?customerId=${r.customerId}&crmPaymentReceiptId=${r.id}`}
                        >
                          Create draft
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
