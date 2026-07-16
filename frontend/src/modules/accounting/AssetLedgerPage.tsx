import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import {
  FixedAssetsDemoBanner,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getAssetLedger, getAssets } from '@/services/accounting/fixedAssetsService'
import type { AssetLedgerEntry, AssetLedgerEntryType, FixedAsset } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

const ENTRY_TYPES: AssetLedgerEntryType[] = [
  'Acquisition',
  'Capitalization',
  'Depreciation',
  'Transfer',
  'Revaluation',
  'Impairment',
  'Disposal',
  'Adjustment',
]

export function AssetLedgerPage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<AssetLedgerEntry[]>([])
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [assetId, setAssetId] = useState('')
  const [entryType, setEntryType] = useState<AssetLedgerEntryType | ''>('')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const [ledger, assetList] = await Promise.all([getAssetLedger(assetId || undefined), getAssets()])
      setRows(ledger)
      setAssets(assetList)
      setLoadState(ledger.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [assetId])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (entryType && r.entryType !== entryType) return false
      if (!search) return true
      return `${r.assetNumber} ${r.reference} ${r.narration}`.toLowerCase().includes(search.toLowerCase())
    })
  }, [rows, search, entryType])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const totalDebit = rows.reduce((s, r) => s + r.debitAmount, 0)
    const totalCredit = rows.reduce((s, r) => s + r.creditAmount, 0)
    return [
      { id: 'count', label: 'Ledger Entries', value: rows.length, accent: 'blue' },
      { id: 'debit', label: 'Total Debits', value: formatCompactCurrency(totalDebit), helper: formatCurrency(totalDebit), accent: 'green' },
      { id: 'credit', label: 'Total Credits', value: formatCompactCurrency(totalCredit), helper: formatCurrency(totalCredit), accent: 'amber' },
    ]
  }, [rows])

  if (!perms.canViewLedger) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Asset Ledger" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Ledger' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Ledger"
      description="Per-asset movement history — acquisition, capitalization, depreciation, transfer, revaluation and disposal entries."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Ledger' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/ledger"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="ledger" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner />
        <FixedAssetsSummaryCards items={kpis} columns={3} />

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search asset number, reference, narration…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Asset
            <Select wrapClassName="w-56" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">All assets</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.assetNumber} — {a.name}</option>)}
            </Select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Entry type
            <Select wrapClassName="w-44" value={entryType} onChange={(e) => setEntryType(e.target.value as AssetLedgerEntryType | '')}>
              <option value="">All types</option>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </label>
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={ScrollText} title="Could not load asset ledger" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={ScrollText} title="No ledger entries match" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Reference</th>
                      <th className="px-3 py-2 font-semibold">Narration</th>
                      <th className="px-3 py-2 text-right font-semibold">Debit</th>
                      <th className="px-3 py-2 text-right font-semibold">Credit</th>
                      <th className="px-3 py-2 text-right font-semibold">Running NBV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2">{formatDate(r.entryDate)}</td>
                        <td className="px-3 py-2 font-medium">{r.assetNumber}</td>
                        <td className="px-3 py-2">{r.entryType}</td>
                        <td className="px-3 py-2 font-mono">{r.reference}</td>
                        <td className="px-3 py-2 text-erp-muted">{r.narration}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.debitAmount > 0 ? formatCurrency(r.debitAmount) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.creditAmount > 0 ? formatCurrency(r.creditAmount) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(r.runningNBV)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </EnterpriseRegisterTableShell>
      </div>
    </OperationalPageShell>
  )
}
