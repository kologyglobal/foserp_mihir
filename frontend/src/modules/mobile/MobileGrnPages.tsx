import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import {
  MobilePageTitle,
  MobileStatusChip,
  MobileStepperInput,
  MobileStickyActionBar,
  MobilePhotoCapture,
  MobileOfflineBanner,
} from '../../components/mobile'
import { mobileGrnCanReceive } from '../../utils/mobilePermissions'
import { resolveMobileScan } from '../../utils/mobileScanResolver'

export function MobileGrnListPage() {
  const navigate = useNavigate()
  const pos = usePurchaseStore((s) =>
    s.purchaseOrders.filter(
      (p) => !['closed', 'cancelled'].includes(p.status) && p.lines.some((l) => l.receivedQty < l.qty),
    ),
  )

  return (
    <>
      <MobilePageTitle title="GRN Receiving" subtitle="Scan PO or select open order" />
      <button
        type="button"
        className="mob-btn mob-btn-secondary mb-4"
        onClick={() => {
          const code = window.prompt('Scan / enter PO number:')
          if (!code) return
          const r = resolveMobileScan(code)
          if (r.ok && r.preview.entityId) navigate(`/m/grn/${r.preview.entityId}`)
        }}
      >
        Scan PO
      </button>
      {pos.map((po) => (
        <button
          key={po.id}
          type="button"
          className="mob-card w-full text-left mb-2"
          onClick={() => navigate(`/m/grn/${po.id}`)}
        >
          <div className="font-semibold">{po.poNo}</div>
          <div className="text-sm text-[#605e5c]">
            {useMasterStore.getState().getVendor(po.vendorId)?.vendorName}
          </div>
          <MobileStatusChip label={po.status} tone="amber" />
        </button>
      ))}
    </>
  )
}

export function MobileGrnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const po = usePurchaseStore((s) => s.getPo(id ?? ''))
  const grn = usePurchaseStore((s) => s.grns.find((g) => g.poId === id))

  if (!po) {
    return <MobilePageTitle title="GRN" subtitle="PO not found" />
  }

  return (
    <>
      <MobilePageTitle title={po.poNo} subtitle="Select line to receive" />
      {po.lines.map((line) => {
        const item = useMasterStore.getState().getItem(line.itemId)
        const open = line.qty - line.receivedQty
        return (
          <button
            key={line.id}
            type="button"
            className="mob-card w-full text-left mb-2"
            disabled={open <= 0}
            onClick={() => navigate(`/m/grn/${po.id}/receive?lineId=${line.id}`)}
          >
            <div className="font-semibold">{item?.itemCode ?? line.itemId}</div>
            <div className="text-sm">{item?.itemName}</div>
            <div className="text-sm mt-1">Open: {open} / {line.qty}</div>
          </button>
        )
      })}
      {grn && (
        <div className="mob-card mt-4">
          Latest GRN: {grn.grnNo} · <MobileStatusChip label={grn.status} tone="green" />
        </div>
      )}
    </>
  )
}

export function MobileGrnReceivePage() {
  const { id } = useParams<{ id: string }>()
  const params = new URLSearchParams(window.location.search)
  const lineId = params.get('lineId') ?? ''
  const navigate = useNavigate()
  const po = usePurchaseStore((s) => s.getPo(id ?? ''))
  const postGrn = usePurchaseStore((s) => s.postGrn)
  const line = po?.lines.find((l) => l.id === lineId)
  const item = line ? useMasterStore.getState().getItem(line.itemId) : undefined
  const open = line ? line.qty - line.receivedQty : 0
  const [qty, setQty] = useState(open > 0 ? open : 0)
  const [batch, setBatch] = useState('')
  const [damaged, setDamaged] = useState(false)
  const [msg, setMsg] = useState('')
  const canReceive = mobileGrnCanReceive()

  if (!po || !line || !item) {
    return <MobilePageTitle title="Receive" subtitle="Line not found" />
  }

  function submit() {
    if (!canReceive) {
      setMsg('Permission denied')
      return
    }
    if (!item!.isActive) {
      setMsg('Cannot receive inactive item')
      return
    }
    if (qty <= 0 || qty > open + open * 0.05) {
      setMsg(`Qty must be 1–${open} (within PO tolerance)`)
      return
    }
    const r = postGrn(po!.id, [{ poLineId: line!.id, receivedQty: qty }])
    if (!r.ok) {
      setMsg(r.error ?? 'GRN failed')
      return
    }
    setMsg(`GRN posted${r.grnId ? '' : ''} — ${damaged ? 'QC hold flagged' : 'inventory updated'}`)
    setTimeout(() => navigate(`/m/grn/${po!.id}`), 800)
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle title="Receive Line" subtitle={item.itemCode} />
      <div className="mob-card">
        <div className="font-semibold">{item.itemName}</div>
        <div className="text-sm">Open qty: {open}</div>
      </div>
      <div className="mob-field mb-3">
        <label>Received qty</label>
        <MobileStepperInput value={qty} onChange={setQty} min={0} max={Math.ceil(open * 1.05)} />
      </div>
      <div className="mob-field mb-3">
        <label>Batch / Lot</label>
        <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Optional lot no" />
      </div>
      <label className="flex items-center gap-2 min-h-[44px] mb-3">
        <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} />
        Mark damage — send to QC hold
      </label>
      <MobilePhotoCapture label="Damage photo" onCapture={() => {}} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Submit Receipt
        </button>
      </MobileStickyActionBar>
    </>
  )
}
