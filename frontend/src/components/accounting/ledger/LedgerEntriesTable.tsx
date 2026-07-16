import { useMemo } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  FileText,
  Link2,
  Printer,
  ScrollText,
  Shield,
  Undo2,
  User,
} from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import type { LedgerEntry } from '@/types/ledgerEntries'
import { LedgerStatusBadge, LedgerVoucherTypeBadge } from './LedgerStatusBadge'
import { EnterprisePagination } from '@/design-system/list-page/EnterprisePagination'
import { EnterpriseRowActionsMenu, type RowActionItem } from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { SkeletonTable } from '@/components/design-system/SkeletonTable'

export type LedgerSortKey =
  | 'entryNumber'
  | 'postingDate'
  | 'documentDate'
  | 'voucherNumber'
  | 'voucherType'
  | 'accountCode'
  | 'accountName'
  | 'party'
  | 'narration'
  | 'debit'
  | 'credit'
  | 'runningBalance'
  | 'costCentre'
  | 'department'
  | 'project'
  | 'status'
  | 'referenceNumber'
  | 'postedAt'

export type LedgerRowAction =
  | 'view'
  | 'openVoucher'
  | 'openAccount'
  | 'openParty'
  | 'viewSource'
  | 'viewRelated'
  | 'viewReversal'
  | 'viewAudit'
  | 'print'
  | 'export'

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
  sortKey: LedgerSortKey
  activeKey: LedgerSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: LedgerSortKey) => void
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
        sticky && 'sticky z-20 bg-erp-surface',
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

function formatRunningBalance(
  row: LedgerEntry,
  showRunningBalance: boolean,
  canViewBalance: boolean,
): string {
  if (!showRunningBalance || !canViewBalance) return '—'
  const abs = Math.abs(row.runningBalance)
  return `${formatCurrency(abs)} ${row.runningBalanceSide}`
}

function buildRowActions(
  row: LedgerEntry,
  onAction: (action: LedgerRowAction, entry: LedgerEntry) => void,
): RowActionItem[] {
  const items: RowActionItem[] = [
    { id: 'view', label: 'View entry', icon: Eye, onClick: () => onAction('view', row) },
    {
      id: 'openVoucher',
      label: 'Open voucher',
      icon: ScrollText,
      onClick: () => onAction('openVoucher', row),
      disabled: !row.voucherId,
      disabledReason: !row.voucherId ? 'No linked voucher' : undefined,
    },
    {
      id: 'openAccount',
      label: 'Open account',
      icon: FileText,
      onClick: () => onAction('openAccount', row),
    },
    {
      id: 'openParty',
      label: 'Open party',
      icon: User,
      onClick: () => onAction('openParty', row),
      disabled: !row.party,
      disabledReason: !row.party ? 'No party on this entry' : undefined,
    },
    {
      id: 'viewSource',
      label: 'View source document',
      icon: Link2,
      onClick: () => onAction('viewSource', row),
      disabled: !row.sourceDocument,
      disabledReason: !row.sourceDocument ? 'No source document' : undefined,
    },
    { id: 'viewRelated', label: 'Related documents', icon: FileText, onClick: () => onAction('viewRelated', row) },
    {
      id: 'viewReversal',
      label: 'View reversal',
      icon: Undo2,
      onClick: () => onAction('viewReversal', row),
      disabled: !row.reversal,
      disabledReason: !row.reversal ? 'No reversal reference' : undefined,
    },
    { id: 'viewAudit', label: 'Audit trail', icon: Shield, onClick: () => onAction('viewAudit', row) },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => onAction('print', row) },
    { id: 'export', label: 'Export row', icon: Download, onClick: () => onAction('export', row) },
  ]
  return items
}

function isReversalStripe(row: LedgerEntry): boolean {
  return row.status === 'Reversed' || row.status === 'Reversal Entry'
}

function LedgerMobileCard({
  row,
  selected,
  showRunningBalance,
  canViewBalance,
  onToggleSelect,
  onOpenEntry,
  onAction,
}: {
  row: LedgerEntry
  selected: boolean
  showRunningBalance: boolean
  canViewBalance: boolean
  onToggleSelect: (id: string) => void
  onOpenEntry: (entry: LedgerEntry) => void
  onAction: (action: LedgerRowAction, entry: LedgerEntry) => void
}) {
  return (
    <article
      className={cn(
        'rounded-lg border border-erp-border bg-white p-3 text-[12px] shadow-sm',
        selected && 'border-erp-primary ring-1 ring-erp-primary/30',
        isReversalStripe(row) && 'bg-rose-50/40',
      )}
      onClick={() => onToggleSelect(row.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(row.id)}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-erp-border"
              aria-label={`Select ${row.entryNumber}`}
            />
            <button
              type="button"
              className="font-mono text-[13px] font-semibold tabular-nums text-erp-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                onOpenEntry(row)
              }}
            >
              {row.entryNumber}
            </button>
            <LedgerStatusBadge status={row.status} isPreviewOnly={row.isPreviewOnly} />
          </div>
          <p className="mt-1 text-erp-muted">
            {row.postingDate} · {row.voucherNumber}
          </p>
          <p className="mt-1 font-semibold text-erp-text">
            {row.account.code} — {row.account.name}
          </p>
          {row.party ? (
            <p className="mt-0.5 text-erp-muted">
              {row.party.partyName} ({row.party.partyType})
            </p>
          ) : null}
          <p className="mt-1 line-clamp-2 text-erp-muted">{row.narration || '—'}</p>
        </div>
        <EnterpriseRowActionsMenu actions={buildRowActions(row, onAction)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <span>
          Debit: <strong className="tabular-nums">{formatCurrency(row.debit)}</strong>
        </span>
        <span>
          Credit: <strong className="tabular-nums">{formatCurrency(row.credit)}</strong>
        </span>
        {showRunningBalance && canViewBalance ? (
          <span className="col-span-2">
            Balance: <strong className="tabular-nums">{formatRunningBalance(row, true, true)}</strong>
          </span>
        ) : null}
      </div>
    </article>
  )
}

function OptionalCell({
  columnId,
  row,
  optionalSet,
}: {
  columnId: string
  row: LedgerEntry
  optionalSet: Set<string>
}) {
  if (!optionalSet.has(columnId)) return null

  switch (columnId) {
    case 'documentDate':
      return <td className="whitespace-nowrap px-2 py-2 tabular-nums">{row.documentDate}</td>
    case 'referenceNumber':
      return (
        <td className="max-w-[120px] truncate px-2 py-2 text-erp-muted" title={row.referenceNumber}>
          {row.referenceNumber || '—'}
        </td>
      )
    case 'externalDocumentNumber':
      return (
        <td className="max-w-[120px] truncate px-2 py-2 text-erp-muted" title={row.externalDocumentNumber}>
          {row.externalDocumentNumber || '—'}
        </td>
      )
    case 'accountCategory':
      return <td className="px-2 py-2 text-erp-muted">{row.account.category}</td>
    case 'partyType':
      return <td className="px-2 py-2 text-erp-muted">{row.party?.partyType ?? '—'}</td>
    case 'location':
      return <td className="px-2 py-2 text-erp-muted">{row.dimensions.locationName ?? '—'}</td>
    case 'plant':
      return <td className="px-2 py-2 text-erp-muted">{row.dimensions.plantName ?? '—'}</td>
    case 'productionOrder':
      return <td className="px-2 py-2 text-erp-muted">{row.manufacturing.productionOrder ?? '—'}</td>
    case 'itemCode':
      return <td className="px-2 py-2 font-mono text-erp-muted">{row.manufacturing.itemCode ?? '—'}</td>
    case 'batchNumber':
      return <td className="px-2 py-2 font-mono text-erp-muted">{row.manufacturing.batchNumber ?? '—'}</td>
    case 'currency':
      return <td className="px-2 py-2 text-erp-muted">{row.currency}</td>
    case 'sourceModule':
      return <td className="px-2 py-2 text-erp-muted">{row.sourceDocument?.module ?? '—'}</td>
    case 'sourceDocument':
      return (
        <td className="max-w-[140px] truncate px-2 py-2 text-erp-muted" title={row.sourceDocument?.documentNumber}>
          {row.sourceDocument?.documentNumber ?? '—'}
        </td>
      )
    case 'createdBy':
      return <td className="px-2 py-2 text-erp-muted">{row.createdBy}</td>
    case 'postedBy':
      return <td className="px-2 py-2 text-erp-muted">{row.postedBy}</td>
    case 'postedAt':
      return (
        <td className="whitespace-nowrap px-2 py-2 text-erp-muted tabular-nums">
          {row.postedAt ? formatDateTime(row.postedAt) : '—'}
        </td>
      )
    case 'reversalVoucher':
      return (
        <td className="px-2 py-2 font-mono text-erp-muted">
          {row.reversal?.reversalVoucherNumber ?? row.reversal?.originalVoucherNumber ?? '—'}
        </td>
      )
    default:
      return null
  }
}

const OPTIONAL_COLUMN_LABELS: Record<string, string> = {
  documentDate: 'Document date',
  referenceNumber: 'Reference',
  externalDocumentNumber: 'Ext. document',
  accountCategory: 'Category',
  partyType: 'Party type',
  location: 'Location',
  plant: 'Plant',
  productionOrder: 'Prod. order',
  itemCode: 'Item code',
  batchNumber: 'Batch',
  currency: 'Currency',
  sourceModule: 'Source module',
  sourceDocument: 'Source doc.',
  createdBy: 'Created by',
  postedBy: 'Posted by',
  postedAt: 'Posted at',
  reversalVoucher: 'Reversal voucher',
}

export function LedgerEntriesTable({
  rows,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenEntry,
  onAction,
  sortKey,
  sortDir,
  onSort,
  page,
  pageSize,
  onPageChange,
  total,
  visibleOptionalColumns,
  showRunningBalance,
  canViewBalance,
  isMobile,
  loading,
}: {
  rows: LedgerEntry[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: (checked: boolean) => void
  onOpenEntry: (entry: LedgerEntry) => void
  onAction: (action: LedgerRowAction, entry: LedgerEntry) => void
  sortKey: LedgerSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: LedgerSortKey) => void
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  total: number
  visibleOptionalColumns: string[]
  showRunningBalance: boolean
  canViewBalance: boolean
  isMobile: boolean
  loading: boolean
}) {
  const optionalSet = useMemo(() => new Set(visibleOptionalColumns), [visibleOptionalColumns])
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someSelected = rows.some((r) => selectedIds.has(r.id))

  if (loading) {
    return <SkeletonTable rows={8} cols={8} className="rounded-lg border border-erp-border" />
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-erp-muted">No ledger entries match the current filters.</p>
        ) : (
          rows.map((row) => (
            <LedgerMobileCard
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              showRunningBalance={showRunningBalance}
              canViewBalance={canViewBalance}
              onToggleSelect={onToggleSelect}
              onOpenEntry={onOpenEntry}
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
        <table className="w-full min-w-[1200px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-30 w-8 border-b border-erp-border bg-erp-surface px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  aria-label="Select all rows on page"
                />
              </th>
              <SortHeader
                label="Entry no."
                sortKey="entryNumber"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky
                className="left-8 min-w-[100px]"
              />
              <SortHeader
                label="Posting date"
                sortKey="postingDate"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky
                className="left-[132px] min-w-[96px]"
              />
              <SortHeader
                label="Voucher no."
                sortKey="voucherNumber"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sticky
                className="left-[228px] min-w-[100px]"
              />
              <SortHeader label="Voucher type" sortKey="voucherType" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Account code" sortKey="accountCode" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Account name" sortKey="accountName" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Party" sortKey="party" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Narration" sortKey="narration" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Debit" sortKey="debit" activeKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortHeader label="Credit" sortKey="credit" activeKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              {showRunningBalance && canViewBalance ? (
                <SortHeader
                  label="Running bal."
                  sortKey="runningBalance"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                />
              ) : null}
              <SortHeader label="Cost centre" sortKey="costCentre" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Department" sortKey="department" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Project" sortKey="project" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              {visibleOptionalColumns.map((colId) => (
                <th
                  key={colId}
                  className="whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted"
                >
                  {OPTIONAL_COLUMN_LABELS[colId] ?? colId}
                </th>
              ))}
              <SortHeader label="Status" sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th className="sticky right-0 z-20 border-b border-erp-border bg-erp-surface px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={30} className="px-4 py-10 text-center text-erp-muted">
                  No ledger entries match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selected = selectedIds.has(row.id)
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer border-b border-erp-border transition-colors hover:bg-erp-surface-alt/60',
                      selected && 'bg-erp-primary-soft/40',
                      isReversalStripe(row) && 'bg-rose-50/30',
                    )}
                    onClick={() => onToggleSelect(row.id)}
                    aria-selected={selected}
                  >
                    <td className="sticky left-0 z-[1] bg-inherit px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(row.id)}
                        aria-label={`Select ${row.entryNumber}`}
                      />
                    </td>
                    <td className="sticky left-8 z-[1] whitespace-nowrap bg-inherit px-2 py-2 font-mono tabular-nums">
                      <button
                        type="button"
                        className="font-semibold text-erp-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenEntry(row)
                        }}
                      >
                        {row.entryNumber}
                      </button>
                    </td>
                    <td className="sticky left-[132px] z-[1] whitespace-nowrap bg-inherit px-2 py-2 tabular-nums">
                      {row.postingDate}
                    </td>
                    <td className="sticky left-[228px] z-[1] whitespace-nowrap bg-inherit px-2 py-2 font-mono tabular-nums">
                      {row.voucherNumber}
                    </td>
                    <td className="px-2 py-2">
                      <LedgerVoucherTypeBadge type={row.voucherType} />
                    </td>
                    <td className="px-2 py-2 font-mono tabular-nums">{row.account.code}</td>
                    <td className="max-w-[160px] truncate px-2 py-2">{row.account.name}</td>
                    <td className="max-w-[140px] truncate px-2 py-2 text-erp-muted">
                      {row.party?.partyName ?? '—'}
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-2 text-erp-muted" title={row.narration}>
                      {row.narration || '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.debit)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.credit)}</td>
                    {showRunningBalance && canViewBalance ? (
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatRunningBalance(row, true, true)}
                      </td>
                    ) : null}
                    <td className="max-w-[120px] truncate px-2 py-2 text-erp-muted">
                      {row.dimensions.costCentreName ?? '—'}
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-2 text-erp-muted">
                      {row.dimensions.departmentName ?? '—'}
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-2 text-erp-muted">
                      {row.dimensions.projectName ?? '—'}
                    </td>
                    {visibleOptionalColumns.map((colId) => (
                      <OptionalCell key={colId} columnId={colId} row={row} optionalSet={optionalSet} />
                    ))}
                    <td className="px-2 py-2">
                      <LedgerStatusBadge status={row.status} isPreviewOnly={row.isPreviewOnly} />
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
