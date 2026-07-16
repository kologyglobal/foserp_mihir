import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatchStore } from '../../store/dispatchStore'
import { useQualityStore } from '../../store/qualityStore'
import { scanTrailer } from '../../utils/barcodeEngine'
import {
  MobilePageTitle,
  MobileStatusChip,
  MobileStickyActionBar,
  MobilePhotoCapture,
} from '../../components/mobile'
import { qrValidateDispatchReady } from '../../utils/qrEngine'
import { mobileDispatchCanPost } from '../../utils/mobilePermissions'

export function MobileDispatchListPage() {
  const navigate = useNavigate()
  const dispatches = useDispatchStore((s) =>
    s.dispatches.filter((d) => !['closed', 'cancelled', 'delivered'].includes(d.status)),
  )

  return (
    <>
      <MobilePageTitle title="Dispatch Loading" subtitle={`${dispatches.length} active`} />
      {dispatches.map((d) => (
        <button
          key={d.id}
          type="button"
          className="mob-card w-full text-left mb-2"
          onClick={() => navigate(`/m/dispatch/${d.id}`)}
        >
          <div className="font-semibold">{d.dispatchNo}</div>
          <div className="text-sm">{d.customerName}</div>
          <MobileStatusChip label={d.status} tone="blue" />
        </button>
      ))}
    </>
  )
}

export function MobileDispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const dispatch = useDispatchStore((s) => s.getDispatch(id ?? ''))
  const markLoading = useDispatchStore((s) => s.markLoading)
  const confirmDispatch = useDispatchStore((s) => s.confirmDispatch)
  const toggleChecklist = useDispatchStore((s) => s.toggleChecklistItem)
  const addPhoto = useDispatchStore((s) => s.addPhoto)
  const [scan, setScan] = useState('')
  const [trailerNo, setTrailerNo] = useState('')
  const [msg, setMsg] = useState('')

  if (!dispatch) return <MobilePageTitle title="Dispatch" subtitle="Not found" />

  const line = dispatch.lines[0]
  const woId = line?.workOrderId
  const finalQcOk = woId ? useQualityStore.getState().hasFinalQcPassed(woId) : false

  function linkTrailer() {
    if (!line) return
    const r = scanTrailer({
      scan: scan || trailerNo,
      dispatchId: dispatch!.id,
      lineId: line.id,
      trailerNo: trailerNo || undefined,
    })
    setMsg(r.ok ? r.message ?? 'Trailer linked' : r.error ?? 'Scan failed')
  }

  function confirmLoad() {
    if (!mobileDispatchCanPost()) {
      setMsg('Permission denied')
      return
    }
    if (!finalQcOk) {
      setMsg('Final QC must pass before dispatch')
      return
    }
    if (!line?.trailerNo && !trailerNo) {
      setMsg('Trailer QR scan required')
      return
    }
    const ready = qrValidateDispatchReady(dispatch!.id)
    if (!ready.ok) {
      setMsg(ready.error ?? 'Dispatch not ready')
      return
    }
    markLoading(dispatch!.id)
    for (const item of dispatch!.checklist) {
      if (!item.systemGate) toggleChecklist(dispatch!.id, item.id, true)
    }
    const r = confirmDispatch(dispatch!.id)
    setMsg(r.ok ? 'Dispatch confirmed' : r.error ?? 'Failed')
  }

  return (
    <>
      <MobilePageTitle title={dispatch.dispatchNo} subtitle="Loading checklist" />
      <div className="mob-card">
        <div className="text-sm">Final QC: {finalQcOk ? '✓ Pass' : '✗ Required'}</div>
        <div className="text-sm">Serial: {line?.serialNo ?? line?.trailerNo ?? '—'}</div>
        <MobileStatusChip label={dispatch.status} tone="amber" />
      </div>
      <input className="mob-scan-input mb-2" placeholder="Scan trailer QR" value={scan} onChange={(e) => setScan(e.target.value)} />
      <input className="mob-field mb-2 w-full min-h-[44px] border rounded-lg px-3" placeholder="Trailer no" value={trailerNo} onChange={(e) => setTrailerNo(e.target.value)} />
      <button type="button" className="mob-btn mob-btn-secondary mb-2" onClick={linkTrailer}>
        Verify Trailer Scan
      </button>
      <MobilePhotoCapture
        label="Dispatch loading photo"
        onCapture={(url) => addPhoto(dispatch!.id, 'Mobile loading photo', url)}
      />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={confirmLoad}>
          Confirm Loading
        </button>
      </MobileStickyActionBar>
    </>
  )
}
