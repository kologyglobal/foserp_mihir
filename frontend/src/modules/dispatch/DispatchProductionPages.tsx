import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { TableLink } from '../../components/ui/AppLink'
import { Badge, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { dispatchStatusLabel } from '../../types/dispatch'
import { useDispatchStore } from '../../store/dispatchStore'
import { useDispatchReports } from '../../hooks/useStableStoreData'
import { formatDate } from '../../utils/dates/format'
import { isApiMode } from '@/config/apiConfig'
export function DispatchReportsPage() {
  const { ready, pending, month, podPending } = useDispatchReports()
  const apiMode = isApiMode()

  return (
    <div className="erp-page">
      <PageHeader title="Dispatch Reports" description="Ready · Pending · Dispatched · POD pending" breadcrumbs={[{ label: 'Dispatch', to: '/dispatch' }, { label: 'Reports' }]} />
      {apiMode ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          <span>This is the demo dispatch report engine. Live ops reports for Dispatch run through the Manufacturing report runner.</span>
          <Link to="/manufacturing/reports/dispatch-readiness" className="whitespace-nowrap font-semibold text-erp-primary hover:underline">
            Open in Manufacturing Reports →
          </Link>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Dispatch Ready Trailers" noPadding>
          <table className="erp-table"><thead><tr><th>SO</th><th>Customer</th><th>Trailer</th><th>Chassis</th></tr></thead>
            <tbody>{ready.map((r, i) => <tr key={i}><td>{r.salesOrderNo}</td><td>{r.customerName}</td><td>{r.trailerNo}</td><td>{r.chassisNo}</td></tr>)}</tbody></table>
        </SectionCard>
        <SectionCard title="Pending Dispatch" noPadding>
          <table className="erp-table"><thead><tr><th>DC</th><th>SO</th><th>Status</th></tr></thead>
            <tbody>{pending.map((r) => <tr key={r.dispatchId}><td><TableLink to={`/dispatch/${r.dispatchId}`}>{r.dispatchNo}</TableLink></td><td>{r.salesOrderNo}</td><td>{dispatchStatusLabel(r.status)}</td></tr>)}</tbody></table>
        </SectionCard>
        <SectionCard title="Dispatched This Month" noPadding>
          <table className="erp-table"><thead><tr><th>DC</th><th>Customer</th><th>Date</th></tr></thead>
            <tbody>{month.map((r) => <tr key={r.dispatchId}><td>{r.dispatchNo}</td><td>{r.customerName}</td><td>{formatDate(r.plannedDate)}</td></tr>)}</tbody></table>
        </SectionCard>
        <SectionCard title="POD Pending" noPadding>
          <table className="erp-table"><thead><tr><th>DC</th><th>SO</th><th>Status</th></tr></thead>
            <tbody>{podPending.map((r) => <tr key={r.dispatchId}><td><TableLink to={`/dispatch/${r.dispatchId}`}>{r.dispatchNo}</TableLink></td><td>{r.salesOrderNo}</td><td><Badge color={statusColor(r.status)}>{dispatchStatusLabel(r.status)}</Badge></td></tr>)}</tbody></table>
        </SectionCard>
      </div>
    </div>
  )
}

export function GatePassPrintPage() {
  const { id } = useParams()
  const plan = useDispatchStore((s) => (id ? s.getDispatch(id) : undefined))
  if (!id || !plan) {
    return <div className="erp-page p-12 text-center text-erp-muted">Dispatch not found</div>
  }
  if (!plan.gatePass) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        Gate pass not issued yet.{' '}
        <Link to={`/dispatch/${id}`} className="text-erp-accent hover:underline">Back to dispatch</Link>
      </div>
    )
  }
  return (
    <div className="erp-page">
      <div className="no-print mb-4 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print Gate Pass
        </Button>
        <Link to={`/dispatch/${id}`}>
          <Button size="sm" variant="ghost">Back to dispatch</Button>
        </Link>
      </div>
      <GatePassPrintView dispatchId={id} />
    </div>
  )
}

export function GatePassPrintView({ dispatchId }: { dispatchId: string }) {
  const plan = useDispatchStore((s) => s.getDispatch(dispatchId))
  if (!plan?.gatePass) return null
  const gp = plan.gatePass
  return (
    <div className="print:p-8">
      <h1 className="text-xl font-bold">Gate Pass — {gp.gatePassNo}</h1>
      <p>Dispatch: {plan.dispatchNo} · SO: {plan.salesOrderNo}</p>
      <p>Vehicle: {gp.vehicleNo} · Driver: {gp.driverName} ({gp.driverPhone})</p>
      <p>Transporter: {gp.transporter} · LR: {gp.lrNo}</p>
      <p>Security: {gp.securityApprovedBy} · {gp.securityApprovedAt?.slice(0, 16)}</p>
    </div>
  )
}
