import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackagePlus, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import {
  AssetStatusBadge,
  FixedAssetsDemoBanner,
  FixedAssetsDrawerShell,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import {
  createAcquisitionDemo,
  getAcquisitions,
  getCategories,
  FixedAssetsServiceError,
} from '@/services/accounting/fixedAssetsService'
import { isApiMode } from '@/config/apiConfig'
import type { AcquisitionType, AssetAcquisition, FixedAssetCategory } from '@/types/fixedAssets'
import { ACQUISITION_TYPES } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

const labelCls = 'mb-1 block text-[11px] font-semibold uppercase text-erp-muted'

function blankForm() {
  return {
    assetName: '',
    acquisitionType: 'Purchase' as AcquisitionType,
    categoryId: '',
    vendorName: '',
    poNumber: '',
    invoiceNumber: '',
    amount: '',
    gstAmount: '',
    location: 'Chakan Plant',
    plant: 'Chakan Plant',
    department: 'Production',
    notes: '',
  }
}

export function AssetAcquisitionPage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<AssetAcquisition[]>([])
  const [categories, setCategories] = useState<FixedAssetCategory[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AcquisitionType | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const [list, cats] = await Promise.all([getAcquisitions(), getCategories()])
      setRows(list)
      setCategories(cats)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const blob = `${r.acquisitionNumber} ${r.assetName} ${r.vendorName ?? ''} ${r.poNumber ?? ''}`.toLowerCase()
        if (!blob.includes(search.toLowerCase())) return false
      }
      if (typeFilter && r.acquisitionType !== typeFilter) return false
      return true
    })
  }, [rows, search, typeFilter])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const totalValue = rows.reduce((s, r) => s + r.totalAmount, 0)
    const pending = rows.filter((r) => r.status === 'Pending Capitalization' || r.status === 'Under Construction').length
    return [
      { id: 'count', label: 'Acquisitions', value: rows.length, accent: 'blue' },
      { id: 'value', label: 'Total Value', value: formatCompactCurrency(totalValue), helper: formatCurrency(totalValue), accent: 'slate' },
      { id: 'pending', label: 'Pending Capitalization', value: pending, accent: 'amber' },
    ]
  }, [rows])

  const openCreate = () => {
    setForm(blankForm())
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!form.assetName.trim()) {
      notify.error('Asset name is required.')
      return
    }
    const category = categories.find((c) => c.id === form.categoryId) ?? categories[0]
    const amount = Number(form.amount) || 0
    const gst = Number(form.gstAmount) || 0
    setBusy(true)
    try {
      const created = await createAcquisitionDemo({
        assetName: form.assetName,
        acquisitionType: form.acquisitionType,
        categoryId: category?.id,
        categoryName: category?.name,
        vendorName: form.vendorName || null,
        poNumber: form.poNumber || null,
        invoiceNumber: form.invoiceNumber || null,
        amount,
        gstAmount: gst,
        totalAmount: amount + gst,
        location: form.location,
        plant: form.plant,
        department: form.department,
        notes: form.notes || null,
      })
      notify.success(
        isApiMode()
          ? `Acquisition ${created.acquisitionNumber} created — pending capitalization.`
          : `Acquisition draft ${created.acquisitionNumber} created (demo).`,
      )
      setCreateOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canAcquire && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Acquisition" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Acquisition' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Acquisition"
      description="Capital purchase, CWIP and self-constructed asset acquisitions awaiting capitalization."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Acquisition' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/acquisition"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canAcquire ? { id: 'new', label: 'New Acquisition', icon: Plus, variant: 'primary', onClick: openCreate } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="acquisition" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        <FixedAssetsSummaryCards items={kpis} columns={3} />

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search acquisition number, asset, vendor, PO…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Type
            <Select wrapClassName="w-52" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AcquisitionType | '')}>
              <option value="">All types</option>
              {ACQUISITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </label>
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={PackagePlus} title="Could not load acquisitions" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={PackagePlus} title="No acquisitions match" description="Adjust filters or create a new acquisition." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[980px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Acquisition No</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Vendor</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Total Amount</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{r.acquisitionNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.assetName}</p>
                          <p className="text-[11px] text-erp-muted">{r.categoryName}</p>
                        </td>
                        <td className="px-3 py-2">{r.acquisitionType}</td>
                        <td className="px-3 py-2">{r.vendorName ?? '—'}</td>
                        <td className="px-3 py-2">{formatDate(r.acquisitionDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.totalAmount)}</td>
                        <td className="px-3 py-2"><AssetStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </EnterpriseRegisterTableShell>
      </div>

      <FixedAssetsDrawerShell
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Asset Acquisition"
        subtitle={
          isApiMode()
            ? 'Creates a live asset pending capitalization — capitalize from the Capitalization workspace'
            : 'Demo record — capitalize later from the Capitalization workspace'
        }
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void submitCreate()}>
              {busy ? 'Saving…' : 'Save acquisition'}
            </button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Asset name *</label>
            <Input value={form.assetName} onChange={(e) => setForm((f) => ({ ...f, assetName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Acquisition type *</label>
              <Select value={form.acquisitionType} onChange={(e) => setForm((f) => ({ ...f, acquisitionType: e.target.value as AcquisitionType }))}>
                {ACQUISITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <Select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Select category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vendor</label>
              <Input value={form.vendorName} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>PO number</label>
              <Input value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (₹, excl. GST)</label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            {!isApiMode() && (
              <div>
                <label className={labelCls}>GST amount (₹)</label>
                <Input type="number" min={0} step="0.01" value={form.gstAmount} onChange={(e) => setForm((f) => ({ ...f, gstAmount: e.target.value }))} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Location</label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Plant</label>
              <Input value={form.plant} onChange={(e) => setForm((f) => ({ ...f, plant: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </FixedAssetsDrawerShell>
    </OperationalPageShell>
  )
}
