import { useMemo } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Copy,
  Eye,
  FolderPlus,
  Pencil,
  Power,
  ScrollText,
  Trash2,
} from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'
import type { ChartOfAccount } from '@/types/chartOfAccounts'
import { AccountStatusBadge, AccountTypeBadge } from './AccountBadges'
import { EnterprisePagination } from '@/design-system/list-page/EnterprisePagination'
import { EnterpriseRowActionsMenu, type RowActionItem } from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { SkeletonTable } from '@/components/design-system/SkeletonTable'

export type AccountSortKey =
  | 'code'
  | 'name'
  | 'accountType'
  | 'category'
  | 'parent'
  | 'normalBalance'
  | 'allowDirectPosting'
  | 'isControlAccount'
  | 'currentBalance'
  | 'active'

export type AccountListAction =
  | 'view'
  | 'edit'
  | 'addChild'
  | 'duplicate'
  | 'viewLedger'
  | 'activate'
  | 'deactivate'
  | 'delete'

function SortHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
  align,
  sticky,
  className,
}: {
  label: string
  sortKey: AccountSortKey
  activeKey: AccountSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: AccountSortKey) => void
  align?: 'left' | 'right'
  sticky?: boolean
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted',
        align === 'right' ? 'text-right' : 'text-left',
        sticky && 'sticky left-0 z-20 bg-erp-surface',
        className,
      )}
    >
      <button
        type="button"
        className={cn('inline-flex items-center gap-1 hover:text-erp-text', align === 'right' && 'ml-auto')}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

function buildRowActions(account: ChartOfAccount, onAction: (action: AccountListAction, account: ChartOfAccount) => void): RowActionItem[] {
  const items: RowActionItem[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: () => onAction('view', account) },
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => onAction('edit', account) },
  ]
  if (account.accountType === 'Group') {
    items.push({
      id: 'addChild',
      label: 'Add child',
      icon: FolderPlus,
      onClick: () => onAction('addChild', account),
    })
  }
  items.push(
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => onAction('duplicate', account) },
    { id: 'ledger', label: 'View ledger', icon: ScrollText, onClick: () => onAction('viewLedger', account) },
  )
  if (account.active) {
    items.push({
      id: 'deactivate',
      label: 'Deactivate',
      icon: Ban,
      onClick: () => onAction('deactivate', account),
      danger: true,
    })
  } else {
    items.push({
      id: 'activate',
      label: 'Activate',
      icon: Power,
      onClick: () => onAction('activate', account),
    })
  }
  items.push({
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    onClick: () => onAction('delete', account),
    danger: true,
    disabled: account.systemAccount,
    disabledReason: account.systemAccount ? 'System accounts cannot be deleted' : undefined,
  })
  return items
}

function YesNoCell({ value }: { value: boolean }) {
  return <span className={value ? 'text-emerald-700' : 'text-erp-muted'}>{value ? 'Yes' : 'No'}</span>
}

function AccountMobileCard({
  row,
  parentMap,
  selected,
  canViewBalance,
  onSelect,
  onOpen,
  onAction,
}: {
  row: ChartOfAccount
  parentMap: Record<string, string>
  selected: boolean
  canViewBalance: boolean
  onSelect: (id: string) => void
  onOpen: (account: ChartOfAccount) => void
  onAction: (action: AccountListAction, account: ChartOfAccount) => void
}) {
  const isGroup = row.accountType === 'Group'
  return (
    <article
      className={cn(
        'rounded-lg border border-erp-border bg-white p-3 text-[12px] shadow-sm',
        selected && 'border-erp-primary ring-1 ring-erp-primary/30',
        isGroup && 'bg-slate-50/80',
      )}
      onClick={() => onSelect(row.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[13px] font-semibold tabular-nums">{row.code}</span>
            <AccountTypeBadge type={row.accountType} />
            <AccountStatusBadge active={row.active} />
          </div>
          <button
            type="button"
            className={cn('mt-1 block text-left font-semibold text-erp-primary hover:underline', !isGroup && 'pl-3')}
            onClick={(e) => {
              e.stopPropagation()
              onOpen(row)
            }}
          >
            {row.name}
          </button>
          <p className="mt-1 text-erp-muted">
            {row.category}
            {row.parentId && parentMap[row.parentId] ? ` · ${parentMap[row.parentId]}` : ''}
          </p>
        </div>
        <EnterpriseRowActionsMenu actions={buildRowActions(row, onAction)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <span>
          Normal: <strong>{row.normalBalance}</strong>
        </span>
        <span>
          Direct: <YesNoCell value={row.posting.allowDirectPosting} />
        </span>
        {canViewBalance ? (
          <span className="col-span-2">
            Balance: <strong>{formatCurrency(row.currentBalance)}</strong>{' '}
            <span className="text-erp-muted">(demo)</span>
          </span>
        ) : null}
      </div>
    </article>
  )
}

export function AccountListTable({
  rows,
  parentMap,
  selectedId,
  onSelect,
  onOpen,
  sortKey,
  sortDir,
  onSort,
  page,
  pageSize,
  onPageChange,
  total,
  visibleOptionalColumns,
  canViewBalance,
  onAction,
  isMobile,
  loading,
}: {
  rows: ChartOfAccount[]
  parentMap: Record<string, string>
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (account: ChartOfAccount) => void
  sortKey: AccountSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: AccountSortKey) => void
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  total: number
  visibleOptionalColumns: string[]
  canViewBalance: boolean
  onAction: (action: AccountListAction, account: ChartOfAccount) => void
  isMobile: boolean
  loading: boolean
}) {
  const showBalance = canViewBalance
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  const optionalSet = useMemo(() => new Set(visibleOptionalColumns), [visibleOptionalColumns])

  if (loading) {
    return <SkeletonTable rows={8} cols={6} className="rounded-lg border border-erp-border" />
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-erp-muted">No accounts match the current filters.</p>
        ) : (
          rows.map((row) => (
            <AccountMobileCard
              key={row.id}
              row={row}
              parentMap={parentMap}
              selected={selectedId === row.id}
              canViewBalance={canViewBalance}
              onSelect={onSelect}
              onOpen={onOpen}
              onAction={onAction}
            />
          ))
        )}
        <EnterprisePagination
          from={from}
          to={to}
          total={total}
          pageIndex={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-erp-border bg-white">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <SortHeader label="Code" sortKey="code" activeKey={sortKey} sortDir={sortDir} onSort={onSort} sticky className="left-0" />
              <SortHeader
                label="Name"
                sortKey="name"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky
                className="left-[88px] min-w-[200px]"
              />
              <SortHeader label="Type" sortKey="accountType" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Category" sortKey="category" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Parent" sortKey="parent" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Normal bal." sortKey="normalBalance" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Direct" sortKey="allowDirectPosting" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Control" sortKey="isControlAccount" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              {optionalSet.has('alias') ? (
                <th className="whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  Alias
                </th>
              ) : null}
              {optionalSet.has('gstRelevant') ? (
                <th className="whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  GST
                </th>
              ) : null}
              {optionalSet.has('tdsRelevant') ? (
                <th className="whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  TDS
                </th>
              ) : null}
              {showBalance ? (
                <SortHeader
                  label="Current balance"
                  sortKey="currentBalance"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                />
              ) : null}
              <SortHeader label="Status" sortKey="active" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th className="sticky right-0 z-20 border-b border-erp-border bg-erp-surface px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-4 py-10 text-center text-erp-muted">
                  No accounts match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isGroup = row.accountType === 'Group'
                const selected = selectedId === row.id
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer border-b border-erp-border transition-colors hover:bg-erp-surface-alt/60',
                      isGroup && 'bg-slate-50/80 font-semibold',
                      selected && 'bg-erp-primary-soft/40',
                    )}
                    onClick={() => onSelect(row.id)}
                    aria-selected={selected}
                  >
                    <td className="sticky left-0 z-[1] whitespace-nowrap bg-inherit px-2 py-2 font-mono tabular-nums">
                      <button
                        type="button"
                        className="font-semibold text-erp-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpen(row)
                        }}
                      >
                        {row.code}
                      </button>
                    </td>
                    <td className={cn('sticky left-[88px] z-[1] min-w-[200px] bg-inherit px-2 py-2', !isGroup && 'indent-4 font-normal')}>
                      {row.name}
                    </td>
                    <td className="px-2 py-2">
                      <AccountTypeBadge type={row.accountType} />
                    </td>
                    <td className="px-2 py-2 text-erp-muted">{row.category}</td>
                    <td className="max-w-[140px] truncate px-2 py-2 text-erp-muted">
                      {row.parentId ? parentMap[row.parentId] ?? '—' : '—'}
                    </td>
                    <td className="px-2 py-2">{row.normalBalance}</td>
                    <td className="px-2 py-2">
                      <YesNoCell value={row.posting.allowDirectPosting} />
                    </td>
                    <td className="px-2 py-2">
                      <YesNoCell value={row.posting.isControlAccount} />
                    </td>
                    {optionalSet.has('alias') ? (
                      <td className="max-w-[120px] truncate px-2 py-2 text-erp-muted">{row.alias || '—'}</td>
                    ) : null}
                    {optionalSet.has('gstRelevant') ? (
                      <td className="px-2 py-2">
                        <YesNoCell value={row.tax.gstRelevant} />
                      </td>
                    ) : null}
                    {optionalSet.has('tdsRelevant') ? (
                      <td className="px-2 py-2">
                        <YesNoCell value={row.tax.tdsRelevant} />
                      </td>
                    ) : null}
                    {showBalance ? (
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatCurrency(row.currentBalance)}
                        <span className="ml-1 text-[10px] font-normal text-erp-muted">(demo)</span>
                      </td>
                    ) : null}
                    <td className="px-2 py-2">
                      <AccountStatusBadge active={row.active} />
                    </td>
                    <td className="sticky right-0 z-[1] bg-inherit px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <EnterpriseRowActionsMenu actions={buildRowActions(row, onAction)} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-erp-border px-3 py-2">
        <EnterprisePagination
          from={from}
          to={to}
          total={total}
          pageIndex={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  )
}
