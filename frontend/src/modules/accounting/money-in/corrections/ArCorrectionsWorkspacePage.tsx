import { Link } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { isApiMode } from '@/config/apiConfig'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

type CorrectionsTab = 'receipts' | 'credit-notes' | 'allocations' | 'journals'

const TABS: Array<{ id: CorrectionsTab; label: string; description: string }> = [
  {
    id: 'receipts',
    label: 'Receipt reversals',
    description: 'Reverse posted customer receipts after reversing any allocation batches.',
  },
  {
    id: 'credit-notes',
    label: 'Credit note reversals',
    description: 'Reverse posted credit notes and their allocation batches from the document detail page.',
  },
  {
    id: 'allocations',
    label: 'Allocation reversals',
    description: 'Subledger-only — restore invoice outstanding without creating a journal.',
  },
  {
    id: 'journals',
    label: 'Journal reversals',
    description: 'Manual journal reverse lives on the journal detail page (GL reversing voucher).',
  },
]

export function ArCorrectionsWorkspacePage() {
  const perms = useMoneyInPermissions()
  const params = new URLSearchParams(window.location.search)
  const activeTab = (params.get('tab') as CorrectionsTab) || 'receipts'

  const canView =
    perms.canViewReceipt || perms.canViewCreditNote || perms.canViewInvoice || perms.canViewAllocations

  if (!canView) {
    return (
      <MoneyInWorkspaceShell title="Corrections">
        <p className="text-[13px] text-erp-muted">You do not have permission to view AR corrections.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyInWorkspaceShell title="Corrections">
        <p className="text-[13px] text-erp-muted">AR corrections require API mode.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell title="Corrections">
      <div className="mb-4 flex flex-wrap gap-1 border-b border-erp-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={`/accounting/money-in/corrections?tab=${t.id}`}
            className={`px-3 py-2 text-[12px] ${activeTab === t.id ? 'border-b-2 border-erp-accent font-semibold text-erp-accent' : 'text-erp-muted hover:text-erp-text'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-[13px] text-erp-muted">{TABS.find((t) => t.id === activeTab)?.description}</p>

      {activeTab === 'receipts' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/accounting/money-in/receipts?status=POSTED" className="rounded border border-erp-border p-4 hover:border-erp-accent">
            <h3 className="text-[13px] font-semibold">Posted receipts</h3>
            <p className="mt-1 text-[12px] text-erp-muted">Open a receipt → Reverse Document (after reversing allocations).</p>
          </Link>
          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900 sm:col-span-2">
            Receipt reverse posts a reversing voucher and closes the CREDIT open item.
          </div>
        </div>
      )}

      {activeTab === 'credit-notes' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/accounting/money-in/credit-notes?status=POSTED" className="rounded border border-erp-border p-4 hover:border-erp-accent">
            <h3 className="text-[13px] font-semibold">Posted credit notes</h3>
            <p className="mt-1 text-[12px] text-erp-muted">Open a credit note → Reverse Document.</p>
          </Link>
        </div>
      )}

      {activeTab === 'allocations' && (
        <div className="space-y-3">
          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
            Allocation reversal restores open-item balances only — no GL voucher is created.
          </div>
          <p className="text-[12px] text-erp-muted">
            Use Receipt or Credit Note detail → Allocation history → Reverse batch.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/accounting/money-in/receipts">
              <ErpButton variant="secondary">Receipts</ErpButton>
            </Link>
            <Link to="/accounting/money-in/credit-notes">
              <ErpButton variant="secondary">Credit notes</ErpButton>
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'journals' && (
        <div className="space-y-3">
          <p className="text-[12px] text-erp-muted">
            Posted manual journals reverse from Journal detail → Reverse (creates a reversing voucher).
          </p>
          <Link to="/accounting/entries/journals">
            <ErpButton variant="secondary">Open journals</ErpButton>
          </Link>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
