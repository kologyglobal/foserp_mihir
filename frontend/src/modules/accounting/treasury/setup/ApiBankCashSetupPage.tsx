import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw, Save, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { FormField } from '@/components/forms/FormField'
import { Checkbox, Input, Select } from '@/components/forms/Inputs'
import { AppLink } from '@/components/ui/AppLink'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { getFinanceSettings, saveFinanceSettings, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { FinanceSettings } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from '../../bankCashUi'

type LoadState = 'loading' | 'ready' | 'error'

/** Treasury-related FinanceSettings fields managed from this page. */
const TREASURY_FIELDS = [
  'bankChargeTolerance',
  'treasuryTransferBankBalancePolicy',
  'treasuryTransferRequireInTransit',
  'treasuryTransferInTransitThreshold',
  'treasuryTransferApprovalLimit',
  'treasuryTransferPreventSelfApprove',
  'treasuryTransferPreventDispatcherReceive',
  'treasuryChequeApprovalLimit',
  'treasuryChequePreventSelfApprove',
  'treasuryChequeRequireCounterpartAccount',
  'useTreasuryAdjustmentsForStatementItems',
  'treasuryAdjustmentApprovalLimit',
  'treasuryAdjustmentPreventSelfApprove',
] as const satisfies ReadonlyArray<keyof FinanceSettings>

const RELATED_LINKS = [
  { label: 'Bank accounts register', to: '/accounting/bank-cash/bank-accounts', hint: 'Create and manage BANK treasury accounts with GL mapping.' },
  { label: 'Cash accounts register', to: '/accounting/bank-cash/cash-accounts', hint: 'Create and manage CASH treasury accounts and custodians.' },
  { label: 'Number series', to: '/accounting/settings/number-series', hint: 'Document numbering for transfers, cheques and adjustments.' },
  { label: 'Account mapping', to: '/accounting/settings/default-mappings', hint: 'Default GL accounts used by treasury postings.' },
  { label: 'Statement mapping templates', to: '/accounting/bank-cash/mapping-templates', hint: 'Column mappings for bank statement imports.' },
  { label: 'Bank posting rules', to: '/accounting/bank-cash/posting-rules', hint: 'Rules that classify statement lines into bank transactions.' },
]

function numberOrNull(value: string): number | null {
  return value === '' ? null : Number(value)
}

export function ApiBankCashSetupPage() {
  const financePerms = useFinancePermissions()
  const bankCashPerms = useBankCashPermissions()
  const canManage = financePerms.canManage && bankCashPerms.canManageSetup
  const legalEntityId = useMemo(() => {
    try {
      return resolveLegalEntityId()
    } catch {
      return ''
    }
  }, [])

  const [settings, setSettings] = useState<FinanceSettings | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!legalEntityId) {
      setError('Select a legal entity before opening Bank & Cash setup.')
      setLoadState('error')
      return
    }
    setLoadState('loading')
    setError('')
    try {
      setSettings(await getFinanceSettings(legalEntityId))
      setLoadState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Bank & Cash setup')
      setLoadState('error')
    }
  }, [legalEntityId])

  useEffect(() => {
    void load()
  }, [load])

  const setField = <K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  const save = async () => {
    if (!settings || !canManage) return
    setBusy(true)
    try {
      const payload: Record<string, unknown> = { legalEntityId: settings.legalEntityId }
      for (const key of TREASURY_FIELDS) {
        if (settings[key] !== undefined) payload[key] = settings[key]
      }
      const saved = await saveFinanceSettings(payload)
      setSettings(saved)
      notify.success('Bank & Cash setup saved.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (!financePerms.canView && !bankCashPerms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank & Cash Setup"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Setup' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view Bank & Cash setup." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank & Cash Setup"
      description="Live treasury policies for fund transfers, cheques and statement-led bank transactions."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Setup' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/setup"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canManage
              ? { id: 'save', label: busy ? 'Saving…' : 'Save Setup', icon: Save, variant: 'primary', disabled: busy || !settings, onClick: () => void save() }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="setup" />
      <div className="space-y-3 p-4">
        {loadState === 'loading' ? <LoadingState variant="form" rows={8} /> : null}
        {loadState === 'error' ? (
          <EmptyState icon={ShieldOff} title="Setup could not be loaded" description={error} />
        ) : null}
        {loadState === 'ready' && settings ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Fund transfers</h3>
              <p className="mb-3 text-[12px] text-erp-muted">Controls applied when creating, approving and dispatching treasury transfers.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Bank balance policy" hint="Behaviour when the source bank balance is insufficient.">
                  <Select
                    value={settings.treasuryTransferBankBalancePolicy ?? 'WARN'}
                    onChange={(e) => setField('treasuryTransferBankBalancePolicy', e.target.value as FinanceSettings['treasuryTransferBankBalancePolicy'])}
                    disabled={!canManage}
                  >
                    <option value="ALLOW">Allow — post regardless of balance</option>
                    <option value="WARN">Warn — flag but allow posting</option>
                    <option value="BLOCK">Block — reject when insufficient</option>
                  </Select>
                </FormField>
                <FormField label="Approval limit (base currency)" hint="Blank = no amount-based approval limit.">
                  <Input
                    type="number"
                    min={0}
                    value={settings.treasuryTransferApprovalLimit ?? ''}
                    onChange={(e) => setField('treasuryTransferApprovalLimit', numberOrNull(e.target.value))}
                    disabled={!canManage}
                    placeholder="Blank = no limit"
                  />
                </FormField>
                <FormField label="In-transit threshold (base currency)" hint="Transfers above this amount are forced through IN_TRANSIT.">
                  <Input
                    type="number"
                    min={0}
                    value={settings.treasuryTransferInTransitThreshold ?? ''}
                    onChange={(e) => setField('treasuryTransferInTransitThreshold', numberOrNull(e.target.value))}
                    disabled={!canManage}
                    placeholder="Blank = no threshold"
                  />
                </FormField>
                <div className="space-y-2 sm:pt-6">
                  <Checkbox
                    label="Always route transfers via in-transit"
                    checked={settings.treasuryTransferRequireInTransit ?? false}
                    onChange={(e) => setField('treasuryTransferRequireInTransit', e.target.checked)}
                    disabled={!canManage}
                  />
                  <Checkbox
                    label="Prevent self-approval (maker-checker)"
                    checked={settings.treasuryTransferPreventSelfApprove ?? true}
                    onChange={(e) => setField('treasuryTransferPreventSelfApprove', e.target.checked)}
                    disabled={!canManage}
                  />
                  <Checkbox
                    label="Dispatcher cannot confirm receipt"
                    checked={settings.treasuryTransferPreventDispatcherReceive ?? true}
                    onChange={(e) => setField('treasuryTransferPreventDispatcherReceive', e.target.checked)}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Cheque management</h3>
              <p className="mb-3 text-[12px] text-erp-muted">Controls for issued and received cheques in the cheque register.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Approval limit (base currency)" hint="Blank = no amount-based approval limit.">
                  <Input
                    type="number"
                    min={0}
                    value={settings.treasuryChequeApprovalLimit ?? ''}
                    onChange={(e) => setField('treasuryChequeApprovalLimit', numberOrNull(e.target.value))}
                    disabled={!canManage}
                    placeholder="Blank = no limit"
                  />
                </FormField>
                <div className="space-y-2 sm:pt-6">
                  <Checkbox
                    label="Prevent self-approval (maker-checker)"
                    checked={settings.treasuryChequePreventSelfApprove ?? true}
                    onChange={(e) => setField('treasuryChequePreventSelfApprove', e.target.checked)}
                    disabled={!canManage}
                  />
                  <Checkbox
                    label="Require counterpart GL account before lifecycle posting"
                    checked={settings.treasuryChequeRequireCounterpartAccount ?? true}
                    onChange={(e) => setField('treasuryChequeRequireCounterpartAccount', e.target.checked)}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Bank transactions &amp; statements</h3>
              <p className="mb-3 text-[12px] text-erp-muted">Statement-led bank charges, interest and direct debits/credits.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Adjustment approval limit (base currency)" hint="Blank = no amount-based limit (type-based rules still apply).">
                  <Input
                    type="number"
                    min={0}
                    value={settings.treasuryAdjustmentApprovalLimit ?? ''}
                    onChange={(e) => setField('treasuryAdjustmentApprovalLimit', numberOrNull(e.target.value))}
                    disabled={!canManage}
                    placeholder="Blank = no limit"
                  />
                </FormField>
                <FormField label="Bank charge tolerance (base currency)" hint="Auto-accepted difference for bank charges during reconciliation.">
                  <Input
                    type="number"
                    min={0}
                    value={settings.bankChargeTolerance ?? ''}
                    onChange={(e) => setField('bankChargeTolerance', numberOrNull(e.target.value))}
                    disabled={!canManage}
                    placeholder="Blank = none"
                  />
                </FormField>
                <div className="space-y-2 sm:col-span-2">
                  <Checkbox
                    label="Create bank transactions from statement lines (treasury adjustments)"
                    checked={settings.useTreasuryAdjustmentsForStatementItems ?? true}
                    onChange={(e) => setField('useTreasuryAdjustmentsForStatementItems', e.target.checked)}
                    disabled={!canManage}
                  />
                  <Checkbox
                    label="Prevent self-approval of treasury adjustments"
                    checked={settings.treasuryAdjustmentPreventSelfApprove ?? true}
                    onChange={(e) => setField('treasuryAdjustmentPreventSelfApprove', e.target.checked)}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-md border border-erp-border bg-white p-4">
              <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">Related setup</h3>
              <p className="mb-3 text-[12px] text-erp-muted">
                Accounts, numbering and mapping used by live treasury are managed in their own registers.
              </p>
              <ul className="space-y-2">
                {RELATED_LINKS.map((link) => (
                  <li key={link.to} className="flex items-start gap-2">
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-erp-muted" />
                    <div>
                      <AppLink to={link.to} className="text-[13px] font-medium text-erp-primary hover:underline">
                        {link.label}
                      </AppLink>
                      <p className="text-[12px] text-erp-muted">{link.hint}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
