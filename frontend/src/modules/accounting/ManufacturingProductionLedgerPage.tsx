import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingSummaryCards,
  ManufacturingAccountingWorkspaceTabs,
} from '@/components/accounting/manufacturingAccounting'
import { getProductionLedger } from '@/services/accounting/manufacturingAccountingService'
import type { LedgerTxnType, ProductionLedgerEntry } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, LEDGER_TXN_TYPES } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'

export function ManufacturingProductionLedgerPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<ProductionLedgerEntry[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [txnType, setTxnType] = useState<LedgerTxnType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getProductionLedger({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
        txnType,
        dateFrom,
        dateTo,
      })
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search, txnType, dateFrom, dateTo])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const summary = useMemo(() => ({
    count: rows.length,
    debit: rows.reduce((s, r) => s + r.debit, 0),
    credit: rows.reduce((s, r) => s + r.credit, 0),
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'entries', label: 'Ledger Entries', value: summary.count, accent: 'blue' },
    { id: 'debit', label: 'Total Debit', value: formatCompactCurrency(summary.debit), helper: formatCurrency(summary.debit), accent: 'slate' },
    { id: 'credit', label: 'Total Credit', value: formatCompactCurrency(summary.credit), helper: formatCurrency(summary.credit), accent: 'green' },
  ]

  if (!perms.canViewLedger) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Production Ledger" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Production Ledger' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Production Ledger"
      description="Read-only production accounting ledger — material, labour, overhead, FG and variance postings."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Production Ledger' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/ledger"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="ledger" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={3} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, account, narration, source doc…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Txn Type
            <select className={selectCls} value={txnType} onChange={(e) => setTxnType(e.target.value as LedgerTxnType | '')}>
              <option value="">All</option>
              {LEDGER_TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            From
            <input type="date" className={selectCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-[11px] text-erp-muted">
            To
            <input type="date" className={selectCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>

        {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}
        {loadState === 'error' ? <ManufacturingAccountingEmptyState title="Load failed" /> : null}

        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Posting Date</th>
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">Txn Type</th>
                <th className="px-3 py-2 font-semibold">Account</th>
                <th className="px-3 py-2 text-right font-semibold">Debit</th>
                <th className="px-3 py-2 text-right font-semibold">Credit</th>
                <th className="px-3 py-2 font-semibold">Cost Centre</th>
                <th className="px-3 py-2 font-semibold">Work Centre</th>
                <th className="px-3 py-2 font-semibold">Source Document</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.postingDate)}</td>
                  <td className="px-3 py-2 font-medium">{row.productionOrderNumber}</td>
                  <td className="px-3 py-2">{row.itemName}</td>
                  <td className="px-3 py-2 font-medium">{row.txnType}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.accountName}</span>
                    <span className="ml-1 text-erp-muted">({row.accountCode})</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.costCentre}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.workCentre}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.sourceDocument}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No ledger entries match" />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
