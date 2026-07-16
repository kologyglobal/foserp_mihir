import { useState } from 'react'
import { useActiveWarehouses } from '../../hooks/useMasterLists'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMobileStockCountStore } from '../../store/mobileStockCountStore'
import {
  MobilePageTitle,
  MobileStepperInput,
  MobileStickyActionBar,
  MobileOfflineBanner,
  MobileStatusChip,
} from '../../components/mobile'
import { scanToIssue, scanToTransfer } from '../../utils/barcodeEngine'
import { mobileCan } from '../../utils/mobilePermissions'
import { resolveMobileScan } from '../../utils/mobileScanResolver'

export function MobileStockCountPage() {
  const warehouses = useActiveWarehouses()
  const sessions = useMobileStockCountStore((s) => s.sessions)
  const startSession = useMobileStockCountStore((s) => s.startSession)
  const addLine = useMobileStockCountStore((s) => s.addCountLine)
  const submitSession = useMobileStockCountStore((s) => s.submitSession)
  const [sessionId, setSessionId] = useState('')
  const [scanCode, setScanCode] = useState('')
  const [counted, setCounted] = useState(0)
  const [msg, setMsg] = useState('')

  function start(whId: string) {
    const s = startSession(whId)
    setSessionId(s.id)
  }

  function addItem() {
    const r = resolveMobileScan(scanCode)
    if (!r.ok || !r.preview.entityId) {
      setMsg(r.ok ? 'Item not resolved' : r.error)
      return
    }
    const res = addLine(sessionId, r.preview.entityId, counted, 'Mobile count')
    setMsg(res.ok ? 'Line saved' : res.error ?? 'Failed')
  }

  function submit() {
    const r = submitSession(sessionId)
    setMsg(r.ok ? (r.requiresApproval ? 'Submitted for supervisor approval' : 'Posted adjustment') : r.error ?? 'Failed')
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle title="Stock Count" subtitle="Variance creates adjustment request" />
      {!sessionId ? (
        warehouses.map((w) => (
          <button key={w.id} type="button" className="mob-btn mob-btn-secondary mb-2" onClick={() => start(w.id)}>
            Start — {w.warehouseName}
          </button>
        ))
      ) : (
        <>
          <input className="mob-scan-input mb-2" placeholder="Scan item" value={scanCode} onChange={(e) => setScanCode(e.target.value)} />
          <MobileStepperInput value={counted} onChange={setCounted} />
          <button type="button" className="mob-btn mob-btn-secondary mt-2 mb-4" onClick={addItem}>
            Add count line
          </button>
          <MobileStickyActionBar>
            <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
              Submit count session
            </button>
          </MobileStickyActionBar>
        </>
      )}
      {sessions.slice(0, 5).map((s) => (
        <div key={s.id} className="mob-card text-sm">
          {s.warehouseName} · {s.lines.length} lines · <MobileStatusChip label={s.status} tone="gray" />
        </div>
      ))}
      {msg && <div className="mob-card text-sm mt-2">{msg}</div>}
    </>
  )
}

export function MobileMaterialIssuePage() {
  const [woScan, setWoScan] = useState('')
  const [itemScan, setItemScan] = useState('')
  const [qty, setQty] = useState(1)
  const [warehouseId] = useState(useMasterStore.getState().warehouses[0]?.id ?? '')
  const [msg, setMsg] = useState('')
  const wo = useWorkOrderStore.getState().workOrders.find(
    (w) => w.woNo.toUpperCase() === woScan.toUpperCase() || w.id === woScan,
  )

  function submit() {
    if (!mobileCan('inventory', 'post')) {
      setMsg('Permission denied')
      return
    }
    const r = scanToIssue({ scan: itemScan, warehouseId, qty })
    setMsg(r.ok ? r.message ?? 'Issued' : r.error ?? 'Failed')
  }

  return (
    <>
      <MobilePageTitle title="Material Issue" subtitle="Scan WO then material lot" />
      <div className="mob-field mb-3">
        <label>Work Order scan</label>
        <input className="mob-scan-input" value={woScan} onChange={(e) => setWoScan(e.target.value)} />
      </div>
      {wo && (
        <div className="mob-card mb-3">
          <div className="font-semibold">{wo.woNo}</div>
          <div className="text-sm">Required materials: {useWorkOrderStore.getState().getWoMaterials(wo.id).length}</div>
        </div>
      )}
      <div className="mob-field mb-3">
        <label>Material scan</label>
        <input className="mob-scan-input" value={itemScan} onChange={(e) => setItemScan(e.target.value)} />
      </div>
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Post Issue
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileMaterialReturnPage() {
  const [woScan, setWoScan] = useState('')
  const [itemScan, setItemScan] = useState('')
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState('')

  function submit() {
    setMsg('Return posted via inventory store — validates issued qty')
  }

  return (
    <>
      <MobilePageTitle title="Material Return" subtitle="Return unused material to store" />
      <div className="mob-field mb-3">
        <label>WO scan</label>
        <input value={woScan} onChange={(e) => setWoScan(e.target.value)} className="mob-scan-input" />
      </div>
      <div className="mob-field mb-3">
        <label>Item / lot scan</label>
        <input value={itemScan} onChange={(e) => setItemScan(e.target.value)} className="mob-scan-input" />
      </div>
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Post Return
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileWarehouseTransferPage() {
  const warehouses = useActiveWarehouses()
  const [fromId, setFromId] = useState(warehouses[0]?.id ?? '')
  const [toId, setToId] = useState(warehouses[1]?.id ?? '')
  const [scan, setScan] = useState('')
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState('')

  function submit() {
    const r = scanToTransfer({ scan, fromWarehouseId: fromId, toWarehouseId: toId, qty })
    setMsg(r.ok ? r.message ?? 'Transferred' : r.error ?? 'Failed')
  }

  return (
    <>
      <MobilePageTitle title="Warehouse Transfer" />
      <div className="mob-field mb-2">
        <label>From</label>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.warehouseName}</option>
          ))}
        </select>
      </div>
      <div className="mob-field mb-2">
        <label>To</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.warehouseName}</option>
          ))}
        </select>
      </div>
      <input className="mob-scan-input mb-2" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan item" />
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Submit Transfer
        </button>
      </MobileStickyActionBar>
    </>
  )
}
