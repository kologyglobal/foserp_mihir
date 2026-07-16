import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useJobWorkOrders } from '../../utils/workOrder360Metrics'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
export function JobWorkOrderRegisterPage() {
  const navigate = useNavigate()
  const jwos = useJobWorkOrders()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = statusFilter === 'all' ? jwos : jwos.filter((j) => j.status === statusFilter)

  return (
    <div className="erp-page">
      <PageHeader
        title="Job Work Orders"
        description="Subcontract work orders presented as job work — send, receive, QC, and close."
        autoBreadcrumbs
        favoritePath="/job-work"
        actions={<Button onClick={() => navigate('/work-orders')}>Work Orders</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'draft', 'approved', 'in_process', 'partially_received', 'qc_pending', 'closed'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1 text-sm ${statusFilter === s ? 'border-erp-primary bg-erp-primary/10' : 'border-erp-border'}`}
          >
            {s === 'all' ? 'All' : formatStatus(s)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface">
        <table className="erp-table">
          <thead>
            <tr>
              <th>JWO No</th>
              <th>Source WO</th>
              <th>SO</th>
              <th>Vendor</th>
              <th>Process</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Received</th>
              <th className="text-right">Balance</th>
              <th>Expected Return</th>
              <th>Status</th>
              <th>QC</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={12} className="p-6 text-center text-erp-muted">No job work orders. Create subcontract WOs from MRP.</td></tr>
            ) : (
              filtered.map((j) => (
                <tr key={j.id}>
                  <td><Link to={`/job-work/${j.workOrderId}`} className="font-medium text-erp-primary">{j.jwoNo}</Link></td>
                  <td><Link to={`/work-orders/${j.workOrderId}`}>{j.sourceWoNo}</Link></td>
                  <td>{j.parentSoNo}</td>
                  <td>
                    {j.vendorId ? (
                      <Link to={`/job-work/vendors/${j.vendorId}`}>{j.vendorName}</Link>
                    ) : j.vendorName}
                  </td>
                  <td>{j.process}</td>
                  <td className="num">{formatNumber(j.sentQty)}</td>
                  <td className="num">{formatNumber(j.receivedQty)}</td>
                  <td className="num">{formatNumber(j.balanceQty)}</td>
                  <td>{j.expectedReturnDate ? formatDate(j.expectedReturnDate) : '—'}</td>
                  <td><Badge color={statusColor(j.status)}>{formatStatus(j.status)}</Badge></td>
                  <td>{formatStatus(j.qcStatus)}</td>
                  <td className="num">{formatCurrency(j.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
