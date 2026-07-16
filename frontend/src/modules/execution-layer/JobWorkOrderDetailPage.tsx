import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SectionCard } from '../../components/ui/SectionCard'
import { useJobWorkOrders } from '../../utils/workOrder360Metrics'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useJobWorkExecutionStore } from '../../store/jobWorkExecutionStore'
import { useMasterStore } from '../../store/masterStore'
import { SendJobWorkForm, ReceiveJobWorkForm } from '@/components/execution-layer/JobWorkSendReceiveForms'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { shipmentBalance } from '../../utils/jobWorkAdapter'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'
import { useQrStore } from '../../store/qrStore'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'
import { NextBestActionPanel } from '../../components/live-erp'
import { buildJobWorkNextActions } from '../../utils/liveErpMetrics'

export function JobWorkOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const jwos = useJobWorkOrders()
  const jwo = jwos.find((j) => j.workOrderId === id)
  const shipments = useWorkOrderStore((s) => s.subcontractShipments)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const vendors = useMasterStore((s) => s.vendors)
  const warehouses = useMasterStore((s) => s.warehouses)
  const approveJobWork = useJobWorkExecutionStore((s) => s.approveJobWork)
  const closeJobWork = useJobWorkExecutionStore((s) => s.closeJobWork)
  const [toast, setToast] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'send' | 'receive'>('view')

  const woShipments = useMemo(
    () => shipments.filter((s) => s.workOrderId === id),
    [shipments, id],
  )
  const latestShipment = woShipments[0]
  const jwoQr = useQrStore((s) =>
    latestShipment ? s.getForEntity('JOB_WORK_ORDER', latestShipment.id)[0] : undefined,
  )
  const matLines = useMemo(
    () => materialLines.filter((l) => l.workOrderId === id),
    [materialLines, id],
  )

  if (!jwo || !id) return <p className="p-8 text-erp-muted">Job work order not found.</p>

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="erp-page max-w-5xl">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-erp-border bg-erp-surface px-6 py-3 text-sm font-medium shadow-erp-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title={jwo.jwoNo}
        description={`${jwo.sourceWoNo} · ${jwo.vendorName} · ${jwo.process}`}
        autoBreadcrumbs
        favoritePath={`/job-work/${id}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/work-orders/${id}/360`)}>WO 360</Button>
            <Button variant="secondary" onClick={() => navigate(`/job-work/${id}/print`)}>Print Challan</Button>
            {!['closed', 'received'].includes(jwo.status) && (
              <>
                <Button variant="secondary" onClick={() => { const r = approveJobWork(id); show(r.ok ? 'Approved' : r.error ?? 'Failed') }}>Approve</Button>
                <Button onClick={() => setMode('send')}>Send Material</Button>
                <Button onClick={() => setMode('receive')}>Receive Material</Button>
                <Button variant="secondary" onClick={() => navigate('/quality/queue')}>Raise QC</Button>
                <Button variant="secondary" onClick={() => navigate('/quality/ncr')}>Raise NCR</Button>
                <Button variant="secondary" onClick={() => { const r = closeJobWork(id); show(r.ok ? 'Closed' : r.error ?? 'Close failed') }}>Close</Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 max-w-md">
        <NextBestActionPanel actions={buildJobWorkNextActions(jwo)} title="Next Best Actions" compact />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Status', formatStatus(jwo.status)],
          ['Sent Qty', formatNumber(jwo.sentQty)],
          ['Received', formatNumber(jwo.receivedQty)],
          ['Balance', formatNumber(jwo.balanceQty)],
          ['Rejected', formatNumber(jwo.rejectedQty)],
          ['Rework', formatNumber(jwo.reworkQty)],
          ['Rate', formatCurrency(jwo.rate)],
          ['Amount', formatCurrency(jwo.amount)],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg border border-erp-border bg-erp-surface p-3">
            <p className="text-[11px] font-semibold uppercase text-erp-muted">{label}</p>
            <p className="mt-1 font-bold">{val}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-erp-border bg-erp-surface p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-erp-muted">QR Traceability</p>
        {latestShipment ? (
          <EntityQrToolbar
            entityType="JOB_WORK_ORDER"
            entityId={latestShipment.id}
            displayCode={jwoQr?.displayCode ?? `${jwo.jwoNo}-${latestShipment.challanNo}`}
            metadata={{
              shipmentId: latestShipment.id,
              challanNo: latestShipment.challanNo,
              woId: id,
              woNo: jwo.sourceWoNo,
              vendorId: jwo.vendorId ?? undefined,
              vendorName: jwo.vendorName,
            }}
            payload={{ wo: jwo.sourceWoNo, vendor: jwo.vendorName }}
          />
        ) : (
          <EntityQrToolbar
            entityType="WORK_ORDER"
            entityId={id}
            displayCode={jwo.sourceWoNo}
            metadata={{ woId: id, woNo: jwo.sourceWoNo }}
            payload={{ wo: jwo.sourceWoNo }}
          />
        )}
      </div>

      {mode === 'send' && (
        <SectionCard title="Send To Vendor" className="mb-4">
          <SendJobWorkForm
            woId={id}
            lines={matLines}
            vendors={vendors}
            warehouses={warehouses}
            onSuccess={() => { setMode('view'); show('Material sent') }}
            onCancel={() => setMode('view')}
          />
        </SectionCard>
      )}

      {mode === 'receive' && (
        <SectionCard title="Receive From Vendor" className="mb-4">
          <ReceiveJobWorkForm
            shipments={woShipments}
            onSuccess={() => { setMode('view'); show('Material received') }}
            onCancel={() => setMode('view')}
          />
        </SectionCard>
      )}

      <SectionCard title="Shipments" noPadding>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Challan</th>
              <th>Item</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Received</th>
              <th className="text-right">Rejected</th>
              <th className="text-right">Balance</th>
              <th>Vehicle</th>
              <th>Expected Return</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {woShipments.length === 0 ? (
              <tr><td colSpan={9} className="p-4 text-center text-erp-muted">No shipments yet.</td></tr>
            ) : (
              woShipments.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/job-work/${id}/print`}>{s.challanNo}</Link></td>
                  <td>{matLines.find((l) => l.itemId === s.itemId)?.itemCode ?? '—'}</td>
                  <td className="num">{s.sentQty}</td>
                  <td className="num">{s.receivedQty}</td>
                  <td className="num">{s.rejectedQty}</td>
                  <td className="num">{shipmentBalance(s)}</td>
                  <td>{s.vehicleNo ?? '—'}</td>
                  <td>{formatDate(s.expectedReturnDate)}</td>
                  <td><Badge color={statusColor(s.status)}>{formatStatus(s.status)}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Serialized Components" className="mt-4">
        <div className="p-4">
          <SerialGenealogyPanel workOrderId={id} />
        </div>
      </SectionCard>

      <SectionCard title="Job Work Documents" className="mt-4">
        <div className="p-4">
          <EntityDocumentsPanel entityType="job_work" entityId={id} entityLabel={jwo.jwoNo} />
        </div>
      </SectionCard>

      <SectionCard title="Linked Records" className="mt-4">
        <ul className="space-y-1 text-sm">
          <li><Link to={`/work-orders/${id}`}>Source WO {jwo.sourceWoNo}</Link></li>
          <li><Link to={`/sales/orders/${jwo.parentSoId}`}>Sales Order {jwo.parentSoNo}</Link></li>
          {jwo.vendorId && <li><Link to={`/job-work/vendors/${jwo.vendorId}`}>Vendor workspace</Link></li>}
        </ul>
      </SectionCard>
    </div>
  )
}
