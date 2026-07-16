import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, Layers, Percent, RefreshCw, Save, Upload } from 'lucide-react'
import {
  BudgetingCollapsedSection,
  BudgetingShell,
  BudgetingWorkspacePanelTabs,
} from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  allocateAnnual,
  getAnnualGrid,
  importAnnualPreview,
  listBudgetVersions,
  saveAnnualLines,
} from '@/services/accounting/budgetingService'
import type { BudgetLine, BudgetVersion, FyMonth } from '@/types/budgeting'
import { FY_MONTHS, sumMonths } from '@/types/budgeting'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

export function AnnualBudgetPage() {
  const perms = useBudgetingPermissions()
  const [params] = useSearchParams()
  const [versions, setVersions] = useState<BudgetVersion[]>([])
  const [versionId, setVersionId] = useState(params.get('version') ?? 'bv-original')
  const [lines, setLines] = useState<BudgetLine[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('grid')
  const [dept, setDept] = useState('')
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    void listBudgetVersions().then(setVersions).catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLines(
        await getAnnualGrid({
          versionId,
          departmentId: dept || undefined,
          search: search || undefined,
        }),
      )
      setDirty(false)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load annual grid')
    } finally {
      setLoading(false)
    }
  }, [versionId, dept, search])

  useEffect(() => {
    void load()
  }, [load])

  const depts = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of lines) map.set(l.departmentId, l.departmentName)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [lines])

  const setMonth = (lineId: string, month: FyMonth, value: number) => {
    if (!perms.canEdit) return
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, months: { ...l.months, [month]: value } } : l)),
    )
    setDirty(true)
  }

  const onSave = async () => {
    if (!perms.canEdit) return
    try {
      await saveAnnualLines(versionId, lines)
      setDirty(false)
      notify.success('Annual lines saved (demo — no GL posting)')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const onAllocate = async (mode: 'equal' | 'seasonal' | 'copy_py' | 'growth') => {
    if (!perms.canEdit) return
    let growth = 0
    if (mode === 'growth') {
      const raw = window.prompt('Growth % on previous year actual', '8')
      if (raw == null) return
      growth = Number(raw) || 0
    }
    try {
      setLines(await allocateAnnual(versionId, mode, growth))
      setDirty(true)
      notify.success(`Allocated via ${mode}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Allocate failed')
    }
  }

  const onImport = async () => {
    if (!perms.canEdit) return
    const text = window.prompt('Paste CSV (header + rows) for preview parse', 'account,Apr,May\n4001,100,200')
    if (!text) return
    const res = await importAnnualPreview(text)
    if (res.ok) notify.success(res.message)
    else notify.error(res.message)
  }

  const version = versions.find((v) => v.id === versionId)

  return (
    <BudgetingShell
      title="Annual Budget"
      description="Spreadsheet workbench — Budget Information | Monthly Budget Grid."
      denseBanner
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
              id: 'save',
              label: dirty ? 'Save*' : 'Save',
              icon: Save,
              disabled: !perms.canEdit || !dirty,
              onClick: () => void onSave(),
            }}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'equal',
              label: 'Spread Equal',
              icon: Layers,
              disabled: !perms.canEdit,
              onClick: () => void onAllocate('equal'),
            },
            {
              id: 'seasonal',
              label: 'Seasonal',
              icon: Layers,
              disabled: !perms.canEdit,
              onClick: () => void onAllocate('seasonal'),
            },
            {
              id: 'py',
              label: 'Copy PY',
              icon: Copy,
              disabled: !perms.canEdit,
              onClick: () => void onAllocate('copy_py'),
            },
            {
              id: 'growth',
              label: 'Growth %',
              icon: Percent,
              disabled: !perms.canEdit,
              onClick: () => void onAllocate('growth'),
            },
            {
              id: 'import',
              label: 'Import CSV',
              icon: Upload,
              disabled: !perms.canEdit,
              onClick: () => void onImport(),
            },
          ]}
        />
      }
    >
      <BudgetingWorkspacePanelTabs
        tabs={[
          { id: 'info', label: 'Budget Information' },
          { id: 'grid', label: 'Monthly Budget Grid' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-erp-muted">
          Version
          <select
            className="ml-1 rounded border border-erp-border px-2 py-1 text-[12px]"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-erp-muted">
          Department
          <select
            className="ml-1 rounded border border-erp-border px-2 py-1 text-[12px]"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            <option value="">All</option>
            {depts.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-erp-muted">
          Search
          <input
            className="ml-1 rounded border border-erp-border px-2 py-1 text-[12px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Account code/name"
          />
        </label>
      </div>

      {loading ? <LoadingState /> : null}

      {!loading && tab === 'info' ? (
        <div className="space-y-2">
          <dl className="grid gap-2 sm:grid-cols-2 text-[12px]">
            <div>
              <dt className="text-erp-muted">Company</dt>
              <dd className="font-medium">{version?.companyName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Financial year</dt>
              <dd className="font-medium">{version?.financialYear ?? '2025-26'}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Plant</dt>
              <dd className="font-medium">Chakan Plant</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Status</dt>
              <dd className="font-medium">{version?.status ?? '—'}</dd>
            </div>
          </dl>
          <BudgetingCollapsedSection title="Assumptions">
            FY Apr–Mar Indian manufacturing calendar. Amounts in INR. Demo seed for Vasant Trailers.
          </BudgetingCollapsedSection>
          <BudgetingCollapsedSection title="Notes">
            {version?.notes || 'No notes on this version.'}
          </BudgetingCollapsedSection>
          <BudgetingCollapsedSection title="Attachments">
            No attachments in demo mode.
          </BudgetingCollapsedSection>
          <BudgetingCollapsedSection title="Approval Activity">
            Use Budget Approvals worklist for multi-level decisions.
          </BudgetingCollapsedSection>
          <BudgetingCollapsedSection title="Change History">
            Edits stay in-session until refresh; no audit API yet.
          </BudgetingCollapsedSection>
        </div>
      ) : null}

      {!loading && tab === 'grid' ? (
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="min-w-max text-left text-[11px]">
            <thead className="sticky top-0 bg-erp-surface text-[10px] uppercase text-erp-muted">
              <tr>
                <th className="px-2 py-1.5">Account</th>
                <th className="px-2 py-1.5">Dept</th>
                <th className="px-2 py-1.5">CC</th>
                {FY_MONTHS.map((m) => (
                  <th key={m} className="px-1 py-1.5 text-right">
                    {m}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right">Total</th>
                <th className="px-2 py-1.5 text-right">PY Actual</th>
                <th className="px-2 py-1.5 text-right">Committed</th>
                <th className="px-2 py-1.5 text-right">Actual</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                  <td className="px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">{line.accountCode}</div>
                    <div className="text-erp-muted">{line.accountName}</div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">{line.departmentName}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{line.costCentreName}</td>
                  {FY_MONTHS.map((m) => (
                    <td key={m} className="px-0.5 py-0.5">
                      <input
                        type="number"
                        className="w-[4.5rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-erp-border focus:border-erp-primary focus:outline-none disabled:opacity-60"
                        value={line.months[m]}
                        disabled={!perms.canEdit}
                        onChange={(e) => setMonth(line.id, m, Number(e.target.value) || 0)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-semibold">{formatCurrency(sumMonths(line.months))}</td>
                  <td className="px-2 py-1 text-right text-erp-muted">{formatCurrency(line.previousYearActual)}</td>
                  <td className="px-2 py-1 text-right text-erp-muted">{formatCurrency(line.committed)}</td>
                  <td className="px-2 py-1 text-right text-erp-muted">{formatCurrency(line.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
