/**
 * Kology-facing Expense entry — posts through Money Out Vendor Bill (invoiceType EXPENSE).
 * No shadow expense ledger.
 */
import { Link } from 'react-router-dom'
import { Receipt, Wallet } from 'lucide-react'
import { useTenantProfileStore } from '@/store/tenantProfileStore'
import { PageHeader } from '@/components/ui/PageHeader'

export function AccountingExpenseEntryPage() {
  const isServices = useTenantProfileStore((s) => s.isServices())

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader
        title="Expenses"
        description={
          isServices
            ? 'Record operating expenses through Accounting Money Out — Vendor Bill or paid expense. No separate expense ledger.'
            : 'Shortcut into Money Out for EXPENSE vendor bills and payments.'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/accounting/money-out/vendor-invoices/new?invoiceType=EXPENSE"
          className="rounded-xl border border-erp-border bg-white p-5 shadow-sm transition hover:border-erp-primary/40"
        >
          <Wallet className="mb-3 h-6 w-6 text-erp-primary" />
          <h2 className="text-sm font-semibold text-erp-text">Payable expense</h2>
          <p className="mt-1 text-xs text-erp-muted">
            Create a Vendor Bill (EXPENSE) → AP outstanding → Vendor Payment → Allocation.
          </p>
        </Link>
        <Link
          to="/accounting/money-out/vendor-payments/new"
          className="rounded-xl border border-erp-border bg-white p-5 shadow-sm transition hover:border-erp-primary/40"
        >
          <Receipt className="mb-3 h-6 w-6 text-erp-primary" />
          <h2 className="text-sm font-semibold text-erp-text">Pay from Bank / Cash</h2>
          <p className="mt-1 text-xs text-erp-muted">
            Record vendor payment against an expense bill, or open Bank & Cash for transfers.
          </p>
        </Link>
      </div>

      <p className="text-xs text-erp-muted">
        Prefer existing Money Out screens for full detail.{' '}
        <Link className="font-medium text-erp-primary hover:underline" to="/accounting/money-out">
          Open Money Out →
        </Link>
      </p>
    </div>
  )
}
