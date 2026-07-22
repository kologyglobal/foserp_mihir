import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Check, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import {
  FixedAssetsDemoBanner,
  FixedAssetsDrawerShell,
  FixedAssetsGenericStatusBadge,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { isApiMode } from '@/config/apiConfig'
import {
  completeTransfer,
  createTransfer,
  getAssets,
  getTransfers,
  FixedAssetsServiceError,
} from '@/services/accounting/fixedAssetsService'
import type { AssetTransfer, FixedAsset } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

const labelCls = 'mb-1 block text-[11px] font-semibold uppercase text-erp-muted'

function blankForm() {
  return {
    assetId: '',
    toLocation: '',
    toPlant: '',
    toDepartment: '',
    toCustodian: '',
    reason: '',
  }
}

export function AssetTransfersPage() {
  const perms = useFixedAssetsPermissions()
  const api = isApiMode()
  const [rows, setRows] = useState<AssetTransfer[]>([])
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const [list, assetList] = await Promise.all([getTransfers(), getAssets()])
      setRows(list)
      setAssets(
        assetList.filter((a) =>
          api
            ? ['Active', 'Idle', 'Fully Depreciated'].includes(a.status)
            : !['Disposed', 'Written Off', 'Sold'].includes(a.status),
        ),
      )
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      `${r.transferNumber} ${r.assetNumber} ${r.assetName} ${r.fromLocation} ${r.toLocation}`
        .toLowerCase()
        .includes(q),
    )
  }, [rows, search])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'Draft' || r.status === 'Pending Approval').length
    const completed = rows.filter((r) => r.status === 'Completed').length
    return [
      { id: 'count', label: 'Transfers', value: rows.length, accent: 'blue' },
      { id: 'pending', label: 'Pending', value: pending, accent: 'amber' },
      { id: 'completed', label: 'Completed', value: completed, accent: 'green' },
    ]
  }, [rows])

  const openCreate = () => {
    setForm(blankForm())
    setCreateOpen(true)
  }

  const selectedAsset = assets.find((a) => a.id === form.assetId)

  const submitCreate = async () => {
    if (!form.assetId) {
      notify.error('Select an asset to transfer.')
      return
    }
    if (!form.reason.trim()) {
      notify.error('Reason is required.')
      return
    }
    if (!form.toLocation && !form.toPlant && !form.toDepartment && !form.toCustodian) {
      notify.error('Enter at least one destination field.')
      return
    }
    setBusy(true)
    try {
      const created = await createTransfer({
        assetId: form.assetId,
        toLocation: form.toLocation || undefined,
        toPlant: form.toPlant || undefined,
        toDepartment: form.toDepartment || undefined,
        toCustodian: form.toCustodian || undefined,
        reason: form.reason,
      })
      notify.success(
        api
          ? `Transfer draft ${created.transferNumber} created. Complete it to update the asset location.`
          : `Transfer draft ${created.transferNumber} created (demo).`,
      )
      setCreateOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const handleComplete = async (id: string) => {
    if (!perms.canTransfer) {
      notify.error('Permission denied')
      return
    }
    setBusy(true)
    try {
      const completed = await completeTransfer(id)
      notify.success(
        api
          ? `Transfer ${completed.transferNumber} completed — asset location updated (no GL).`
          : `Transfer ${completed.transferNumber} completed in demo.`,
      )
      await load()
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Complete failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canTransfer && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Transfers" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Transfers' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Transfers"
      description={
        api
          ? 'Intra–legal-entity location / plant / department / custodian moves — no GL posting.'
          : 'Inter-plant / inter-department asset relocation and custodian changes.'
      }
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Transfers' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/transfers"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canTransfer ? { id: 'new', label: 'New Transfer', icon: Plus, variant: 'primary', onClick: openCreate } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="transfers" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant={api ? 'live' : 'partial'} />
        <FixedAssetsSummaryCards items={kpis} columns={3} />

        <div className="min-w-[220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search transfer number, asset, location…" />
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={ArrowRightLeft} title="Could not load transfers" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={ArrowRightLeft} title="No transfers match" description="Create a new transfer to relocate an asset." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Transfer No</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">From</th>
                      <th className="px-3 py-2 font-semibold">To</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{r.transferNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.assetNumber}</p>
                          <p className="text-[11px] text-erp-muted">{r.assetName}</p>
                        </td>
                        <td className="px-3 py-2 text-erp-muted">{r.fromLocation}</td>
                        <td className="px-3 py-2">{r.toLocation}</td>
                        <td className="px-3 py-2">{formatDate(r.transferDate)}</td>
                        <td className="px-3 py-2"><FixedAssetsGenericStatusBadge status={r.status} /></td>
                        <td className="px-3 py-2">
                          {r.status === 'Draft' && perms.canTransfer ? (
                            <button
                              type="button"
                              className="erp-btn erp-btn-secondary h-8 px-2 text-[11px]"
                              disabled={busy}
                              onClick={() => void handleComplete(r.id)}
                            >
                              <Check className="mr-1 inline h-3.5 w-3.5" />Complete
                            </button>
                          ) : (
                            <span className="text-erp-muted">—</span>
                          )}
                        </td>
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
        title="New Asset Transfer"
        subtitle={api ? 'Draft transfer — complete to update register location (no GL)' : 'Demo record — does not post to the live ledger'}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void submitCreate()}>
              {busy ? 'Saving…' : 'Save transfer'}
            </button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Asset *</label>
            <Select value={form.assetId} onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}>
              <option value="">Select asset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.assetNumber} — {a.name}</option>
              ))}
            </Select>
          </div>
          {selectedAsset ? (
            <p className="rounded-md border border-erp-border bg-erp-surface px-3 py-2 text-[12px] text-erp-muted">
              Currently at <span className="font-medium text-erp-text">{selectedAsset.location}</span> · {selectedAsset.department} · Custodian {selectedAsset.custodian}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>To location</label>
              <Input placeholder={selectedAsset?.location} value={form.toLocation} onChange={(e) => setForm((f) => ({ ...f, toLocation: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>To plant</label>
              <Input placeholder={selectedAsset?.plant} value={form.toPlant} onChange={(e) => setForm((f) => ({ ...f, toPlant: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>To department</label>
              <Input placeholder={selectedAsset?.department} value={form.toDepartment} onChange={(e) => setForm((f) => ({ ...f, toDepartment: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>To custodian</label>
              <Input placeholder={selectedAsset?.custodian} value={form.toCustodian} onChange={(e) => setForm((f) => ({ ...f, toCustodian: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Reason *</label>
            <Textarea rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
      </FixedAssetsDrawerShell>
    </OperationalPageShell>
  )
}
