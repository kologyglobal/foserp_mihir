import { useState } from 'react'
import { LocationSelect } from '../../components/masters/LocationSelect'
import { useActiveLocations } from '../../hooks/useMasterLists'
import { findLocationForWarehouse, getDefaultLocationId, resolveLocationWarehouseId } from '../../utils/locationUtils'
import type { WorkOrderMaterialLine } from '../../types/workorder'
import type { Vendor, Warehouse } from '../../types/master'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/forms/Inputs'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { workflowReceiveJobWork, workflowSendJobWork } from '../../utils/qrWorkflow'
import type { SubcontractShipment } from '../../types/workorder'
import { shipmentBalance } from '../../utils/jobWorkAdapter'

interface SendProps {
  woId: string
  lines: WorkOrderMaterialLine[]
  vendors: Vendor[]
  warehouses: Warehouse[]
  onSuccess: () => void
  onCancel: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-erp-muted">{label}</span>
      {children}
    </label>
  )
}

export function SendJobWorkForm({ woId, lines, vendors, warehouses, onSuccess, onCancel }: SendProps) {
  useQuickCreate()
  const locations = useActiveLocations()
  const defaultLocId = getDefaultLocationId(locations, 'production')
  const [lineId, setLineId] = useState(lines[0]?.id ?? '')
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [qty, setQty] = useState(String(lines[0]?.balanceQty ?? 1))
  const [locationId, setLocationId] = useState(
    () => findLocationForWarehouse(lines[0]?.warehouseId ?? '', locations)?.id ?? defaultLocId,
  )
  const [warehouseId, setWarehouseId] = useState(lines[0]?.warehouseId ?? warehouses[0]?.id ?? '')
  const [challanNo, setChallanNo] = useState(`CH-${Date.now().toString().slice(-6)}`)
  const [vehicleNo, setVehicleNo] = useState('')
  const [driver, setDriver] = useState('')
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  )
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = workflowSendJobWork({
      woId,
      lineId,
      vendorId,
      challanNo,
      qty: Number(qty),
      expectedReturnDate,
      warehouseId,
      vehicleNo: vehicleNo || undefined,
      driver: driver || undefined,
    })
    if (!r.ok) {
      setError(r.error ?? 'Send failed')
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-2">
      {error && <p className="col-span-full text-sm text-erp-danger">{error}</p>}
      <Field label="Item">
        <Select value={lineId} onChange={(e) => setLineId(e.target.value)}>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.itemCode}</option>)}
        </Select>
      </Field>
      <Field label="Vendor">
        <QuickCreateSelect
          entityType="vendor"
          value={vendorId}
          onChange={setVendorId}
          options={vendors.map((v) => ({
            id: v.id,
            label: `${v.vendorName}${v.isActive ? '' : ' (pending)'}`,
          }))}
          placeholder="Search vendors…"
        />
      </Field>
      <Field label="Qty"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
      <Field label="Location Code">
        <LocationSelect
          compact
          usage="production"
          value={locationId}
          onChange={(locId) => {
            setLocationId(locId)
            setWarehouseId(resolveLocationWarehouseId(locId, locations) ?? warehouseId)
          }}
        />
      </Field>
      <Field label="Challan No"><Input value={challanNo} onChange={(e) => setChallanNo(e.target.value)} required /></Field>
      <Field label="Vehicle No"><Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} /></Field>
      <Field label="Driver"><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></Field>
      <Field label="Expected Return Date"><Input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} required /></Field>
      <div className="col-span-full flex gap-2">
        <Button type="submit">Send Material</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

interface ReceiveProps {
  shipments: SubcontractShipment[]
  onSuccess: () => void
  onCancel: () => void
}

export function ReceiveJobWorkForm({ shipments, onSuccess, onCancel }: ReceiveProps) {
  const openShipments = shipments.filter((s) => shipmentBalance(s) > 0)
  const [shipmentId, setShipmentId] = useState(openShipments[0]?.id ?? '')
  const [acceptedQty, setAcceptedQty] = useState('0')
  const [rejectedQty, setRejectedQty] = useState('0')
  const [reworkQty, setReworkQty] = useState('0')
  const [qcRequired, setQcRequired] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selected = openShipments.find((s) => s.id === shipmentId)
  const balance = selected ? shipmentBalance(selected) : 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = workflowReceiveJobWork({
      shipmentId,
      acceptedQty: Number(acceptedQty),
      rejectedQty: Number(rejectedQty),
      reworkQty: Number(reworkQty),
      qcRequired,
      remarks,
    })
    if (!r.ok) {
      setError(r.error ?? 'Receive failed')
      return
    }
    onSuccess()
  }

  if (openShipments.length === 0) {
    return <p className="p-4 text-sm text-erp-muted">No shipments with pending balance to receive.</p>
  }

  return (
    <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-2">
      {error && <p className="col-span-full text-sm text-erp-danger">{error}</p>}
      <Field label="JWO / Challan">
        <Select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}>
          {openShipments.map((s) => (
            <option key={s.id} value={s.id}>{s.challanNo} (balance {shipmentBalance(s)})</option>
          ))}
        </Select>
      </Field>
      <p className="self-end text-sm text-erp-muted">Balance: {balance}</p>
      <Field label="Accepted Qty"><Input type="number" value={acceptedQty} onChange={(e) => setAcceptedQty(e.target.value)} /></Field>
      <Field label="Rejected Qty"><Input type="number" value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} /></Field>
      <Field label="Rework Qty"><Input type="number" value={reworkQty} onChange={(e) => setReworkQty(e.target.value)} /></Field>
      <label className="col-span-full flex items-center gap-2 text-sm">
        <input type="checkbox" checked={qcRequired} onChange={(e) => setQcRequired(e.target.checked)} />
        QC Required on accepted quantity
      </label>
      <Field label="Remarks"><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="col-span-full" /></Field>
      <div className="col-span-full flex gap-2">
        <Button type="submit">Receive Material</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
