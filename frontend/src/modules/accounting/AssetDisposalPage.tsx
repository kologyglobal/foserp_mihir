import { useCallback, useEffect, useState } from 'react'
import { Check, Eye, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  DisposalStatusBadge,
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { isApiMode } from '@/config/apiConfig'
import {
  completeDisposalDemo,
  createDisposalDemo,
  getAssets,
  getDisposals,
  postDisposal,
  previewDisposalGainLoss,
  FixedAssetsServiceError,
} from '@/services/accounting/fixedAssetsService'
import { listAccounts } from '@/services/bridges/financeApiBridge'
import { resolveDefaultLegalEntity } from '@/services/accounting/fixedAssetsApiComposer'
import type { AssetDisposal, DisposalGainLossPreview, DisposalType, FixedAsset } from '@/types/fixedAssets'
import { DISPOSAL_TYPES } from '@/types/fixedAssets'
import type { Account } from '@/types/financeSetup'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { amountTone, FIXED_ASSETS_BREADCRUMB } from './fixedAssetsUi'
import { cn } from '@/utils/cn'

const inputCls = 'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px]'
const labelCls = 'block text-[12px] font-medium text-erp-text'

const API_DISPOSAL_TYPES: DisposalType[] = ['Sale', 'Scrap', 'Write-off']

export function AssetDisposalPage() {
  const perms = useFixedAssetsPermissions()
  const api = isApiMode()
  const [rows, setRows] = useState<AssetDisposal[]>([])
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [cashAccounts, setCashAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [preview, setPreview] = useState<DisposalGainLossPreview | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [form, setForm] = useState({
    assetId: '',
    disposalType: 'Sale' as DisposalType,
    proceeds: '',
    disposeCostAmount: '',
    proceedsAccountId: '',
    buyerName: '',
    reason: '',
    disposalDate: new Date().toISOString().slice(0, 10),
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, assetList] = await Promise.all([
        getDisposals(),
        getAssets({ status: '' }),
      ])
      setRows(list)
      const eligible = assetList.filter((a) =>
        api
          ? ['Active', 'Idle', 'Fully Depreciated'].includes(a.status)
          : !['Disposed', 'Written Off', 'Sold'].includes(a.status),
      )
      setAssets(eligible)
      if (!form.assetId && eligible[0]) setForm((f) => ({ ...f, assetId: eligible[0].id }))

      if (api) {
        const le = await resolveDefaultLegalEntity()
        const accounts = await listAccounts(le.id)
        const proceedsEligible = accounts.filter(
          (a) => !a.isGroup && a.isActive && (a.accountType === 'CASH' || a.accountType === 'BANK' || a.category === 'ASSET'),
        )
        setCashAccounts(proceedsEligible)
        if (!form.proceedsAccountId && proceedsEligible[0]) {
          setForm((f) => ({ ...f, proceedsAccountId: proceedsEligible[0].id }))
        }
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [api, form.assetId, form.proceedsAccountId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const selectedAsset = assets.find((a) => a.id === form.assetId)
  const disposeCostNum = form.disposeCostAmount.trim() ? Number(form.disposeCostAmount) : undefined

  const handlePreview = async () => {
    if (!form.assetId) return
    setBusy(true)
    try {
      const result = await previewDisposalGainLoss(
        form.assetId,
        form.disposalType,
        Number(form.proceeds) || 0,
        disposeCostNum,
      )
      setPreview(result)
      notify.info(
        `${result.isPartial ? 'Partial ' : ''}${result.isGain ? 'Gain' : 'Loss'} of ${formatCurrency(Math.abs(result.gainLoss))} on disposal preview${api ? '' : ' (demo)'}.`,
      )
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!perms.canDispose) {
      notify.error('Permission denied')
      return
    }
    setBusy(true)
    try {
      if (api) {
        const proceeds = Number(form.proceeds) || 0
        if (form.disposalType === 'Sale' && proceeds <= 0) {
          notify.error('Sale disposal requires proceeds greater than zero')
          return
        }
        if (proceeds > 0 && !form.proceedsAccountId) {
          notify.error('Select a proceeds (cash/bank) account')
          return
        }
        if (!form.reason.trim()) {
          notify.error('Reason is required')
          return
        }
        if (
          disposeCostNum != null &&
          selectedAsset &&
          disposeCostNum >= selectedAsset.acquisitionCost
        ) {
          notify.error('Partial dispose cost must be less than acquisition cost (omit for full dispose).')
          return
        }
        const result = await postDisposal({
          assetId: form.assetId,
          disposalType: form.disposalType,
          proceeds,
          disposeCostAmount: disposeCostNum,
          proceedsAccountId: proceeds > 0 ? form.proceedsAccountId : undefined,
          buyerName: form.buyerName || undefined,
          reason: form.reason.trim(),
          disposalDate: form.disposalDate,
        })
        notify.success(
          result.idempotentReplay
            ? 'Disposal already posted (idempotent replay).'
            : result.isPartial
              ? `Partial disposal posted to GL. Asset remains active. Gain/loss ${formatCurrency(result.gainLoss)}.`
              : `Asset disposed and posted to GL. Gain/loss ${formatCurrency(result.gainLoss)}.`,
        )
      } else {
        await createDisposalDemo({
          assetId: form.assetId,
          disposalType: form.disposalType,
          proceeds: Number(form.proceeds) || 0,
          buyerName: form.buyerName || null,
          reason: form.reason || 'Demo disposal',
          disposalDate: form.disposalDate,
        })
        notify.success('Disposal draft created (demo).')
      }
      setShowForm(false)
      setPreview(null)
      setRefreshToken((n) => n + 1)
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : e instanceof Error ? e.message : 'Dispose failed')
    } finally {
      setBusy(false)
    }
  }

  const handleComplete = async (id: string) => {
    if (!perms.canDispose && !perms.canApproveDisposal) {
      notify.error('Permission denied')
      return
    }
    setBusy(true)
    try {
      await completeDisposalDemo(id)
      notify.success('Disposal completed in demo mode. Asset status updated — no GL journal created.')
      setRefreshToken((n) => n + 1)
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Complete failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Disposal" breadcrumbs={[...FIXED_ASSETS_BREADCRUMB, { label: 'Disposal' }]} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  const typeOptions = api ? API_DISPOSAL_TYPES : DISPOSAL_TYPES

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Disposal"
      description={
        api
          ? 'Full or partial disposal with GL posting — sale, scrap, or write-off (gain/loss via default mappings).'
          : 'Sale, scrap, write-off, theft/loss and exchange disposals with gain/loss preview.'
      }
      breadcrumbs={[...FIXED_ASSETS_BREADCRUMB, { label: 'Disposal' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/disposal"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canDispose ? { id: 'new', label: showForm ? 'Hide Form' : 'New Disposal', icon: Plus, variant: 'primary', onClick: () => setShowForm((v) => !v) } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="disposal" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant={api ? 'live' : 'partial'} />

        {showForm && perms.canDispose ? (
          <section className="rounded-md border border-erp-border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-semibold">{api ? 'Dispose asset (posts to GL)' : 'New disposal (demo)'}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelCls}>Asset
                <select className={inputCls} value={form.assetId} onChange={(e) => { setForm((f) => ({ ...f, assetId: e.target.value, disposeCostAmount: '' })); setPreview(null) }}>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.assetNumber} — {a.name}</option>)}
                </select>
              </label>
              <label className={labelCls}>Disposal type
                <select className={inputCls} value={form.disposalType} onChange={(e) => { setForm((f) => ({ ...f, disposalType: e.target.value as DisposalType })); setPreview(null) }}>
                  {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className={labelCls}>Disposal date<input type="date" className={inputCls} value={form.disposalDate} onChange={(e) => setForm((f) => ({ ...f, disposalDate: e.target.value }))} /></label>
              <label className={labelCls}>Proceeds (₹)<input type="number" className={inputCls} value={form.proceeds} onChange={(e) => { setForm((f) => ({ ...f, proceeds: e.target.value })); setPreview(null) }} placeholder="0" /></label>
              {api ? (
                <label className={labelCls}>
                  Dispose cost (₹) — optional partial
                  <input
                    type="number"
                    className={inputCls}
                    value={form.disposeCostAmount}
                    onChange={(e) => { setForm((f) => ({ ...f, disposeCostAmount: e.target.value })); setPreview(null) }}
                    placeholder={selectedAsset ? `Leave blank for full (${selectedAsset.acquisitionCost})` : 'Full disposal if blank'}
                  />
                </label>
              ) : null}
              {api && Number(form.proceeds) > 0 ? (
                <label className={labelCls}>Proceeds account
                  <select className={inputCls} value={form.proceedsAccountId} onChange={(e) => setForm((f) => ({ ...f, proceedsAccountId: e.target.value }))}>
                    {cashAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.accountCode} — {a.accountName}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {form.disposalType === 'Sale' ? (
                <label className={labelCls}>Buyer name<input className={inputCls} value={form.buyerName} onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))} /></label>
              ) : null}
              <label className={cn(labelCls, 'sm:col-span-2')}>Reason<input className={inputCls} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason for disposal" /></label>
            </div>

            {preview ? (
              <div className="mt-3 rounded-md border border-erp-border bg-erp-surface-alt/40 p-3 text-[12px]">
                <p className="font-semibold">
                  Gain/Loss preview — {preview.assetNumber}
                  {preview.isPartial ? ' (partial)' : ''}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <span>{preview.isPartial ? 'Disposed NBV' : 'NBV'}: {formatCurrency(preview.nbv)}</span>
                  <span>Proceeds: {formatCurrency(preview.proceeds)}</span>
                  <span className={cn('font-semibold', amountTone(preview.gainLoss))}>
                    {preview.isGain ? 'Gain' : 'Loss'}: {formatCurrency(Math.abs(preview.gainLoss))}
                  </span>
                  <span>Type: {preview.disposalType}</span>
                  {preview.isPartial && preview.remainingCost != null ? (
                    <span>Remaining cost: {formatCurrency(preview.remainingCost)}</span>
                  ) : null}
                  {preview.isPartial && preview.remainingNbv != null ? (
                    <span>Remaining NBV: {formatCurrency(preview.remainingNbv)}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" disabled={busy || !form.assetId} onClick={() => void handlePreview()}>
                <Eye className="mr-1 inline h-3.5 w-3.5" />Preview gain/loss
              </button>
              <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[12px]" disabled={busy} onClick={() => void handleCreate()}>
                {busy ? (api ? 'Posting…' : 'Creating…') : api ? 'Post disposal' : 'Create disposal draft'}
              </button>
              <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" onClick={() => { setShowForm(false); setPreview(null) }}>Cancel</button>
            </div>
          </section>
        ) : null}

        {loading ? <LoadingState variant="table" rows={8} /> : null}
        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Number</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Asset</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">NBV</th>
                <th className="px-3 py-2 text-right font-semibold">Proceeds</th>
                <th className="px-3 py-2 text-right font-semibold">Gain/Loss</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/40">
                  <td className="px-3 py-2 font-medium">{row.disposalNumber}</td>
                  <td className="px-3 py-2">{formatDate(row.disposalDate)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.assetName}</div>
                    <div className="text-erp-muted">{row.assetNumber}</div>
                  </td>
                  <td className="px-3 py-2">{row.disposalType}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.nbv)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.proceeds)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', amountTone(row.gainLoss))}>{formatCurrency(row.gainLoss)}</td>
                  <td className="px-3 py-2"><DisposalStatusBadge status={row.status} /></td>
                  <td className="px-3 py-2">
                    {!api && row.status !== 'Completed' && (perms.canDispose || perms.canApproveDisposal) ? (
                      <button type="button" className="erp-btn erp-btn-secondary h-8 px-2 text-[11px]" disabled={busy} onClick={() => void handleComplete(row.id)}>
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
          {rows.length === 0 && !loading ? <FixedAssetsEmptyState title="No disposals" /> : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
