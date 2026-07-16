import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'
import { availableBudget, variancePct } from '@/types/budgeting'
import {
  listCostCentreBudgets,
  listDepartmentBudgets,
  listDimensionBudgets,
  listExpenseBudgets,
} from '@/services/accounting/budgetingService'
import type {
  CostCentreBudgetRow,
  DepartmentBudgetRow,
  DimensionBudgetRow,
  ExpenseBudgetRow,
} from '@/types/budgeting'
import { Link } from 'react-router-dom'

function SimpleTable({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded border border-erp-border">
      <table className="min-w-full text-left text-[12px]">
        <thead className="bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-2 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function DepartmentBudgetsPage() {
  const perms = useBudgetingPermissions()
  const [rows, setRows] = useState<DepartmentBudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DepartmentBudgetRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listDepartmentBudgets())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Department Budgets"
      description="Utilization by department with drill-down."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {!perms.canView ? <p className="text-[13px] text-rose-700">No view permission.</p> : null}
      {loading ? <LoadingState /> : null}
      {!loading ? (
        <SimpleTable headers={['Department', 'Owner', 'Approved', 'Committed', 'Actual', 'Available', 'Util %', '']}>
          {rows.map((r) => {
            const avail = availableBudget(r.approvedBudget, r.committed, r.actual)
            const util = Number(((r.actual / r.approvedBudget) * 100).toFixed(1))
            return (
              <tr key={r.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                <td className="px-2 py-2 font-medium">{r.departmentName}</td>
                <td className="px-2 py-2">{r.budgetOwner}</td>
                <td className="px-2 py-2">{formatCurrency(r.approvedBudget)}</td>
                <td className="px-2 py-2">{formatCurrency(r.committed)}</td>
                <td className="px-2 py-2">{formatCurrency(r.actual)}</td>
                <td className="px-2 py-2">{formatCurrency(avail)}</td>
                <td className="px-2 py-2">{util}%</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-erp-primary hover:underline"
                    onClick={() => setSelected(r)}
                  >
                    Detail
                  </button>
                </td>
              </tr>
            )
          })}
        </SimpleTable>
      ) : null}
      {selected ? (
        <div className="mt-3 rounded border border-erp-border p-3 text-[12px]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selected.departmentName} — monthly / account drill</h3>
            <button type="button" className="text-erp-muted" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p className="mt-1 text-erp-muted">
            Open{' '}
            <Link className="text-erp-primary hover:underline" to={`/accounting/budgeting/annual?version=${selected.versionId}`}>
              Annual Budget
            </Link>{' '}
            filtered by this department for Apr–Mar account lines. Forecast {formatCurrency(selected.forecast)}.
          </p>
        </div>
      ) : null}
    </BudgetingShell>
  )
}

export function CostCentreBudgetsPage() {
  const [rows, setRows] = useState<CostCentreBudgetRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listCostCentreBudgets())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Cost Centre Budgets"
      description="Utilization and variance by cost centre."
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
        <SimpleTable headers={['Cost centre', 'Department', 'Owner', 'Approved', 'Actual', 'Variance %', 'Status']}>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-erp-border hover:bg-erp-surface/40">
              <td className="px-2 py-2 font-medium">{r.costCentreName}</td>
              <td className="px-2 py-2">{r.departmentName}</td>
              <td className="px-2 py-2">{r.budgetOwner}</td>
              <td className="px-2 py-2">{formatCurrency(r.approvedBudget)}</td>
              <td className="px-2 py-2">{formatCurrency(r.actual)}</td>
              <td className="px-2 py-2">{variancePct(r.approvedBudget, r.actual)}%</td>
              <td className="px-2 py-2">{r.status}</td>
            </tr>
          ))}
        </SimpleTable>
      ) : null}
    </BudgetingShell>
  )
}

function DimensionBudgetPage({
  kind,
  title,
}: {
  kind: 'sales' | 'purchase' | 'production'
  title: string
}) {
  const [rows, setRows] = useState<DimensionBudgetRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listDimensionBudgets(kind))
    } finally {
      setLoading(false)
    }
  }, [kind])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title={title}
      description="Period / category register (lighter than Annual grid)."
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
        <SimpleTable headers={['Category', 'Period', 'Budget', 'Actual', 'Forecast', 'Variance', 'Status']}>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-erp-border hover:bg-erp-surface/40">
              <td className="px-2 py-2 font-medium">{r.category}</td>
              <td className="px-2 py-2">{r.periodLabel}</td>
              <td className="px-2 py-2">{formatCurrency(r.budget)}</td>
              <td className="px-2 py-2">{formatCurrency(r.actual)}</td>
              <td className="px-2 py-2">{formatCurrency(r.forecast)}</td>
              <td className="px-2 py-2">{formatCurrency(r.variance)}</td>
              <td className="px-2 py-2">{r.status}</td>
            </tr>
          ))}
        </SimpleTable>
      ) : null}
    </BudgetingShell>
  )
}

export function SalesBudgetPage() {
  return <DimensionBudgetPage kind="sales" title="Sales Budget" />
}

export function PurchaseBudgetPage() {
  return <DimensionBudgetPage kind="purchase" title="Purchase Budget" />
}

export function ProductionBudgetPage() {
  return <DimensionBudgetPage kind="production" title="Production Budget" />
}

export function ExpenseBudgetPage() {
  const [rows, setRows] = useState<ExpenseBudgetRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listExpenseBudgets())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Expense Budget"
      description="Category cards — recurring vs one-time."
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded border border-erp-border p-3 text-[12px]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-erp-text">{r.categoryLabel}</h3>
                <span
                  className={
                    r.recurring
                      ? 'rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800'
                      : 'rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900'
                  }
                >
                  {r.recurring ? 'Recurring' : 'One-time'}
                </span>
              </div>
              <dl className="mt-2 space-y-1 text-erp-muted">
                <div className="flex justify-between">
                  <dt>Annual</dt>
                  <dd className="font-medium text-erp-text">{formatCurrency(r.annualBudget)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Actual</dt>
                  <dd>{formatCurrency(r.actual)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Committed</dt>
                  <dd>{formatCurrency(r.committed)}</dd>
                </div>
              </dl>
              {r.notes ? <p className="mt-2 text-[11px] text-erp-muted">{r.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </BudgetingShell>
  )
}
