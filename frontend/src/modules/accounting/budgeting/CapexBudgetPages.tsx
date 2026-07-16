import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import {
  BudgetingCollapsedSection,
  BudgetingShell,
  BudgetingWorkspacePanelTabs,
} from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getCapexRequest, listCapexRequests } from '@/services/accounting/budgetingService'
import type { CapexRequest, CapexStatus } from '@/types/budgeting'
import { CAPEX_STATUS_LABELS } from '@/types/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

const FLOW: CapexStatus[] = [
  'request',
  'budget_review',
  'approval',
  'purchase_requisition',
  'purchase_order',
  'capitalization',
  'budget_vs_actual',
]

export function CapexBudgetPage() {
  const [rows, setRows] = useState<CapexRequest[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listCapexRequests())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Capital Expenditure Budget"
      description="CAPEX request register with lifecycle status."
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
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
              <tr>
                <th className="px-2 py-2">Request</th>
                <th className="px-2 py-2">Asset</th>
                <th className="px-2 py-2">Dept</th>
                <th className="px-2 py-2">Estimated</th>
                <th className="px-2 py-2">Approved</th>
                <th className="px-2 py-2">Actual</th>
                <th className="px-2 py-2">Remaining</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-erp-border hover:bg-erp-surface/40"
                  onClick={() => navigate(`/accounting/budgeting/capex/${r.id}`)}
                >
                  <td className="px-2 py-2 font-medium text-erp-primary">{r.requestNo}</td>
                  <td className="px-2 py-2">{r.assetDescription}</td>
                  <td className="px-2 py-2">{r.department}</td>
                  <td className="px-2 py-2">{formatCurrency(r.estimatedCost)}</td>
                  <td className="px-2 py-2">{formatCurrency(r.approvedBudget)}</td>
                  <td className="px-2 py-2">{formatCurrency(r.actualCost)}</td>
                  <td className="px-2 py-2">{formatCurrency(r.remainingBudget)}</td>
                  <td className="px-2 py-2">{CAPEX_STATUS_LABELS[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BudgetingShell>
  )
}

export function CapexRequestDetailPage() {
  const { id } = useParams()
  const [row, setRow] = useState<CapexRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const data = id ? await getCapexRequest(id) : null
      if (!cancelled) {
        setRow(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const stepIndex = row ? Math.max(0, FLOW.indexOf(row.status)) : 0

  return (
    <BudgetingShell title={row?.requestNo ?? 'CAPEX Request'} description="CAPEX editor — Information | Phasing." denseBanner>
      {loading ? <LoadingState /> : null}
      {!loading && !row ? <p className="text-[13px] text-rose-700">Request not found.</p> : null}
      {!loading && row ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1">
            {FLOW.map((s, i) => (
              <span
                key={s}
                className={cn(
                  'rounded px-2 py-1 text-[10px] font-semibold',
                  i <= stepIndex ? 'bg-erp-primary/10 text-erp-primary' : 'bg-erp-surface text-erp-muted',
                )}
              >
                {CAPEX_STATUS_LABELS[s]}
              </span>
            ))}
          </div>
          <BudgetingWorkspacePanelTabs
            tabs={[
              { id: 'info', label: 'Budget Information' },
              { id: 'grid', label: 'Monthly Budget Grid' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'info' ? (
            <div className="space-y-2 text-[12px]">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-erp-muted">Asset category</dt>
                  <dd className="font-medium">{row.assetCategory}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Description</dt>
                  <dd className="font-medium">{row.assetDescription}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Requester</dt>
                  <dd>{row.requester}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Plant</dt>
                  <dd>{row.plant}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Expected purchase</dt>
                  <dd>{formatDate(row.expectedPurchaseDate)}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Capitalization</dt>
                  <dd>{formatDate(row.expectedCapitalizationDate)}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Funding</dt>
                  <dd>{row.fundingSource}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">PO</dt>
                  <dd>
                    {row.purchaseOrderNo ? (
                      <Link className="text-erp-primary hover:underline" to="/purchase/orders">
                        {row.purchaseOrderNo}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
              <BudgetingCollapsedSection title="Business justification" defaultOpen>
                {row.businessJustification}
              </BudgetingCollapsedSection>
              <BudgetingCollapsedSection title="Notes / Attachments / Approval Activity">
                Demo placeholders — no document store attached.
              </BudgetingCollapsedSection>
            </div>
          ) : (
            <p className="text-[12px] text-erp-muted">
              Phasing grid placeholder — estimated {formatCurrency(row.estimatedCost)} spread across remaining FY months.
              Use Annual Budget CAPEX account lines for detailed monthly entry.
            </p>
          )}
        </>
      ) : null}
    </BudgetingShell>
  )
}
