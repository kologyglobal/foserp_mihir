import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import {
  dispatchJobWorkOrder,
  getJobWorkOrder,
  listJobWorkOrders,
  receiveJobWorkOrder,
} from '@/services/api/manufacturingApi'
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

type JobWorkRow = {
  id: string
  jwNumber?: string
  jobWorkNumber?: string
  status?: string
  processName?: string
  vendor?: { name?: string } | null
  materialLines?: Array<{ id: string; item?: { code?: string }; orderedQty?: string | number; dispatchedQty?: string | number }>
  orderedQty?: string | number
}

function jwLabel(wo: JobWorkRow) {
  return wo.jwNumber ?? wo.jobWorkNumber ?? wo.id
}

export function MobileJobWorkListPage() {
  const navigate = useNavigate()
  const demoJwos = useSubcontractWorkOrders()
  const [apiRows, setApiRows] = useState<JobWorkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) return
    setLoading(true)
    setError('')
    try {
      const res = await listJobWorkOrders({ limit: 50 })
      setApiRows((res.data as JobWorkRow[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load job work')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (isApiMode()) {
    return (
      <>
        <MobilePageTitle title="Job Work" subtitle={loading ? 'Loading…' : `${apiRows.length} orders`} />
        {error ? <div className="mob-card text-sm text-[#c42b2f] mb-3">{error}</div> : null}
        {apiRows.slice(0, 40).map((wo) => (
          <div key={wo.id} className="mob-card mb-2">
            <div className="font-semibold">{jwLabel(wo)}</div>
            <div className="text-sm text-[#605e5c]">{wo.processName} · {wo.vendor?.name ?? '—'}</div>
            <MobileStatusChip label={wo.status ?? '—'} tone="amber" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button type="button" className="mob-btn mob-btn-primary" onClick={() => navigate(`/m/job-work/${wo.id}/send`)}>
                Send
              </button>
              <button type="button" className="mob-btn mob-btn-secondary" onClick={() => navigate(`/m/job-work/${wo.id}/receive`)}>
                Receive
              </button>
            </div>
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      <MobilePageTitle title="Job Work" subtitle="Subcontract send / receive (demo)" />
      {demoJwos.slice(0, 30).map((wo) => (
        <div key={wo.id} className="mob-card mb-2">
          <div className="font-semibold">{wo.woNo}</div>
          <MobileStatusChip label={wo.status} tone="amber" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button type="button" className="mob-btn mob-btn-primary" onClick={() => navigate(`/m/job-work/${wo.id}/send`)}>
              Send
            </button>
            <button type="button" className="mob-btn mob-btn-secondary" onClick={() => navigate(`/m/job-work/${wo.id}/receive`)}>
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
  const demoWo = useWorkOrderStore((s) => s.getWorkOrder(id ?? ''))
  const vendors = useActiveVendors()
  const demoLines = demoWo ? useWorkOrderStore.getState().getWoMaterials(demoWo.id) : []
  const [apiJw, setApiJw] = useState<JobWorkRow | null>(null)
  const [lineId, setLineId] = useState('')
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [scan, setScan] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isApiMode() || !id) return
    void getJobWorkOrder(id)
      .then((res) => {
        const row = res.data as JobWorkRow
        setApiJw(row)
        setLineId(row.materialLines?.[0]?.id ?? '')
      })
      .catch((err) => setMsg(err instanceof Error ? err.message : 'Not found'))
  }, [id])

  if (isApiMode()) {
    if (!apiJw && !msg) return <MobilePageTitle title="Send" subtitle="Loading…" />
    if (!apiJw) return <MobilePageTitle title="Send" subtitle={msg || 'Not found'} />

    async function submit() {
      if (!lineId) {
        setMsg('Select a material line')
        return
      }
      setBusy(true)
      setMsg('')
      try {
        await dispatchJobWorkOrder(apiJw!.id, {
          vendorChallan: scan || `MOB-${Date.now().toString().slice(-6)}`,
          remarks: 'Mobile job-work dispatch',
          lines: [{ materialLineId: lineId, quantity: qty }],
        })
        setMsg('Material dispatched to vendor')
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Dispatch failed')
      } finally {
        setBusy(false)
      }
    }

    return (
      <>
        <MobilePageTitle title="Send to Vendor" subtitle={jwLabel(apiJw)} />
        <div className="mob-field mb-2">
          <label>Material line</label>
          <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
            {(apiJw.materialLines ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.item?.code ?? l.id}
              </option>
            ))}
          </select>
        </div>
        <input className="mob-scan-input mb-2" placeholder="Vendor challan / scan" value={scan} onChange={(e) => setScan(e.target.value)} />
        <MobileStepperInput value={qty} onChange={setQty} />
        {msg && <div className="mob-card text-sm">{msg}</div>}
        <MobileStickyActionBar>
          <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
            Send Material
          </button>
        </MobileStickyActionBar>
      </>
    )
  }

  if (!demoWo) return <MobilePageTitle title="Send" subtitle="JWO not found" />

  function submitDemo() {
    const r = scanSubcontractSend({
      scan: scan || demoWo!.woNo,
      woId: demoWo!.id,
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
      <MobilePageTitle title="Send to Vendor" subtitle={demoWo.woNo} />
      <div className="mob-field mb-2">
        <label>Material line</label>
        <select value={lineId || demoLines[0]?.id} onChange={(e) => setLineId(e.target.value)}>
          {demoLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.itemCode}
            </option>
          ))}
        </select>
      </div>
      <div className="mob-field mb-2">
        <label>Vendor</label>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vendorName}
            </option>
          ))}
        </select>
      </div>
      <input className="mob-scan-input mb-2" placeholder="Scan material" value={scan} onChange={(e) => setScan(e.target.value)} />
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submitDemo}>
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
  const [acceptedQty, setAcceptedQty] = useState(1)
  const [scan, setScan] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiJw, setApiJw] = useState<JobWorkRow | null>(null)

  useEffect(() => {
    if (!isApiMode() || !id) return
    void getJobWorkOrder(id)
      .then((res) => setApiJw(res.data as JobWorkRow))
      .catch((err) => setMsg(err instanceof Error ? err.message : 'Not found'))
  }, [id])

  if (isApiMode()) {
    if (!apiJw && !msg) return <MobilePageTitle title="Receive" subtitle="Loading…" />
    if (!apiJw) return <MobilePageTitle title="Receive" subtitle={msg || 'Not found'} />

    async function submit() {
      setBusy(true)
      setMsg('')
      try {
        await receiveJobWorkOrder(apiJw!.id, {
          receivedQty,
          acceptedQty: Math.min(acceptedQty, receivedQty),
          rejectedQty: Math.max(0, receivedQty - acceptedQty),
          vendorChallan: scan || undefined,
          remarks: 'Mobile job-work receive',
        })
        setMsg('Receipt recorded')
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Receive failed')
      } finally {
        setBusy(false)
      }
    }

    return (
      <>
        <MobilePageTitle title="Receive from Vendor" subtitle={jwLabel(apiJw)} />
        <input className="mob-scan-input mb-2" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Vendor challan" />
        <div className="mob-field mb-2">
          <label>Received qty</label>
          <MobileStepperInput value={receivedQty} onChange={setReceivedQty} />
        </div>
        <div className="mob-field mb-2">
          <label>Accepted qty</label>
          <MobileStepperInput value={acceptedQty} onChange={setAcceptedQty} />
        </div>
        {msg && <div className="mob-card text-sm">{msg}</div>}
        <MobileStickyActionBar>
          <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
            Receive
          </button>
        </MobileStickyActionBar>
      </>
    )
  }

  function submitDemo() {
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
            <option key={s.id} value={s.id}>
              {s.challanNo} — sent {s.sentQty}
            </option>
          ))}
        </select>
      </div>
      <input className="mob-scan-input mb-2" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan JWO QR" />
      <MobileStepperInput value={receivedQty} onChange={setReceivedQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submitDemo}>
          Receive
        </button>
      </MobileStickyActionBar>
    </>
  )
}
