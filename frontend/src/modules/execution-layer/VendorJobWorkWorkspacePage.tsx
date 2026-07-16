import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { SectionCard } from '../../components/ui/SectionCard'
import { useMasterStore } from '../../store/masterStore'
import { useVendorJobWorkMetrics } from '../../utils/workOrder360Metrics'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
export function VendorJobWorkWorkspacePage() {
  const { vendorId } = useParams()
  const vendor = useMasterStore((s) => (vendorId ? s.getVendor(vendorId) : undefined))
  const metrics = useVendorJobWorkMetrics(vendorId)

  if (!vendor || !metrics) return <p className="p-8 text-erp-muted">Vendor not found.</p>

  return (
    <div className="erp-page">
      <PageHeader
        title={`${vendor.vendorName} — Job Work`}
        description="Open JWO, material at vendor, returns, spend, and quality performance."
        autoBreadcrumbs
        favoritePath={`/job-work/vendors/${vendorId}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Open JWO', metrics.openJwo.length],
          ['Material with Vendor', formatNumber(metrics.materialWithVendor)],
          ['Pending Return', metrics.pendingReturn],
          ['Job Work Spend', formatCurrency(metrics.jobWorkSpend)],
          ['Rejection %', `${metrics.rejectionPct}%`],
          ['On-Time Return %', `${metrics.onTimeReturnPct}%`],
          ['Avg Turnaround', `${metrics.avgTurnaroundDays} days`],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg border border-erp-border bg-erp-surface p-3">
            <p className="text-[11px] font-semibold uppercase text-erp-muted">{label}</p>
            <p className="mt-1 text-lg font-bold">{val}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Open Job Work Orders" noPadding>
        <table className="erp-table">
          <thead>
            <tr>
              <th>JWO</th>
              <th>WO</th>
              <th>Process</th>
              <th className="text-right">Balance</th>
              <th>Expected Return</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.openJwo.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-erp-muted">No open job work.</td></tr>
            ) : (
              metrics.openJwo.map((j) => (
                <tr key={j.id}>
                  <td><Link to={`/job-work/${j.workOrderId}`}>{j.jwoNo}</Link></td>
                  <td>{j.sourceWoNo}</td>
                  <td>{j.process}</td>
                  <td className="num">{formatNumber(j.balanceQty)}</td>
                  <td>{j.expectedReturnDate ? formatDate(j.expectedReturnDate) : '—'}</td>
                  <td><Badge color={statusColor(j.status)}>{formatStatus(j.status)}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Subcontract NCRs" noPadding className="mt-4">
        <table className="erp-table">
          <thead><tr><th>NCR</th><th>WO</th><th>Item</th><th>Status</th></tr></thead>
          <tbody>
            {metrics.vendorNcrs.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-erp-muted">No subcontract NCRs.</td></tr>
            ) : (
              metrics.vendorNcrs.map((n) => (
                <tr key={n.id}>
                  <td><Link to={`/quality/ncr/${n.id}`}>{n.ncrNo}</Link></td>
                  <td>{n.woNo}</td>
                  <td>{n.itemCode}</td>
                  <td>{formatStatus(n.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SectionCard>

      <p className="mt-4 text-sm">
        <Link to={`/masters/vendors/${vendorId}`} className="text-erp-primary">Vendor 360 →</Link>
      </p>
    </div>
  )
}
