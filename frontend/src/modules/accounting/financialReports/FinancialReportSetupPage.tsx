import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import {
  FinancialReportDemoBanner,
  FinancialReportLoadingState,
  FinancialReportErrorState,
  FinancialReportAccessDeniedState,
  FinancialReportsWorkspaceTabs,
} from '@/components/accounting/financialReports'
import {
  FinancialReportsServiceError,
  getFinancialReportSetup,
  updateFinancialReportSetupDemo,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportComparisonMode, FinancialReportSetup, FinancialReportViewMode } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { financialReportsBreadcrumb, type FinancialReportLoadState } from './financialReportsUi'

const COMPARISON_OPTIONS: { value: FinancialReportComparisonMode; label: string }[] = [
  { value: 'none', label: 'No comparison' },
  { value: 'previous_year', label: 'Previous year' },
  { value: 'budget', label: 'Budget' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'ytd', label: 'Year to date' },
]

const VIEW_OPTIONS: { value: FinancialReportViewMode; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'consolidated', label: 'Consolidated' },
]

export function FinancialReportSetupPage() {
  const perms = useFinancialReportsPermissions()
  const [setup, setSetup] = useState<FinancialReportSetup | null>(null)
  const [draft, setDraft] = useState<FinancialReportSetup | null>(null)
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const data = await getFinancialReportSetup()
      setSetup(data)
      setDraft(data)
      setLoadState('ready')
    } catch (e) {
      setSetup(null)
      setDraft(null)
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load report setup')
    }
  }, [])

  useEffect(() => {
    if (!perms.canView) return
    void load()
  }, [load, perms.canView])

  const patch = (partial: Partial<FinancialReportSetup>) => {
    setDraft((d) => (d ? { ...d, ...partial } : d))
  }

  const handleSave = async () => {
    if (!draft) return
    if (!perms.canManageSetup) {
      notify.error('Permission denied')
      return
    }
    setSaving(true)
    try {
      const saved = await updateFinancialReportSetupDemo(draft)
      setSetup(saved)
      setDraft(saved)
      notify.success('Report setup saved (demo session).')
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Report Setup" breadcrumbs={financialReportsBreadcrumb('Setup')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  const readOnly = !perms.canManageSetup

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Report Setup"
      description="Default filters, rounding, and export preferences (demo session store)."
      breadcrumbs={financialReportsBreadcrumb('Setup')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/setup"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            !readOnly
              ? {
                  id: 'save',
                  label: saving ? 'Saving…' : 'Save setup',
                  icon: Save,
                  disabled: saving || !draft,
                  onClick: () => void handleSave(),
                }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <FinancialReportsWorkspaceTabs active="setup" />
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner message="Setup changes persist for this browser session only — not saved to a backend." />
        {loadState === 'loading' ? <FinancialReportLoadingState variant="card" rows={4} /> : null}
        {loadState === 'error' ? <FinancialReportErrorState onRetry={() => void load()} /> : null}
        {loadState === 'ready' && draft ? (
          <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-erp-border bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-erp-text">
                Default financial year
                <input
                  type="text"
                  className="erp-input mt-1 h-9 w-full text-[13px]"
                  value={draft.defaultFy}
                  disabled={readOnly}
                  onChange={(e) => patch({ defaultFy: e.target.value })}
                />
              </label>
              <label className="block text-[12px] font-medium text-erp-text">
                Default comparison
                <select
                  className="erp-input mt-1 h-9 w-full text-[13px]"
                  value={draft.defaultComparisonMode}
                  disabled={readOnly}
                  onChange={(e) => patch({ defaultComparisonMode: e.target.value as FinancialReportComparisonMode })}
                >
                  {COMPARISON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-erp-text">
                Default view mode
                <select
                  className="erp-input mt-1 h-9 w-full text-[13px]"
                  value={draft.defaultViewMode}
                  disabled={readOnly}
                  onChange={(e) => patch({ defaultViewMode: e.target.value as FinancialReportViewMode })}
                >
                  {VIEW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-erp-text">
                Round to nearest
                <select
                  className="erp-input mt-1 h-9 w-full text-[13px]"
                  value={draft.roundToNearest}
                  disabled={readOnly}
                  onChange={(e) => patch({ roundToNearest: Number(e.target.value) as 1 | 100 | 1000 })}
                >
                  <option value={1}>₹1</option>
                  <option value={100}>₹100</option>
                  <option value={1000}>₹1,000</option>
                </select>
              </label>
              <label className="block text-[12px] font-medium text-erp-text">
                Currency display
                <select
                  className="erp-input mt-1 h-9 w-full text-[13px]"
                  value={draft.currencyDisplay}
                  disabled={readOnly}
                  onChange={(e) => patch({ currencyDisplay: e.target.value as FinancialReportSetup['currencyDisplay'] })}
                >
                  <option value="actual">Actual (₹)</option>
                  <option value="lakhs">Lakhs</option>
                  <option value="crores">Crores</option>
                </select>
              </label>
            </div>

            <div className="space-y-2 border-t border-erp-border pt-3">
              {[
                { key: 'showZeroBalanceAccounts' as const, label: 'Show zero-balance accounts by default' },
                { key: 'includeProvisionalEntries' as const, label: 'Include provisional / unposted entries' },
                { key: 'consolidatePlants' as const, label: 'Consolidate all plants in reports' },
                { key: 'watermarkDemoReports' as const, label: 'Watermark demo exports' },
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-[12px] text-erp-text">
                  <input
                    type="checkbox"
                    className="rounded border-erp-border"
                    checked={draft[opt.key]}
                    disabled={readOnly}
                    onChange={(e) => patch({ [opt.key]: e.target.checked })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <label className="block text-[12px] font-medium text-erp-text">
              Schedule email recipients (comma-separated)
              <textarea
                className="erp-input mt-1 min-h-[4rem] w-full text-[13px]"
                value={draft.scheduleEmailRecipients.join(', ')}
                disabled={readOnly}
                onChange={(e) =>
                  patch({
                    scheduleEmailRecipients: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            {setup ? (
              <p className="border-t border-erp-border pt-3 text-[11px] text-erp-muted">
                Last updated by {setup.lastUpdatedBy} on {formatDateTime(setup.lastUpdatedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
