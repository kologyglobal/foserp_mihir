import { ChevronDown, Copy, FileText, Pencil, Power, PowerOff, ScrollText } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import type { ChartOfAccount } from '@/types/chartOfAccounts'
import { AccountStatusBadge, AccountTypeBadge } from './AccountBadges'

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

function YesNo({ value }: { value: boolean }) {
  return <span>{value ? 'Yes' : 'No'}</span>
}

export function AccountFactBox({
  account,
  parentName,
  childCount,
  canEdit,
  canViewBalance,
  canViewAudit,
  canDeactivate,
  canActivate,
  onEdit,
  onViewLedger,
  onViewCard,
  onDuplicate,
  onDeactivate,
  onActivate,
  collapsed,
  onToggleCollapse,
}: {
  account: ChartOfAccount | null
  parentName?: string
  childCount: number
  canEdit: boolean
  canViewBalance: boolean
  canViewAudit: boolean
  canDeactivate: boolean
  canActivate: boolean
  onEdit: () => void
  onViewLedger: () => void
  onViewCard: () => void
  onDuplicate: () => void
  onDeactivate: () => void
  onActivate: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  if (!account) {
    return (
      <aside className="flex h-full min-h-[200px] flex-col border-l border-erp-border bg-white p-4 text-[12px] text-erp-muted">
        <p>Select an account to view summary, posting rules, and actions.</p>
      </aside>
    )
  }

  const isCollapsed = collapsed ?? false

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-erp-border bg-white text-[12px]',
        isCollapsed ? 'w-10' : 'w-[300px] shrink-0',
      )}
      aria-label="Account fact box"
    >
      {onToggleCollapse ? (
        <div className="flex shrink-0 items-center justify-between border-b border-erp-border px-3 py-2">
          {!isCollapsed ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-erp-muted">Account details</p>
          ) : null}
          <button
            type="button"
            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand fact box' : 'Collapse fact box'}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', isCollapsed && '-rotate-90')} />
          </button>
        </div>
      ) : null}

      {!isCollapsed ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <div className="border-b border-erp-border py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[13px] font-semibold tabular-nums text-erp-text">{account.code}</span>
              <AccountTypeBadge type={account.accountType} />
              <AccountStatusBadge active={account.active} />
            </div>
            <p className="mt-1 font-semibold text-erp-text">{account.name}</p>
            {account.alias ? <p className="text-erp-muted">{account.alias}</p> : null}
            {account.systemAccount ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-700">System account</p>
            ) : null}
          </div>

          <FactSection title="Account Summary">
            <FactRow label="Category" value={account.category} />
            <FactRow label="Parent" value={parentName ?? '—'} />
            <FactRow label="Normal balance" value={account.normalBalance} />
            <FactRow label="Child accounts" value={childCount} />
            {canViewBalance ? (
              <FactRow
                label="Current balance"
                value={
                  <span>
                    {formatCurrency(account.currentBalance)}{' '}
                    <span className="text-[10px] font-normal text-erp-muted">(demo)</span>
                  </span>
                }
              />
            ) : null}
            {account.description ? <FactRow label="Description" value={account.description} /> : null}
          </FactSection>

          <FactSection title="Posting Configuration">
            {account.accountType === 'Group' ? (
              <p className="text-[11px] text-erp-muted">Group accounts do not accept direct postings.</p>
            ) : (
              <>
                <FactRow label="Direct posting" value={<YesNo value={account.posting.allowDirectPosting} />} />
                <FactRow label="Manual journal" value={<YesNo value={account.posting.allowManualJournalPosting} />} />
                <FactRow label="Control account" value={<YesNo value={account.posting.isControlAccount} />} />
                {account.posting.isControlAccount && account.posting.controlAccountType ? (
                  <FactRow label="Control type" value={account.posting.controlAccountType} />
                ) : null}
                <FactRow label="Reconciliation" value={<YesNo value={account.posting.reconciliationRequired} />} />
                <FactRow label="Cost centre req." value={<YesNo value={account.posting.costCentreRequired} />} />
                <FactRow label="Currency" value={account.posting.currency} />
              </>
            )}
          </FactSection>

          <FactSection title="Related Information">
            <div className="flex flex-col gap-1.5">
              <button type="button" className="erp-btn erp-btn-ghost h-8 justify-start px-2 text-[12px]" onClick={onViewCard}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                View account card
              </button>
              <button type="button" className="erp-btn erp-btn-ghost h-8 justify-start px-2 text-[12px]" onClick={onViewLedger}>
                <ScrollText className="mr-1.5 h-3.5 w-3.5" />
                View ledger
                <span className="ml-1 text-[10px] text-erp-muted">(demo)</span>
              </button>
            </div>
          </FactSection>

          {canViewAudit ? (
            <FactSection title="Audit" defaultOpen={false}>
              <FactRow label="Created by" value={account.createdBy} />
              <FactRow label="Created" value={formatDateTime(account.createdAt)} />
              <FactRow label="Modified by" value={account.modifiedBy} />
              <FactRow label="Modified" value={formatDateTime(account.modifiedAt)} />
              {!account.active && account.deactivatedReason ? (
                <FactRow label="Deactivated" value={account.deactivatedReason} />
              ) : null}
            </FactSection>
          ) : null}

          <FactSection title="Actions">
            <div className="flex flex-col gap-1.5">
              {canEdit ? (
                <button type="button" className="erp-btn erp-btn-primary h-8 justify-start px-2 text-[12px]" onClick={onEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit account
                </button>
              ) : null}
              <button type="button" className="erp-btn erp-btn-ghost h-8 justify-start px-2 text-[12px]" onClick={onDuplicate}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Duplicate
              </button>
              {account.active && canDeactivate ? (
                <button
                  type="button"
                  className="erp-btn h-8 justify-start px-2 text-[12px] text-red-700 hover:bg-red-50"
                  onClick={onDeactivate}
                >
                  <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                  Deactivate
                </button>
              ) : null}
              {!account.active && canActivate ? (
                <button type="button" className="erp-btn erp-btn-ghost h-8 justify-start px-2 text-[12px]" onClick={onActivate}>
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                  Activate
                </button>
              ) : null}
            </div>
          </FactSection>
        </div>
      ) : null}
    </aside>
  )
}
