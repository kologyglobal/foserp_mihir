import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Rocket } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import {
  activateFinance,
  activateFinancialYear,
  applyCoaTemplate,
  generatePeriods,
  getSetupStatus,
  listFinancialYears,
  listLegalEntities,
} from '@/services/bridges/financeApiBridge'
import { COA_TEMPLATE_LABELS, type CoaTemplateId, type SetupStatus } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'

const STEPS = [
  { id: 1, title: 'Welcome', body: 'Set up your company accounts in a few guided steps.' },
  { id: 2, title: 'Legal Entity', route: '/accounting/settings/legal-entities' },
  { id: 3, title: 'Branch', route: '/accounting/settings/branches' },
  { id: 4, title: 'Financial Year', route: '/accounting/settings/financial-years' },
  { id: 5, title: 'Periods', action: 'generatePeriods' },
  { id: 6, title: 'Chart of Accounts', action: 'applyTemplate' },
  { id: 7, title: 'Account Mapping', route: '/accounting/settings/default-mappings' },
  { id: 8, title: 'Number Series', route: '/accounting/settings/number-series' },
  { id: 9, title: 'Review & Activate', action: 'review' },
] as const

export function FinanceSetupWizardPage() {
  const navigate = useNavigate()
  const perms = useFinancePermissions()
  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [templateId, setTemplateId] = useState<CoaTemplateId>('MANUFACTURING')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [entityName, setEntityName] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [st, entities] = await Promise.all([getSetupStatus(), listLegalEntities()])
      setStatus(st)
      setEntityName(entities.find((e) => e.isDefault)?.displayName ?? entities[0]?.displayName ?? '')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load wizard status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void refresh()
  }, [perms.canView, refresh])

  const current = STEPS[step - 1]

  const runStepAction = async () => {
    if (!current || !('action' in current) || !current.action) return
    setBusy(true)
    try {
      if (current.action === 'generatePeriods') {
        const years = await listFinancialYears()
        const draft = years.find((y) => y.status === 'DRAFT') ?? years[0]
        if (!draft) {
          notify.error('Create a financial year first.')
          navigate('/accounting/settings/financial-years')
          return
        }
        if (draft.status !== 'ACTIVE') await activateFinancialYear(draft.id)
        await generatePeriods(draft.id)
        notify.success('Monthly periods generated.')
      } else if (current.action === 'applyTemplate') {
        const res = await applyCoaTemplate(templateId)
        notify.success(res.applied ? `Applied ${COA_TEMPLATE_LABELS[templateId]} template.` : 'Chart of accounts already exists.')
      } else if (current.action === 'review') {
        await refresh()
        return
      }
      await refresh()
      setStep((s) => Math.min(s + 1, STEPS.length))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Step failed')
    } finally {
      setBusy(false)
    }
  }

  const handleActivate = async () => {
    setBusy(true)
    try {
      await activateFinance()
      notify.success('Finance activated successfully.')
      setConfirmOpen(false)
      navigate('/accounting/settings')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView) {
    return (
      <FinanceSettingsShell title="Setup Wizard">
        <p className="text-[13px] text-erp-muted">You do not have permission to view finance setup.</p>
      </FinanceSettingsShell>
    )
  }

  return (
    <FinanceSettingsShell title="Setup Wizard" description={`Guided setup for ${entityName || 'your company'}.`}>
      {loading ? <LoadingState variant="form" /> : null}
      {!loading ? (
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
            <span>
              Step {step} of {STEPS.length}
            </span>
            <span>{current?.title}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-erp-surface-alt">
            <div className="h-full bg-erp-primary transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
          </div>

          <section className="rounded-md border border-erp-border p-4">
            {step === 1 ? (
              <>
                <h2 className="text-[15px] font-semibold text-erp-text">Set up your company accounts</h2>
                <p className="mt-2 text-[13px] text-erp-muted">
                  Configure legal entity, branches, financial year, chart of accounts, and posting defaults before activating finance.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-erp-text">
                  <li>India-oriented defaults (INR, Apr–Mar FY)</li>
                  <li>Manufacturing CoA template available</li>
                  <li>Demo mode stores data locally until API is enabled</li>
                </ul>
              </>
            ) : null}

            {step >= 2 && step <= 4 && 'route' in current && current.route ? (
              <>
                <p className="text-[13px] text-erp-muted">
                  Open the {current.title} page to add or review records, then return here to continue.
                </p>
                <Link to={current.route} className="mt-3 inline-block text-[12px] font-semibold text-erp-primary hover:underline">
                  Open {current.title} →
                </Link>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <p className="text-[13px] text-erp-muted">Generate 12 monthly accounting periods for the active financial year.</p>
                <ErpButton className="mt-3" size="sm" onClick={() => void runStepAction()} disabled={busy || !perms.canManagePeriod}>
                  Generate Periods
                </ErpButton>
              </>
            ) : null}

            {step === 6 ? (
              <>
                <p className="mb-2 text-[13px] text-erp-muted">Apply a starter chart of accounts template.</p>
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value as CoaTemplateId)} className="max-w-sm">
                  {(Object.keys(COA_TEMPLATE_LABELS) as CoaTemplateId[]).map((id) => (
                    <option key={id} value={id}>
                      {COA_TEMPLATE_LABELS[id]}
                    </option>
                  ))}
                </Select>
                <ErpButton className="mt-3" size="sm" onClick={() => void runStepAction()} disabled={busy || !perms.canManageCoa}>
                  Apply Template
                </ErpButton>
              </>
            ) : null}

            {step === 7 || step === 8 ? (
              <>
                <p className="text-[13px] text-erp-muted">Complete {current.title} configuration on the dedicated page.</p>
                {'route' in current && current.route ? (
                  <Link to={current.route} className="mt-3 inline-block text-[12px] font-semibold text-erp-primary hover:underline">
                    Open {current.title} →
                  </Link>
                ) : null}
              </>
            ) : null}

            {step === 9 ? (
              <>
                <p className="text-[13px] text-erp-muted">
                  {status?.ready
                    ? 'All required steps are complete. Activate finance to enable posting.'
                    : `${status?.missing.length ?? 0} required item(s) still missing.`}
                </p>
                {status?.missing.length ? (
                  <ul className="mt-2 space-y-1 text-[12px] text-erp-text">
                    {status.missing.map((m) => (
                      <li key={m.key}>
                        <Link to={m.route} className="text-erp-primary hover:underline">
                          {m.label} ({m.count})
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {status?.ready && perms.canActivate ? (
                  <ErpButton className="mt-3" size="sm" variant="primary" onClick={() => setConfirmOpen(true)} disabled={busy}>
                    <Rocket className="mr-1 h-3.5 w-3.5" />
                    Activate Finance
                  </ErpButton>
                ) : null}
              </>
            ) : null}
          </section>

          <div className="flex justify-between">
            <ErpButton size="sm" variant="outline" disabled={step <= 1 || busy} onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </ErpButton>
            {step < STEPS.length ? (
              <ErpButton
                size="sm"
                onClick={() => {
                  if ('action' in current && current.action && step !== 7 && step !== 8) void runStepAction()
                  else setStep((s) => s + 1)
                }}
                disabled={busy}
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </ErpButton>
            ) : (
              <Link to="/accounting/settings">
                <ErpButton size="sm" variant="outline">
                  Finish
                </ErpButton>
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title="Activate finance?"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleActivate()} disabled={busy}>
              Activate
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-erp-muted">Confirm activation for {entityName}.</p>
      </Modal>
    </FinanceSettingsShell>
  )
}
