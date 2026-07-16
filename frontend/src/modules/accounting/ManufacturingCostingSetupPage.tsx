import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingWorkspaceTabs,
} from '@/components/accounting/manufacturingAccounting'
import {
  getManufacturingCostingSetup,
  updateManufacturingCostingSetupDemo,
  ManufacturingAccountingServiceError,
} from '@/services/accounting/manufacturingAccountingService'
import type { ManufacturingCostingSetup, OverheadAllocationBasis } from '@/types/manufacturingAccounting'
import { COSTING_METHODS } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { notify } from '@/store/toastStore'
import { MFG_ACCOUNTING_BREADCRUMB, inputCls, labelCls, type LoadState } from './manufacturingAccountingUi'

const LABOUR_RATE_SOURCES: ManufacturingCostingSetup['labourRateSource'][] = [
  'Routing Master',
  'Payroll Average',
  'Manual',
]

const OVERHEAD_BASES: OverheadAllocationBasis[] = [
  'Machine Hours',
  'Labour Hours',
  'Material Value',
  'Units Produced',
]

export function ManufacturingCostingSetupPage() {
  const perms = useManufacturingAccountingPermissions()
  const [setup, setSetup] = useState<ManufacturingCostingSetup | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      setSetup(await getManufacturingCostingSetup())
      setLoadState('ready')
    } catch {
      setSetup(null)
      setLoadState('error')
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
      await updateManufacturingCostingSetupDemo(setup)
      notify.success('Manufacturing costing setup saved (demo).')
    } catch (e) {
      notify.error(e instanceof ManufacturingAccountingServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const setField = <K extends keyof ManufacturingCostingSetup>(key: K, value: ManufacturingCostingSetup[K]) => {
    setSetup((s) => (s ? { ...s, [key]: value } : s))
  }

  const readOnly = !perms.canManageSetup

  if (!perms.canManageSetup && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Costing Setup" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Costing Setup' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Manufacturing Costing Setup"
      description="Valuation method, GL account mapping and costing controls (demo)."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Costing Setup' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/setup"
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
      <ManufacturingAccountingWorkspaceTabs active="setup" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        {loadState === 'loading' ? <LoadingState variant="form" rows={8} /> : null}
        {setup ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">General</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>Company<input className={inputCls} value={setup.companyName} onChange={(e) => setField('companyName', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Default currency<input className={inputCls} value={setup.defaultCurrency} onChange={(e) => setField('defaultCurrency', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>FY start month<input type="number" min="1" max="12" className={inputCls} value={setup.financialYearStartMonth} onChange={(e) => setField('financialYearStartMonth', Number(e.target.value))} disabled={readOnly} /></label>
                <label className={labelCls}>Valuation method
                  <select className={inputCls} value={setup.valuationMethod} onChange={(e) => setField('valuationMethod', e.target.value as ManufacturingCostingSetup['valuationMethod'])} disabled={readOnly}>
                    {COSTING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className={labelCls}>Labour rate source
                  <select className={inputCls} value={setup.labourRateSource} onChange={(e) => setField('labourRateSource', e.target.value as ManufacturingCostingSetup['labourRateSource'])} disabled={readOnly}>
                    {LABOUR_RATE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className={labelCls}>Machine-hour rate (₹)<input type="number" className={inputCls} value={setup.machineHourRate} onChange={(e) => setField('machineHourRate', Number(e.target.value))} disabled={readOnly} /></label>
                <label className={`${labelCls} sm:col-span-2`}>Overhead allocation basis
                  <select className={inputCls} value={setup.overheadAllocationBasis} onChange={(e) => setField('overheadAllocationBasis', e.target.value as OverheadAllocationBasis)} disabled={readOnly}>
                    {OVERHEAD_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.standardCostingEnabled} onChange={(e) => setField('standardCostingEnabled', e.target.checked)} disabled={readOnly} />
                  Enable standard costing
                </label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">GL Accounts</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>WIP account<input className={inputCls} value={setup.wipAccount} onChange={(e) => setField('wipAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>FG account<input className={inputCls} value={setup.fgAccount} onChange={(e) => setField('fgAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Material consumption<input className={inputCls} value={setup.materialConsumptionAccount} onChange={(e) => setField('materialConsumptionAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Direct labour<input className={inputCls} value={setup.directLabourAccount} onChange={(e) => setField('directLabourAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Machine cost<input className={inputCls} value={setup.machineCostAccount} onChange={(e) => setField('machineCostAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Factory overhead<input className={inputCls} value={setup.factoryOverheadAccount} onChange={(e) => setField('factoryOverheadAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Scrap account<input className={inputCls} value={setup.scrapAccount} onChange={(e) => setField('scrapAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Production variance<input className={inputCls} value={setup.varianceAccount} onChange={(e) => setField('varianceAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>Purchase variance<input className={inputCls} value={setup.purchaseVarianceAccount} onChange={(e) => setField('purchaseVarianceAccount', e.target.value)} disabled={readOnly} /></label>
                <label className={labelCls}>COGS account<input className={inputCls} value={setup.cogsAccount} onChange={(e) => setField('cogsAccount', e.target.value)} disabled={readOnly} /></label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-2">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Controls & automation</h3>
              <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.autoPostFGReceipt} onChange={(e) => setField('autoPostFGReceipt', e.target.checked)} disabled={readOnly} />
                  Auto-post FG receipt to inventory & GL
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.autoAllocateOverhead} onChange={(e) => setField('autoAllocateOverhead', e.target.checked)} disabled={readOnly} />
                  Auto-allocate factory overhead monthly
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.requireCostSheetApproval} onChange={(e) => setField('requireCostSheetApproval', e.target.checked)} disabled={readOnly} />
                  Require cost sheet approval before use
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.scrapRecoveryEnabled} onChange={(e) => setField('scrapRecoveryEnabled', e.target.checked)} disabled={readOnly} />
                  Enable scrap recovery credit
                </label>
              </div>
            </section>
          </div>
        ) : (
          loadState !== 'loading' ? <ManufacturingAccountingEmptyState title="Setup could not be loaded" /> : null
        )}
      </div>
    </OperationalPageShell>
  )
}
