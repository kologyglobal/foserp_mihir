import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useJobWorkOrders } from '../../utils/workOrder360Metrics'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMasterStore } from '../../store/masterStore'
import { formatDate } from '../../utils/dates/format'
export function JobWorkChallanPrintPage() {
  const { id } = useParams()
  const jwos = useJobWorkOrders()
  const jwo = jwos.find((j) => j.workOrderId === id)
  const subcontractShipments = useWorkOrderStore((s) => s.subcontractShipments)
  const shipments = useMemo(
    () => subcontractShipments.filter((sh) => sh.workOrderId === id),
    [subcontractShipments, id],
  )
  const getVendor = useMasterStore((s) => s.getVendor)
  const getItem = useMasterStore((s) => s.getItem)

  if (!jwo) return <p className="p-8">Job work order not found.</p>

  const vendor = jwo.vendorId ? getVendor(jwo.vendorId) : null

  return (
    <div className="erp-page print:p-8">
      <div className="mb-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-erp-primary px-4 py-2 text-white">
          Print Challan
        </button>
      </div>
      <h1 className="text-xl font-bold">Job Work Challan — {jwo.jwoNo}</h1>
      <p className="text-sm text-erp-muted">Source WO: {jwo.sourceWoNo} · SO: {jwo.parentSoNo}</p>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p><strong>Vendor:</strong> {vendor?.vendorName ?? jwo.vendorName}</p>
          <p><strong>Process:</strong> {jwo.process}</p>
        </div>
        <div>
          <p><strong>Expected Return:</strong> {jwo.expectedReturnDate ? formatDate(jwo.expectedReturnDate) : '—'}</p>
          <p><strong>Status:</strong> {jwo.status}</p>
        </div>
      </div>
      <table className="erp-table mt-6">
        <thead>
          <tr>
            <th>Challan No</th>
            <th>Item</th>
            <th>Qty Sent</th>
            <th>Vehicle</th>
            <th>Driver</th>
            <th>Sent Date</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s) => (
            <tr key={s.id}>
              <td>{s.challanNo}</td>
              <td>{getItem(s.itemId)?.itemCode ?? '—'}</td>
              <td>{s.sentQty}</td>
              <td>{s.vehicleNo ?? '—'}</td>
              <td>{s.driver ?? '—'}</td>
              <td>{s.sentAt ? formatDate(s.sentAt.slice(0, 10)) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-8 text-xs text-erp-muted">Generated from FOS ERP Job Work module</p>
    </div>
  )
}
