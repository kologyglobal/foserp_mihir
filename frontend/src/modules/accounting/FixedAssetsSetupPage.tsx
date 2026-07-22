import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getSetup, updateSetupDemo, FixedAssetsServiceError } from '@/services/accounting/fixedAssetsService'
import type { FixedAssetsSetup } from '@/types/fixedAssets'
import { DEPRECIATION_METHODS } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { notify } from '@/store/toastStore'
import { FIXED_ASSETS_BREADCRUMB } from './fixedAssetsUi'

const inputCls = 'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function FixedAssetsSetupPage() {
  const perms = useFixedAssetsPermissions()
  const [setup, setSetup] = useState<FixedAssetsSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSetup(await getSetup())
    } catch {
      setSetup(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!setup || !perms.canManageSetup) {
      notify.error('Permission denied')
      return
    }
    setBusy(true)
    try {
      await updateSetupDemo(setup)
      notify.success('Fixed Assets setup saved (demo).')
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const setField = <K extends keyof FixedAssetsSetup>(key: K, value: FixedAssetsSetup[K]) => {
    setSetup((s) => (s ? { ...s, [key]: value } : s))
  }

  if (!perms.canManageSetup && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Fixed Assets Setup" breadcrumbs={[...FIXED_ASSETS_BREADCRUMB, { label: 'Setup' }]} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Fixed Assets Setup"
      description="Company defaults for numbering, depreciation cadence, verification frequency and approvals (demo)."
      breadcrumbs={[...FIXED_ASSETS_BREADCRUMB, { label: 'Setup' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/setup"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canManageSetup ? { id: 'save', label: busy ? 'Saving…' : 'Save Setup', icon: Save, variant: 'primary', disabled: busy || !setup, onClick: () => void save() } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="setup" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        {loading ? <LoadingState variant="form" rows={8} /> : null}
        {setup ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">General</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>Company<input className={inputCls} value={setup.companyName} onChange={(e) => setField('companyName', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Default currency<input className={inputCls} value={setup.defaultCurrency} onChange={(e) => setField('defaultCurrency', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>FY start month<input type="number" min="1" max="12" className={inputCls} value={setup.financialYearStartMonth} onChange={(e) => setField('financialYearStartMonth', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Asset number prefix<input className={inputCls} value={setup.assetNumberPrefix} onChange={(e) => setField('assetNumberPrefix', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Default depreciation method
                  <select className={inputCls} value={setup.defaultDepreciationMethod} onChange={(e) => setField('defaultDepreciationMethod', e.target.value as FixedAssetsSetup['defaultDepreciationMethod'])} disabled={!perms.canManageSetup}>
                    {DEPRECIATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Depreciation & controls</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>Depreciation run day<input type="number" min="1" max="31" className={inputCls} value={setup.depreciationRunDay} onChange={(e) => setField('depreciationRunDay', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Dual approval above (₹)<input type="number" className={inputCls} value={setup.requireDualApprovalAbove} onChange={(e) => setField('requireDualApprovalAbove', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Verification frequency (months)<input type="number" min="1" className={inputCls} value={setup.physicalVerificationFrequencyMonths} onChange={(e) => setField('physicalVerificationFrequencyMonths', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.autoDepreciationEnabled} onChange={(e) => setField('autoDepreciationEnabled', e.target.checked)} disabled={!perms.canManageSetup} />
                  Enable automatic monthly depreciation run
                </label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.allowNegativeNBV} onChange={(e) => setField('allowNegativeNBV', e.target.checked)} disabled={!perms.canManageSetup} />
                  Allow negative net book value
                </label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.capitalizeFromCWIP} onChange={(e) => setField('capitalizeFromCWIP', e.target.checked)} disabled={!perms.canManageSetup} />
                  Allow capitalization directly from Capital WIP
                </label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.approvalWorkflowEnabled} onChange={(e) => setField('approvalWorkflowEnabled', e.target.checked)} disabled={!perms.canManageSetup} />
                  Approval workflow enabled
                </label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-2">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Notifications</h3>
              <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.notifyOnVerificationDue} onChange={(e) => setField('notifyOnVerificationDue', e.target.checked)} disabled={!perms.canManageSetup} />
                  Notify when physical verification is due
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.notifyOnInsuranceExpiry} onChange={(e) => setField('notifyOnInsuranceExpiry', e.target.checked)} disabled={!perms.canManageSetup} />
                  Notify on insurance policy expiry
                </label>
              </div>
            </section>
          </div>
        ) : (
          !loading ? <FixedAssetsEmptyState title="Setup could not be loaded" /> : null
        )}
      </div>
    </OperationalPageShell>
  )
}
