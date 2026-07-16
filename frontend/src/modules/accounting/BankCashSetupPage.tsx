import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  BankCashDemoBanner,
  BankCashEmptyState,
  BankCashWorkspaceTabs,
} from '@/components/accounting/bankCash'
import { getBankCashSetup, updateBankCashSetupDemo, BankCashServiceError } from '@/services/accounting/bankCashService'
import type { BankCashSetup } from '@/types/bankCash'
import { TRANSFER_MODES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

const inputCls = 'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function BankCashSetupPage() {
  const perms = useBankCashPermissions()
  const [setup, setSetup] = useState<BankCashSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSetup(await getBankCashSetup())
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
      await updateBankCashSetupDemo(setup)
      notify.success('Bank & Cash setup saved (demo).')
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const setField = <K extends keyof BankCashSetup>(key: K, value: BankCashSetup[K]) => {
    setSetup((s) => (s ? { ...s, [key]: value } : s))
  }

  if (!perms.canManageSetup && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Bank & Cash Setup" breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Setup' }]} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank & Cash Setup"
      description="Company defaults for transfers, reconciliation tolerance and notifications (demo)."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Setup' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/setup"
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
      <BankCashWorkspaceTabs active="setup" />
      <div className="space-y-3 p-4">
        <BankCashDemoBanner />
        {loading ? <LoadingState variant="form" rows={8} /> : null}
        {setup ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">General</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>Company<input className={inputCls} value={setup.companyName} onChange={(e) => setField('companyName', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Default currency<input className={inputCls} value={setup.defaultCurrency} onChange={(e) => setField('defaultCurrency', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>FY start month<input type="number" min="1" max="12" className={inputCls} value={setup.financialYearStartMonth} onChange={(e) => setField('financialYearStartMonth', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Default transfer mode
                  <select className={inputCls} value={setup.defaultTransferMode} onChange={(e) => setField('defaultTransferMode', e.target.value as BankCashSetup['defaultTransferMode'])} disabled={!perms.canManageSetup}>
                    {TRANSFER_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Controls</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>Dual approval above (₹)<input type="number" className={inputCls} value={setup.requireDualApprovalAbove} onChange={(e) => setField('requireDualApprovalAbove', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Reconciliation tolerance (₹)<input type="number" className={inputCls} value={setup.reconciliationTolerance} onChange={(e) => setField('reconciliationTolerance', Number(e.target.value))} disabled={!perms.canManageSetup} /></label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.autoReconciliationEnabled} onChange={(e) => setField('autoReconciliationEnabled', e.target.checked)} disabled={!perms.canManageSetup} />
                  Enable auto-reconciliation suggestions
                </label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.allowNegativeCash} onChange={(e) => setField('allowNegativeCash', e.target.checked)} disabled={!perms.canManageSetup} />
                  Allow negative cash balances
                </label>
                <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                  <input type="checkbox" checked={setup.approvalWorkflowEnabled} onChange={(e) => setField('approvalWorkflowEnabled', e.target.checked)} disabled={!perms.canManageSetup} />
                  Fund transfer approval workflow
                </label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Number series</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={labelCls}>Fund transfer prefix<input className={inputCls} value={setup.fundTransferPrefix} onChange={(e) => setField('fundTransferPrefix', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Deposit slip prefix<input className={inputCls} value={setup.depositSlipPrefix} onChange={(e) => setField('depositSlipPrefix', e.target.value)} disabled={!perms.canManageSetup} /></label>
                <label className={labelCls}>Cheque series prefix<input className={inputCls} value={setup.chequeSeriesPrefix} onChange={(e) => setField('chequeSeriesPrefix', e.target.value)} disabled={!perms.canManageSetup} /></label>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Notifications</h3>
              <div className="space-y-2 text-[12px]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.notifyOnVariance} onChange={(e) => setField('notifyOnVariance', e.target.checked)} disabled={!perms.canManageSetup} />
                  Notify on cash variance
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={setup.notifyOnBouncedCheque} onChange={(e) => setField('notifyOnBouncedCheque', e.target.checked)} disabled={!perms.canManageSetup} />
                  Notify on bounced cheque
                </label>
                <p className="mt-2 text-[11px] text-erp-muted">Statement import formats: {setup.statementImportFormats.join(', ')}</p>
              </div>
            </section>
          </div>
        ) : (
          !loading ? <BankCashEmptyState title="Setup could not be loaded" /> : null
        )}
      </div>
    </OperationalPageShell>
  )
}
