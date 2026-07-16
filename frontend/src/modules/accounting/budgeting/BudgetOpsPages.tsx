import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getBudgetingSetup, listBudgetReports } from '@/services/accounting/budgetingService'
import type { BudgetReportCard, BudgetingSetup } from '@/types/budgeting'
import { APPROVAL_LEVEL_LABELS } from '@/types/budgeting'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'

export function BudgetReportsPage() {
  const [rows, setRows] = useState<BudgetReportCard[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBudgetReports())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Budget Reports"
      description="Catalogue of budgeting report views (UI only)."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {!loading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              to={r.href}
              className="rounded border border-erp-border p-3 transition-colors hover:border-erp-primary hover:bg-erp-primary/5"
            >
              <h3 className="text-[13px] font-semibold text-erp-text">{r.title}</h3>
              <p className="mt-1 text-[12px] text-erp-muted">{r.description}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </BudgetingShell>
  )
}

export function BudgetingSetupPage() {
  const perms = useBudgetingPermissions()
  const [setup, setSetup] = useState<BudgetingSetup | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const data = await getBudgetingSetup()
      if (!cancelled) {
        setSetup(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <BudgetingShell
      title="Budgeting Setup"
      description="FY calendar, allocation methods, approval matrix, thresholds — UI only."
    >
      {!perms.canSetup ? (
        <p className="mb-2 text-[12px] text-amber-900">
          Setup permission not granted — viewing read-only demo values.
        </p>
      ) : null}
      {loading ? <LoadingState /> : null}
      {!loading && setup ? (
        <div className="grid gap-3 lg:grid-cols-2 text-[12px]">
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Financial year calendar</h2>
            <p className="mt-2 text-erp-muted">
              FY {setup.financialYear} · starts {setup.fyStartMonth}
            </p>
            <p className="mt-1 text-erp-muted">{setup.primaryVersionRule}</p>
          </section>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Allocation methods</h2>
            <ul className="mt-2 list-inside list-disc text-erp-muted">
              {setup.allocationMethods.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Approval matrix</h2>
            <ul className="mt-2 space-y-1">
              {setup.approvalMatrix.map((a) => (
                <li key={a.level} className="flex justify-between">
                  <span>{APPROVAL_LEVEL_LABELS[a.level]}</span>
                  <span className="text-erp-muted">{a.roleLabel}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Thresholds</h2>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between">
                <dt className="text-erp-muted">Minimum cash</dt>
                <dd className="font-medium">{formatCurrency(setup.minimumCashThreshold)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-erp-muted">Overrun alert</dt>
                <dd className="font-medium">{setup.overrunAlertPct}%</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
