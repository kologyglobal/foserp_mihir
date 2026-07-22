import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { Button } from '../../components/ui/Button'
import { TableLink } from '../../components/ui/AppLink'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { useIncomingPendingInspections, useQualityProductionReports } from '../../hooks/useStableStoreData'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
import { isApiMode } from '@/config/apiConfig'
import { getIncomingQualityQueue, type IncomingQualityReadiness } from '@/services/api/qualityApi'
import {
  getFinalQcChecklistReport,
  getPaintingDefectReport,
  getParameterFailureTrendReport,
  getProcessWiseQcReport,
  getVendorIncomingRejectionReport,
  getWeldingDefectReport,
  getPressureTestReport,
  getSubcontractReturnQcReport,
} from '../../utils/qcDynamicReports'

export function QualityReportsPage() {
  const { pending, ageing, metrics } = useQualityProductionReports()
  const inspections = useQualityStore((s) => s.inspections)
  const vendors = useMasterStore((s) => s.vendors)
  const apiMode = isApiMode()

  const processWise = getProcessWiseQcReport(inspections)
  const paramTrend = getParameterFailureTrendReport(inspections)
  const weldingDefects = getWeldingDefectReport(inspections)
  const paintingDefects = getPaintingDefectReport(inspections)
  const pressureTestDefects = getPressureTestReport(inspections)
  const subcontractReturn = getSubcontractReturnQcReport(inspections)
  const vendorRejections = getVendorIncomingRejectionReport(
    inspections,
    (id) => vendors.find((v) => v.id === id)?.vendorName ?? id,
  )
  const finalChecklist = getFinalQcChecklistReport(inspections)

  return (
    <div className="erp-page">
      <PageHeader
        title="Quality Reports"
        description="Pending inspections · Rejections · NCR ageing · Vendor rating · Dynamic QC analytics"
        breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Reports' }]}
      />
      {apiMode ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          <span>This is the demo quality report engine. Live ops reports for Quality run through the Manufacturing report runner.</span>
          <Link to="/manufacturing/reports/quality-dashboard" className="whitespace-nowrap font-semibold text-erp-primary hover:underline">
            Open in Manufacturing Reports →
          </Link>
        </div>
      ) : null}
      <p className="mb-4 text-sm text-erp-muted">
        First pass yield: {metrics.firstPassYieldPct.toFixed(1)}% · Pending incoming:{' '}
        {metrics.pendingIncoming ?? pending.filter((p) => p.category === 'incoming').length}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Process-wise QC" noPadding>
          <table className="erp-table">
            <thead><tr><th>Operation</th><th>WO</th><th>Pass</th><th>Fail</th><th>Result</th></tr></thead>
            <tbody>
              {processWise.map((r) => (
                <tr key={r.inspectionNo}>
                  <td>{r.operationName}</td>
                  <td>{r.woNo ?? '—'}</td>
                  <td className="num">{r.passCount}</td>
                  <td className="num">{r.failCount}</td>
                  <td>{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Parameter Failure Trend" noPadding>
          <table className="erp-table">
            <thead><tr><th>Parameter</th><th>Failures</th><th>Rate</th></tr></thead>
            <tbody>
              {paramTrend.slice(0, 12).map((r) => (
                <tr key={r.parameterCode}><td>{r.parameterName}</td><td className="num">{r.failureCount}</td><td className="num">{r.failureRatePct}%</td></tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Welding Defect Report" noPadding>
          <table className="erp-table">
            <thead><tr><th>Inspection</th><th>Parameter</th><th>Value</th><th>Severity</th></tr></thead>
            <tbody>{weldingDefects.map((r, i) => <tr key={i}><td>{r.inspectionNo}</td><td>{r.parameterName}</td><td>{r.actualValue}</td><td>{r.severity}</td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Painting Defect Report" noPadding>
          <table className="erp-table">
            <thead><tr><th>Inspection</th><th>Parameter</th><th>Value</th><th>Severity</th></tr></thead>
            <tbody>{paintingDefects.map((r, i) => <tr key={i}><td>{r.inspectionNo}</td><td>{r.parameterName}</td><td>{r.actualValue}</td><td>{r.severity}</td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Pressure Test Report" noPadding>
          <table className="erp-table">
            <thead><tr><th>Inspection</th><th>Parameter</th><th>Value</th><th>Severity</th></tr></thead>
            <tbody>{pressureTestDefects.map((r, i) => <tr key={i}><td>{r.inspectionNo}</td><td>{r.parameterName}</td><td>{r.actualValue}</td><td>{r.severity}</td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Subcontract Return QC Report" noPadding>
          <table className="erp-table">
            <thead><tr><th>Inspection</th><th>Item</th><th>Parameter</th><th>Passed</th></tr></thead>
            <tbody>{subcontractReturn.map((r, i) => <tr key={i}><td>{r.inspectionNo}</td><td>{r.itemCode}</td><td>{r.parameterName}</td><td>{r.passed ? 'Yes' : 'No'}</td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Vendor Incoming Rejection" noPadding>
          <table className="erp-table">
            <thead><tr><th>Vendor</th><th>Item</th><th>Parameter</th></tr></thead>
            <tbody>{vendorRejections.map((r, i) => <tr key={i}><td>{r.vendorName}</td><td>{r.itemCode}</td><td>{r.rejectedParameter}</td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Final QC Checklist" noPadding>
          <table className="erp-table">
            <thead><tr><th>Inspection</th><th>Check</th><th>Passed</th></tr></thead>
            <tbody>{finalChecklist.map((r, i) => <tr key={i}><td>{r.inspectionNo}</td><td>{r.parameterName}</td><td>{r.passed ? 'Yes' : 'No'}</td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Pending Inspections" noPadding>
          <table className="erp-table">
            <thead><tr><th>No</th><th>Category</th><th>WO/GRN</th><th>Operation</th></tr></thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.inspectionId}>
                  <td><TableLink to={`/quality/inspections/${p.inspectionId}`}>{p.inspectionNo}</TableLink></td>
                  <td>{p.category}</td>
                  <td>{p.woNo ?? p.grnNo ?? '—'}</td>
                  <td>{p.operationName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="NCR Ageing (&gt;7 days)" noPadding>
          <table className="erp-table">
            <thead><tr><th>NCR</th><th>Source</th><th>Severity</th><th>Status</th></tr></thead>
            <tbody>
              {ageing.map((n) => (
                <tr key={n.id}>
                  <td><TableLink to={`/quality/ncr/${n.id}`}>{n.ncrNo}</TableLink></td>
                  <td>{n.source}</td>
                  <td>{n.severity}</td>
                  <td><Badge color={statusColor(n.status)}>{formatStatus(n.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  )
}

export function IncomingQcQueuePage() {
  const inspections = useIncomingPendingInspections()
  const [apiReadiness, setApiReadiness] = useState<IncomingQualityReadiness | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiMode()) return
    let cancelled = false
    void getIncomingQualityQueue()
      .then((res) => {
        if (!cancelled) setApiReadiness(res.data ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setApiError(err instanceof Error ? err.message : 'Failed to load incoming QC queue')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (isApiMode()) {
    const items = apiReadiness?.items ?? []
    const counts = apiReadiness?.counts
    return (
      <div className="erp-page">
        <PageHeader
          title="Incoming QC Queue"
          description="Purchase GRN material inspections — live from GRN QC_PENDING and purchase quality inspections."
          breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Incoming QC' }]}
          actions={(
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { void getIncomingQualityQueue().then((res) => setApiReadiness(res.data ?? null)) }}>
                Refresh
              </Button>
              <Button size="sm" onClick={() => { window.location.href = '/purchase/quality-inspections' }}>
                Open Purchase QI
              </Button>
            </div>
          )}
        />
        <SectionCard>
          {apiError ? (
            <p className="text-sm text-red-600" role="alert">{apiError}</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950">
                <p className="font-semibold">Incoming QC ready</p>
                <p className="mt-1">{apiReadiness?.message}</p>
                <p className="mt-2 font-mono text-[11px] text-emerald-800">{apiReadiness?.code ?? '…'}</p>
                {counts ? (
                  <p className="mt-2 text-[12px]">
                    {counts.grnPending} GRN pending · {counts.purchaseQiPending} open QI · {counts.total} total
                  </p>
                ) : null}
              </div>
              {items.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No pending incoming GRN QC right now.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full min-w-[720px] text-[13px]">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Number</th>
                        <th>Vendor</th>
                        <th>Status</th>
                        <th>Linked GRN</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={`${row.kind}:${row.id}`}>
                          <td>{row.kind === 'GRN' ? 'GRN' : 'Purchase QI'}</td>
                          <td className="font-mono">{row.number}</td>
                          <td>{row.vendorName ?? '—'}</td>
                          <td>{row.status}</td>
                          <td className="font-mono">{row.kind === 'PURCHASE_QI' ? (row.grnNumber ?? '—') : '—'}</td>
                          <td className="text-right">
                            <TableLink to={row.href}>Open →</TableLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="erp-page">
      <PageHeader title="Incoming QC Queue" description="GRN-triggered material inspections (demo)" breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Incoming QC' }]} />
      <SectionCard noPadding>
        <table className="erp-table">
          <thead><tr><th>Inspection</th><th>GRN</th><th>Item</th><th>Created</th></tr></thead>
          <tbody>
            {inspections.map((i) => (
              <tr key={i.id}>
                <td><TableLink to={`/quality/inspections/${i.id}`}>{i.inspectionNo}</TableLink></td>
                <td>{i.grnNo}</td>
                <td>{i.itemCode}</td>
                <td>{i.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}
