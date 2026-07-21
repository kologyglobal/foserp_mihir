import { Link } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { isApiMode } from '@/config/apiConfig'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

type CorrectionsTab = 'adjustments' | 'allocations' | 'documents' | 'history'

const TABS: Array<{ id: CorrectionsTab; label: string; description: string }> = [
  {
    id: 'adjustments',
    label: 'Adjustments',
    description: 'Vendor debit notes and credit adjustments — draft, approve, post and allocate.',
  },
  {
    id: 'allocations',
    label: 'Allocation corrections',
    description: 'Reverse payable allocation batches (subledger only, no GL).',
  },
  {
    id: 'documents',
    label: 'Document reversals',
    description: 'Reverse posted vendor invoices, payments and adjustments with GL reversal vouchers.',
  },
  {
    id: 'history',
    label: 'History',
    description: 'Audit trail of AP reversals when the history API is available.',
  },
]

export function CorrectionsWorkspacePage() {
  const perms = useMoneyOutPermissions()
  const params = new URLSearchParams(window.location.search)
  const activeTab = (params.get('tab') as CorrectionsTab) || 'adjustments'

  if (!perms.canViewCorrections) {
    return (
      <MoneyOutWorkspaceShell title="Corrections">
        <p className="text-[13px] text-erp-muted">You do not have permission to view AP corrections.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Corrections">
        <p className="text-[13px] text-erp-muted">AP corrections require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell title="Corrections">
      <div className="mb-4 flex flex-wrap gap-1 border-b border-erp-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={`/accounting/money-out/corrections?tab=${t.id}`}
            className={`px-3 py-2 text-[12px] ${activeTab === t.id ? 'border-b-2 border-erp-accent font-semibold text-erp-accent' : 'text-erp-muted hover:text-erp-text'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-[13px] text-erp-muted">{TABS.find((t) => t.id === activeTab)?.description}</p>

      {activeTab === 'adjustments' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/accounting/money-out/vendor-adjustments" className="rounded border border-erp-border p-4 hover:border-erp-accent">
            <h3 className="text-[13px] font-semibold">Vendor adjustments register</h3>
            <p className="mt-1 text-[12px] text-erp-muted">Browse debit notes and credit adjustments.</p>
          </Link>
          {perms.canCreateAdjustment && (
            <Link
              to="/accounting/money-out/vendor-adjustments/new?type=VENDOR_DEBIT_NOTE"
              className="rounded border border-erp-border p-4 hover:border-erp-accent"
            >
              <h3 className="text-[13px] font-semibold">New vendor debit note</h3>
              <p className="mt-1 text-[12px] text-erp-muted">Quick path for purchase returns and claims.</p>
            </Link>
          )}
        </div>
      )}

      {activeTab === 'allocations' && (
        <div className="space-y-3">
          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
            Allocation reversal restores open-item balances only — no GL voucher is created.
          </div>
          <p className="text-[12px] text-erp-muted">
            Open a payment or debit note allocation from its detail page, or navigate from vendor payment / adjustment detail → Allocation tab.
          </p>
          <Link to="/accounting/money-out/payables">
            <ErpButton variant="secondary">Browse payables</ErpButton>
          </Link>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/accounting/money-out/vendor-invoices?status=POSTED" className="rounded border border-erp-border p-4 hover:border-erp-accent">
            <h3 className="text-[13px] font-semibold">Vendor invoices</h3>
            <p className="mt-1 text-[12px] text-erp-muted">Reverse from invoice detail when allowed.</p>
          </Link>
          <Link to="/accounting/money-out/vendor-payments?status=POSTED" className="rounded border border-erp-border p-4 hover:border-erp-accent">
            <h3 className="text-[13px] font-semibold">Vendor payments</h3>
            <p className="mt-1 text-[12px] text-erp-muted">Reverse payments; cascade allocation reversal when needed.</p>
          </Link>
          <Link to="/accounting/money-out/vendor-adjustments?status=POSTED" className="rounded border border-erp-border p-4 hover:border-erp-accent">
            <h3 className="text-[13px] font-semibold">Vendor adjustments</h3>
            <p className="mt-1 text-[12px] text-erp-muted">Reverse posted debit notes / credit adjustments.</p>
          </Link>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          <p className="text-[12px] text-erp-muted">
            Dedicated AP reversal history API is not yet exposed. Use the reversal history page for an empty-state placeholder, or inspect document detail for reversal metadata.
          </p>
          <Link to="/accounting/money-out/reversals">
            <ErpButton variant="secondary">Open reversal history</ErpButton>
          </Link>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
