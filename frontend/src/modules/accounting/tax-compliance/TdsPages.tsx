import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getTdsDashboard,
  getTdsReconciliation,
  getTdsTransactions,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState, TdsTransaction } from '@/types/taxCompliance'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

export function TdsDashboardPage() {
  const navigate = useNavigate()
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ deducted: 0, pendingDeposit: 0, exceptions: 0, returnsInProgress: 0, certificatesPending: 0 })
  const [recent, setRecent] = useState<TdsTransaction[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTdsDashboard()
      setKpis(res.kpis)
      setRecent(res.recent)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpiStrip: EnterpriseKpiItem[] = useMemo(
    () => [
      { id: 'd', label: 'TDS Deducted', value: formatCompactCurrency(kpis.deducted), accent: 'blue', onClick: () => navigate('/accounting/tax-compliance/tds/transactions') },
      { id: 'p', label: 'Pending Deposit', value: formatCompactCurrency(kpis.pendingDeposit), accent: 'amber', onClick: () => navigate('/accounting/tax-compliance/tds/challans') },
      { id: 'e', label: 'Exceptions', value: String(kpis.exceptions), accent: 'red', onClick: () => navigate('/accounting/tax-compliance/tds/deductions') },
      { id: 'r', label: 'Returns In Progress', value: String(kpis.returnsInProgress), accent: 'green', onClick: () => navigate('/accounting/tax-compliance/tds/returns') },
      { id: 'c', label: 'Certificates Pending', value: String(kpis.certificatesPending), accent: 'slate', onClick: () => navigate('/accounting/tax-compliance/tds/certificates') },
    ],
    [kpis, navigate],
  )

  return (
    <TaxComplianceShell
      title="TDS Dashboard"
      periodFilter={filter}
      onPeriodChange={setFilter}
      kpiStrip={kpiStrip}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export Preview',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => notify.info('Placeholder export.'),
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-[12px]">
            <Link to="/accounting/tax-compliance/tds/transactions" className="font-semibold text-erp-primary hover:underline">
              Transactions
            </Link>
            <Link to="/accounting/tax-compliance/tds/deductions" className="font-semibold text-erp-primary hover:underline">
              Deduction Workbench
            </Link>
            <Link to="/accounting/tax-compliance/tds/challans" className="font-semibold text-erp-primary hover:underline">
              Challans
            </Link>
            <Link to="/accounting/tax-compliance/tds/reconciliation" className="font-semibold text-erp-primary hover:underline">
              Reconciliation
            </Link>
          </div>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Recent TDS transactions</h2>
            <ul className="mt-2 space-y-2 text-[12px]">
              {recent.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {formatDate(t.txnDate)} · {t.vendorName} · {t.sectionCode}
                  </span>
                  <span className="font-medium">{formatCurrency(t.tdsAmount)}</span>
                  <TaxStatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}

/** Deep-link workbench — not in primary side nav tree */
export function TdsDeductionWorkbenchPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [rows, setRows] = useState<TdsTransaction[]>([])
  const [selected, setSelected] = useState<TdsTransaction | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const list = await getTdsTransactions()
        setRows(list)
        setSelected(list.find((t) => t.status === 'Pending Deduction' || t.status === 'Exception') ?? list[0] ?? null)
      } finally {
        setLoading(false)
      }
    })()
  }, [filter])

  return (
    <TaxComplianceShell
      title="TDS Deduction Workbench"
      description="Review section/rate from setup config before marking deducted. Preview only — no automatic posting."
      periodFilter={filter}
      onPeriodChange={setFilter}
    >
      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          <div className="overflow-auto rounded border border-erp-border">
            <table className="min-w-full text-[12px]">
              <thead className="bg-erp-surface text-[11px] font-semibold uppercase text-erp-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left">Vendor</th>
                  <th className="px-2 py-1.5 text-left">Section</th>
                  <th className="px-2 py-1.5 text-right">TDS</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-t border-erp-border/70 hover:bg-erp-surface/70"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-2 py-1.5">{r.vendorName}</td>
                    <td className="px-2 py-1.5">{r.sectionCode}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(r.tdsAmount)}</td>
                    <td className="px-2 py-1.5"><TaxStatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded border border-erp-border p-3 text-[12px]">
            {!selected ? (
              <p className="text-erp-muted">Select a transaction.</p>
            ) : (
              <>
                <h3 className="text-[13px] font-semibold">{selected.vendorName}</h3>
                <p className="mt-1 text-erp-muted">{selected.natureOfPayment}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div><dt className="text-erp-muted">PAN</dt><dd>{selected.vendorPan}</dd></div>
                  <div><dt className="text-erp-muted">Section</dt><dd>{selected.sectionCode} — {selected.sectionLabel}</dd></div>
                  <div><dt className="text-erp-muted">Taxable</dt><dd>{formatCurrency(selected.taxableAmount)}</dd></div>
                  <div><dt className="text-erp-muted">Rate (setup)</dt><dd>{selected.ratePercent}%</dd></div>
                  <div><dt className="text-erp-muted">TDS preview</dt><dd className="font-semibold">{formatCurrency(selected.tdsAmount)}</dd></div>
                  <div><dt className="text-erp-muted">Status</dt><dd><TaxStatusBadge status={selected.status} /></dd></div>
                </dl>
                {selected.overrideReason ? <p className="mt-2 text-amber-800">{selected.overrideReason}</p> : null}
                <button
                  type="button"
                  className="erp-btn erp-btn-primary mt-3 h-8 px-3 text-[12px]"
                  disabled={!perms.canTdsDeduct}
                  onClick={() => notify.info('Marked deducted in session preview only — no GL / challan payment.')}
                >
                  Mark Deducted (Preview)
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </TaxComplianceShell>
  )
}

export function TdsReconciliationPage() {
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof getTdsReconciliation>> | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setData(await getTdsReconciliation())
      } finally {
        setLoading(false)
      }
    })()
  }, [filter])

  return (
    <TaxComplianceShell
      title="TDS Reconciliation"
      description="Books deductions vs challans (preview)."
      periodFilter={filter}
      onPeriodChange={setFilter}
    >
      {loading || !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-3 text-[12px]">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border border-erp-border p-2"><div className="text-erp-muted">Books TDS</div><div className="font-semibold">{formatCurrency(data.booksTotal)}</div></div>
            <div className="rounded border border-erp-border p-2"><div className="text-erp-muted">Challan total</div><div className="font-semibold">{formatCurrency(data.challanTotal)}</div></div>
            <div className="rounded border border-erp-border p-2"><div className="text-erp-muted">Variance</div><div className="font-semibold">{formatCurrency(data.variance)}</div></div>
          </div>
          <section className="rounded border border-erp-border p-3">
            <h2 className="font-semibold">Unmatched transactions</h2>
            <ul className="mt-2 space-y-1">
              {data.unmatchedTxns.map((t) => (
                <li key={t.id}>{t.vendorName} · {t.sectionCode} · {formatCurrency(t.tdsAmount)}</li>
              ))}
              {data.unmatchedTxns.length === 0 ? <li className="text-erp-muted">None</li> : null}
            </ul>
          </section>
          <section className="rounded border border-erp-border p-3">
            <h2 className="font-semibold">Unused / unlinked challans</h2>
            <ul className="mt-2 space-y-1">
              {data.unusedChallans.map((c) => (
                <li key={c.id}>Challan {c.challanNo} · {formatCurrency(c.amount)} · {c.sectionCode}</li>
              ))}
              {data.unusedChallans.length === 0 ? <li className="text-erp-muted">None</li> : null}
            </ul>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
