import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { TableLink } from '../../components/ui/AppLink'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { useIncomingPendingInspections, useQualityProductionReports } from '../../hooks/useStableStoreData'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
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

  return (
    <div className="erp-page">
      <PageHeader title="Incoming QC Queue" description="GRN-triggered material inspections" breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Incoming QC' }]} />
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
