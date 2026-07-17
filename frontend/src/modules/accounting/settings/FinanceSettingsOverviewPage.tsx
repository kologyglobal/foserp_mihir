import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Rocket, RefreshCw } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/design-system/components/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { activateFinance, getSetupStatus } from '@/services/bridges/financeApiBridge'
import type { SetupMissingItem, SetupStatus } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'
import { SetupCard } from './financeSettingsShared'

const CARD_DEFS: Array<{
  key: string
  title: string
  description: string
  route: string
  optional?: boolean
}> = [
  {
    key: 'DEFAULT_LEGAL_ENTITY',
    title: 'Company / Legal Entity',
    description: 'Register your company with PAN, GSTIN, and fiscal year start.',
    route: '/accounting/settings/legal-entities',
  },
  {
    key: 'DEFAULT_BRANCH',
    title: 'Branches',
    description: 'Add at least one active branch (Head Office) for GST and operations.',
    route: '/accounting/settings/branches',
  },
  {
    key: 'ACTIVE_FINANCIAL_YEAR',
    title: 'Financial Year',
    description: 'Create and activate the current financial year (Apr–Mar for India).',
    route: '/accounting/settings/financial-years',
  },
  {
    key: 'ACCOUNTING_PERIODS',
    title: 'Accounting Periods',
    description: 'Generate monthly periods for the active financial year.',
    route: '/accounting/settings/periods',
  },
  {
    key: 'CHART_OF_ACCOUNTS',
    title: 'Chart of Accounts',
    description: 'Set up account groups and ledgers for posting.',
    route: '/accounting/settings/chart-of-accounts',
  },
  {
    key: 'DEFAULT_ACCOUNT_MAPPING',
    title: 'Default Account Mapping',
    description: 'Map receivables, payables, GST, and other system accounts.',
    route: '/accounting/settings/default-mappings',
  },
  {
    key: 'CODE_SERIES',
    title: 'Voucher Number Series',
    description: 'Configure prefixes for journals, receipts, payments, and more.',
    route: '/accounting/settings/number-series',
  },
  {
    key: 'COST_CENTRES',
    title: 'Cost Centres',
    description: 'Optional dimension for departmental or production costing.',
    route: '/accounting/settings/cost-centres',
    optional: true,
  },
  {
    key: 'APPROVALS',
    title: 'Approval Rules',
    description: 'Optional voucher approval thresholds by document type.',
    route: '/accounting/settings/approval-rules',
    optional: true,
  },
]

function cardStatus(
  def: (typeof CARD_DEFS)[number],
  missing: SetupMissingItem[],
  activated: boolean,
): 'complete' | 'incomplete' | 'attention' | 'optional' {
  if (def.optional) return 'optional'
  if (activated) return 'complete'
  const hit = missing.find((m) => m.key === def.key)
  if (!hit) return 'complete'
  return hit.count > 0 ? 'incomplete' : 'attention'
}

export function FinanceSettingsOverviewPage() {
  const perms = useFinancePermissions()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [activating, setActivating] = useState(false)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view finance setup.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setStatus(await getSetupStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load setup status')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const missingKeys = useMemo(() => new Set(status?.missing.map((m) => m.key) ?? []), [status])

  const handleActivate = async () => {
    setActivating(true)
    try {
      await activateFinance()
      notify.success('Finance activated — you can now post vouchers.')
      setConfirmOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Activation failed')
    } finally {
      setActivating(false)
    }
  }

  return (
    <FinanceSettingsShell
      title="Finance Setup Overview"
      commandBar={
        <ErpCommandBar
          primaryAction={{ id: 'wizard', label: 'Setup Wizard', onClick: () => {} }}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        >
          <Link to="/accounting/settings/setup">
            <ErpButton variant="primary" size="sm">
              Setup Wizard
            </ErpButton>
          </Link>
        </ErpCommandBar>
      }
      actions={
        status?.financeActivated ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Finance activated
          </span>
        ) : perms.canActivate && status?.ready ? (
          <ErpButton variant="primary" size="sm" onClick={() => setConfirmOpen(true)}>
            <Rocket className="mr-1 h-3.5 w-3.5" />
            Activate Finance
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && error ? (
        <EmptyState icon={RefreshCw} title="Unable to load setup" description={error} primaryAction={{ label: 'Retry', onClick: () => void load() }} />
      ) : null}
      {!loading && !error && status ? (
        <div className="space-y-4">
          <div className="rounded-md border border-erp-border bg-erp-surface-alt px-4 py-3">
            <p className="text-[13px] text-erp-text">
              {status.financeActivated
                ? 'Your finance module is active. Review settings below or open the wizard to adjust configuration.'
                : status.ready
                  ? 'All required setup steps are complete. Activate finance to enable voucher posting.'
                  : `${status.missing.length} required step${status.missing.length === 1 ? '' : 's'} remaining before activation.`}
            </p>
          </div>
          <SetupCard
            title="Ledger engine"
            description="Core ledger tables and validators are in place. Voucher posting arrives in the next phase."
            status="complete"
            action={
              <span className="text-[12px] font-semibold text-emerald-700">
                Foundation ready — posting available in the next phase
              </span>
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CARD_DEFS.map((def) => {
              const st = cardStatus(def, status.missing, status.financeActivated)
              const missing = status.missing.find((m) => m.key === def.key)
              return (
                <SetupCard
                  key={def.key}
                  title={def.title}
                  description={def.description}
                  status={st}
                  action={
                    !status.financeActivated || def.optional ? (
                      <Link
                        to={def.route}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-erp-primary hover:underline"
                      >
                        {missing ? `Complete (${missing.count})` : 'Review'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null
                  }
                />
              )
            })}
          </div>
          {!status.financeActivated && missingKeys.size > 0 ? (
            <p className="text-[12px] text-erp-muted">
              Tip: use the{' '}
              <Link to="/accounting/settings/setup" className="font-semibold text-erp-primary hover:underline">
                setup wizard
              </Link>{' '}
              for guided step-by-step configuration.
            </p>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => !activating && setConfirmOpen(false)}
        title="Activate finance?"
        description="This enables voucher posting for the selected company. Ensure all mandatory setup is reviewed."
        closeDisabled={activating}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={activating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleActivate()} disabled={activating}>
              {activating ? 'Activating…' : 'Activate Finance'}
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-erp-muted">
          After activation, changes to core setup (financial year, CoA structure) may require administrator review.
        </p>
      </Modal>
    </FinanceSettingsShell>
  )
}
