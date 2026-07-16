import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'
import type { AccountLedgerSummary } from '@/types/ledgerEntries'
import type { ChartOfAccount } from '@/types/chartOfAccounts'
import { formatBalanceWithSide } from '@/utils/accounting/indianFinancialYear'

function FactSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details className="group border-b border-erp-border last:border-b-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-[12px] font-semibold text-erp-text [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="h-3.5 w-3.5 text-erp-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 pb-3">{children}</div>
    </details>
  )
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-2 gap-y-0.5 text-[12px]">
      <span className="text-erp-muted">{label}</span>
      <span className="min-w-0 font-medium text-erp-text">{value}</span>
    </div>
  )
}

/** Read-only FactBox for Account Ledger — mirrors CoA FactBox density, no edit actions. */
export function LedgerAccountFactBox({
  account,
  summary,
  canViewBalance,
  collapsed,
  onToggleCollapse,
}: {
  account: ChartOfAccount | null
  summary: AccountLedgerSummary | null
  canViewBalance: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  if (!account) {
    return (
      <aside className="flex h-full min-h-[160px] flex-col border-l border-erp-border bg-white p-4 text-[12px] text-erp-muted">
        <p>Account configuration appears here when the ledger loads.</p>
      </aside>
    )
  }

  const isCollapsed = collapsed ?? false

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-erp-border bg-white text-[12px]',
        isCollapsed ? 'w-10' : 'w-[280px] shrink-0',
      )}
      aria-label="Account ledger fact box"
    >
      {onToggleCollapse ? (
        <div className="flex shrink-0 items-center justify-between border-b border-erp-border px-3 py-2">
          {!isCollapsed ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-erp-muted">Account</p>
          ) : null}
          <button
            type="button"
            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand fact box' : 'Collapse fact box'}
            title={isCollapsed ? 'Expand fact box' : 'Collapse fact box'}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', isCollapsed ? '-rotate-90' : 'rotate-90')} />
          </button>
        </div>
      ) : null}

      {!isCollapsed ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <FactSection title="Configuration">
            <FactRow label="Code" value={<span className="font-mono">{account.code}</span>} />
            <FactRow label="Name" value={account.name} />
            <FactRow label="Category" value={account.category} />
            <FactRow label="Type" value={account.accountType} />
            <FactRow label="Normal balance" value={account.normalBalance} />
            <FactRow label="Status" value={account.active ? 'Active' : 'Inactive'} />
          </FactSection>
          <FactSection title="Posting rules">
            <FactRow label="Control account" value={account.posting.controlAccountType ?? 'None'} />
            <FactRow label="Direct posting" value={account.posting.allowDirectPosting ? 'Allowed' : 'Blocked'} />
            <FactRow label="System account" value={account.systemAccount ? 'Yes' : 'No'} />
          </FactSection>
          {canViewBalance && summary ? (
            <FactSection title="Balances">
              <FactRow
                label="Opening"
                value={formatBalanceWithSide(summary.openingBalance, summary.openingSide, formatCurrency)}
              />
              <FactRow
                label="Closing"
                value={formatBalanceWithSide(summary.closingBalance, summary.closingSide, formatCurrency)}
              />
              <FactRow
                label="Last posting"
                value={summary.lastPostingDate ?? '—'}
              />
              <FactRow label="Entry count" value={String(summary.entryCount)} />
            </FactSection>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
