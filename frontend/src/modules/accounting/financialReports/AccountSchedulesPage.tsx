import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw, Settings2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { CommandBarButton } from '@/components/ui/CommandBar'
import {
  AccountScheduleEditor,
  FinancialReportDemoBanner,
  FinancialReportExportMenu,
  FinancialReportFilterBar,
  FinancialReportLoadingState,
  FinancialReportErrorState,
  FinancialReportNoDataState,
  FinancialReportAccessDeniedState,
  FinancialStatementTable,
  FinancialReportsWorkspaceTabs,
} from '@/components/accounting/financialReports'
import {
  DEFAULT_FINANCIAL_REPORT_FILTER,
  exportFinancialReport,
  FinancialReportsServiceError,
  getAccountSchedules,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
  runAccountSchedule,
  saveAccountScheduleDemo,
} from '@/services/accounting/financialReportsService'
import type {
  AccountScheduleDefinition,
  AccountScheduleRunResult,
  FinancialReportFilter,
  FinancialReportLookups,
} from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  ACCOUNT_SCHEDULE_BC_HELP,
  downloadTextFile,
  financialReportsBreadcrumb,
  scheduleRunToStatementLines,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

export function AccountSchedulesPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [schedules, setSchedules] = useState<AccountScheduleDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<AccountScheduleRunResult | null>(null)
  const [listState, setListState] = useState<FinancialReportLoadState>('loading')
  const [runState, setRunState] = useState<FinancialReportLoadState>('empty')
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    setDraftFilter(appliedFilter)
  }, [appliedFilter])

  useEffect(() => {
    void getFinancialReportLookups().then(setLookups).catch(() => setLookups(null))
  }, [])

  const loadSchedules = useCallback(async () => {
    setListState('loading')
    try {
      const list = await getAccountSchedules()
      setSchedules(list)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
      setListState(list.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setSchedules([])
      setListState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load schedules')
    }
  }, [])

  useEffect(() => {
    if (!perms.canViewSchedules) return
    void loadSchedules()
  }, [loadSchedules, perms.canViewSchedules])

  const selected = schedules.find((s) => s.id === selectedId) ?? null

  const runSchedule = useCallback(async () => {
    if (!selected) return
    setRunState('loading')
    try {
      const result = await runAccountSchedule(selected.id, appliedFilter)
      setRunResult(result)
      setRunState('ready')
      notify.success(`${result.scheduleName} generated (demo).`)
    } catch (e) {
      setRunResult(null)
      setRunState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Schedule run failed')
    }
  }, [appliedFilter, selected])

  useEffect(() => {
    if (!selected || !perms.canViewSchedules) return
    void runSchedule()
  }, [selected?.id, appliedFilter, perms.canViewSchedules, runSchedule])

  const statementLines = useMemo(() => {
    if (!selected || !runResult) return []
    return scheduleRunToStatementLines(selected, runResult)
  }, [selected, runResult])

  const applyFilter = () => syncFilterToUrl(draftFilter)
  const handleReset = () => {
    setDraftFilter({ ...DEFAULT_FINANCIAL_REPORT_FILTER })
    resetFilter()
  }

  const handleSaveSchedule = async (def: AccountScheduleDefinition) => {
    if (!perms.canManageSchedules) {
      notify.error('Permission denied')
      return
    }
    try {
      const saved = await saveAccountScheduleDemo(def)
      notify.success(`Schedule ${saved.code} saved (demo session).`)
      setEditorOpen(false)
      await loadSchedules()
      setSelectedId(saved.id)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Save failed')
    }
  }

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!perms.canExport || !selected) {
      notify.error('Permission denied')
      return
    }
    try {
      const result = await exportFinancialReport({
        scope: 'account_schedule',
        format,
        filter: appliedFilter,
        scheduleId: selected.id,
      })
      downloadTextFile(result.filename, result.content)
      notify.success(`${result.filename} generated (demo).`)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!perms.canPrint) {
      notify.error('Permission denied')
      return
    }
    try {
      const preview = await getFinancialReportPrintPreview('Account Schedule', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canViewSchedules) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Account Schedules"
        breadcrumbs={financialReportsBreadcrumb('Account Schedules')}
        autoBreadcrumbs={false}
      >
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Account Schedules"
      description="Business Central–style account schedules with column layouts and demo run."
      breadcrumbs={financialReportsBreadcrumb('Account Schedules')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/account-schedules"
      showDescription
      commandBar={(
        <ErpCommandBar inline sticky={false}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selected ? (
              <CommandBarButton
                icon={Play}
                label="Run schedule"
                primary
                onClick={() => void runSchedule()}
              />
            ) : null}
            <CommandBarButton
              icon={RefreshCw}
              label="Refresh"
              accent
              onClick={() => void loadSchedules()}
            />
            {perms.canManageSchedules ? (
              <CommandBarButton
                icon={Settings2}
                label={editorOpen ? 'Hide editor' : 'Edit schedule'}
                accent
                onClick={() => setEditorOpen((v) => !v)}
              />
            ) : null}
            <FinancialReportExportMenu
              disabled={!runResult}
              onExport={perms.canExport ? handleExport : undefined}
              onPrint={perms.canPrint ? handlePrint : undefined}
            />
          </div>
        </ErpCommandBar>
      )}
    >
      <FinancialReportsWorkspaceTabs active="account_schedules" preserveQuery={preserveQuery} />
      {lookups ? (
        <FinancialReportFilterBar
          filter={draftFilter}
          onChange={setDraftFilter}
          lookups={lookups}
          onApply={applyFilter}
          onReset={handleReset}
        />
      ) : null}
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner />
        <p className="rounded-md border border-erp-border bg-erp-surface-alt/40 px-3 py-2 text-[11px] text-erp-muted">
          {ACCOUNT_SCHEDULE_BC_HELP}
        </p>
        {listState === 'loading' ? <FinancialReportLoadingState rows={4} /> : null}
        {listState === 'error' ? <FinancialReportErrorState onRetry={() => void loadSchedules()} /> : null}
        {listState === 'empty' ? <FinancialReportNoDataState title="No account schedules" /> : null}
        {listState === 'ready' ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
            <div className="space-y-2">
              {schedules.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'w-full rounded-md border p-3 text-left transition',
                    selected?.id === s.id
                      ? 'border-erp-primary bg-erp-primary/5'
                      : 'border-erp-border bg-white hover:border-erp-primary/40',
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase text-erp-muted">{s.category}</div>
                  <div className="mt-1 text-[13px] font-semibold">{s.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-erp-muted">{s.code}</div>
                  <p className="mt-1 text-[11px] text-erp-muted">{s.description}</p>
                  {s.lastRunAt ? (
                    <p className="mt-2 text-[10px] text-erp-muted">
                      Last run: {new Date(s.lastRunAt).toLocaleString('en-IN')}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {editorOpen && selected && perms.canManageSchedules ? (
                <div className="rounded-lg border border-erp-border bg-white p-3">
                  <h3 className="mb-2 text-[13px] font-semibold">Schedule editor (demo)</h3>
                  <AccountScheduleEditor definition={selected} onSave={handleSaveSchedule} />
                </div>
              ) : null}
              {runState === 'loading' ? <FinancialReportLoadingState rows={8} /> : null}
              {runState === 'error' ? <FinancialReportErrorState onRetry={() => void runSchedule()} /> : null}
              {runState === 'ready' && runResult ? (
                <div className="rounded-lg border border-erp-border bg-white">
                  <div className="border-b border-erp-border px-4 py-2">
                    <p className="text-[13px] font-semibold">{runResult.scheduleName}</p>
                    <p className="text-[11px] text-erp-muted">{runResult.periodLabel}</p>
                  </div>
                  <FinancialStatementTable
                    lines={statementLines}
                    showVariance={statementLines.some((l) => l.variance !== undefined)}
                    priorPeriodLabel={
                      selected?.columns.find((c) => c.columnType === 'PreviousMonth')?.label
                      ?? selected?.columns.find((c) => c.columnType === 'PreviousYear')?.label
                    }
                    budgetLabel={selected?.columns.find((c) => c.columnType === 'Budget')?.label}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
