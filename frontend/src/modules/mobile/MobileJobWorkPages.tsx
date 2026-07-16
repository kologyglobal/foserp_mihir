import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useSubcontractWorkOrders, useSubcontractShipmentsForWorkOrder } from '../../hooks/useStableStoreData'
import { useActiveVendors } from '../../hooks/useMasterLists'
import { scanSubcontractSend, scanSubcontractReceive } from '../../utils/barcodeEngine'
import {
  MobilePageTitle,
  MobileStatusChip,
  MobileStepperInput,
  MobileStickyActionBar,
} from '../../components/mobile'

export function MobileJobWorkListPage() {
  const navigate = useNavigate()
  const jwos = useSubcontractWorkOrders()

  return (
    <>
      <MobilePageTitle title="Job Work" subtitle="Subcontract send / receive" />
      {jwos.slice(0, 30).map((wo) => (
        <div key={wo.id} className="mob-card mb-2">
          <div className="font-semibold">{wo.woNo}</div>
          <MobileStatusChip label={wo.status} tone="amber" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button type="button" className="mob-btn mob-btn-primary" onClick={() => navigate(`/m/job-work-send/${wo.id}`)}>
              Send
            </button>
            <button type="button" className="mob-btn mob-btn-secondary" onClick={() => navigate(`/m/job-work-receive/${wo.id}`)}>
              Receive
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

export function MobileJobWorkSendPage() {
  const { id } = useParams<{ id: string }>()
  const wo = useWorkOrderStore((s) => s.getWorkOrder(id ?? ''))
  const vendors = useActiveVendors()
  const lines = wo ? useWorkOrderStore.getState().getWoMaterials(wo.id) : []
  const [lineId, setLineId] = useState(lines[0]?.id ?? '')
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [scan, setScan] = useState('')
  const [msg, setMsg] = useState('')

  if (!wo) return <MobilePageTitle title="Send" subtitle="JWO not found" />

  function submit() {
    const r = scanSubcontractSend({
      scan: scan || wo!.woNo,
      woId: wo!.id,
      lineId,
      vendorId,
      challanNo: `MOB-${Date.now().toString().slice(-6)}`,
      qty,
      expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    })
    setMsg(r.ok ? r.message ?? 'Sent' : r.error ?? 'Failed')
  }

  return (
    <>
      <MobilePageTitle title="Send to Vendor" subtitle={wo.woNo} />
      <div className="mob-field mb-2">
        <label>Material line</label>
        <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.itemCode}</option>
          ))}
        </select>
      </div>
      <div className="mob-field mb-2">
        <label>Vendor</label>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.vendorName}</option>
          ))}
        </select>
      </div>
      <input className="mob-scan-input mb-2" placeholder="Scan material" value={scan} onChange={(e) => setScan(e.target.value)} />
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Send Material
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileJobWorkReceivePage() {
  const { id } = useParams<{ id: string }>()
  const shipments = useSubcontractShipmentsForWorkOrder(id)
  const [shipmentId, setShipmentId] = useState(shipments[0]?.id ?? '')
  const [receivedQty, setReceivedQty] = useState(1)
  const [scan, setScan] = useState('')
  const [msg, setMsg] = useState('')

  function submit() {
    const sh = shipments.find((s) => s.id === shipmentId)
    if (sh && receivedQty > sh.sentQty) {
      setMsg('Receive cannot exceed sent balance')
      return
    }
    const r = scanSubcontractReceive({ scan: scan || shipmentId, shipmentId, receivedQty })
    setMsg(r.ok ? r.message ?? 'Received' : r.error ?? 'Failed')
  }

  return (
    <>
      <MobilePageTitle title="Receive from Vendor" />
      <div className="mob-field mb-2">
        <label>Shipment</label>
        <select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}>
          {shipments.map((s) => (
            <option key={s.id} value={s.id}>{s.challanNo} — sent {s.sentQty}</option>
          ))}
        </select>
      </div>
      <input className="mob-scan-input mb-2" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan JWO QR" />
      <MobileStepperInput value={receivedQty} onChange={setReceivedQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Receive
        </button>
      </MobileStickyActionBar>
    </>
  )
}
