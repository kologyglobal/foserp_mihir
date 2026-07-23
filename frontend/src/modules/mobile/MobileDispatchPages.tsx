import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import {
  confirmOutboundDispatch,
  getOutboundDispatch,
  listOutboundDispatches,
  postOutboundDispatch,
  type OutboundDispatch,
} from '@/services/api/dispatchApi'
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
  const demoDispatches = useDispatchStore((s) =>
    s.dispatches.filter((d) => !['closed', 'cancelled', 'delivered'].includes(d.status)),
  )
  const [apiRows, setApiRows] = useState<OutboundDispatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) return
    setLoading(true)
    setError('')
    try {
      const res = await listOutboundDispatches({ limit: 50 })
      setApiRows(res.items.filter((d) => d.status === 'DRAFT' || d.status === 'CONFIRMED'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dispatches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = isApiMode() ? apiRows : demoDispatches

  return (
    <>
      <MobilePageTitle
        title="Dispatch Loading"
        subtitle={isApiMode() ? (loading ? 'Loading…' : `${rows.length} active`) : `${rows.length} active`}
      />
      {error ? <div className="mob-card text-sm text-[#c42b2f] mb-3">{error}</div> : null}
      {isApiMode()
        ? apiRows.map((d) => (
            <button
              key={d.id}
              type="button"
              className="mob-card w-full text-left mb-2"
              onClick={() => navigate(`/m/dispatch/${d.id}`)}
            >
              <div className="font-semibold">{d.dispatchNo}</div>
              <div className="text-sm">{d.salesOrderNo ?? d.customerId ?? '—'}</div>
              <MobileStatusChip label={d.status} tone="blue" />
            </button>
          ))
        : demoDispatches.map((d) => (
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
  const demoDispatch = useDispatchStore((s) => s.getDispatch(id ?? ''))
  const markLoading = useDispatchStore((s) => s.markLoading)
  const confirmDemo = useDispatchStore((s) => s.confirmDispatch)
  const toggleChecklist = useDispatchStore((s) => s.toggleChecklistItem)
  const addPhoto = useDispatchStore((s) => s.addPhoto)
  const [apiDispatch, setApiDispatch] = useState<OutboundDispatch | null>(null)
  const [scan, setScan] = useState('')
  const [trailerNo, setTrailerNo] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isApiMode() || !id) return
    void getOutboundDispatch(id)
      .then(setApiDispatch)
      .catch((err) => setMsg(err instanceof Error ? err.message : 'Not found'))
  }, [id])

  if (isApiMode()) {
    if (!apiDispatch && !msg) return <MobilePageTitle title="Dispatch" subtitle="Loading…" />
    if (!apiDispatch) return <MobilePageTitle title="Dispatch" subtitle={msg || 'Not found'} />

    async function confirmLoad() {
      if (!mobileDispatchCanPost()) {
        setMsg('Permission denied')
        return
      }
      setBusy(true)
      setMsg('')
      try {
        let current = apiDispatch!
        if (current.status === 'DRAFT') {
          current = await confirmOutboundDispatch(current.id, {
            idempotencyKey: `mob-confirm-${current.id}`,
          })
        }
        if (current.status === 'CONFIRMED') {
          current = await postOutboundDispatch(current.id, {
            idempotencyKey: `mob-post-${current.id}`,
          })
        }
        setApiDispatch(current)
        setMsg(`Dispatch ${current.dispatchNo} — ${current.status}`)
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Confirm/post failed')
      } finally {
        setBusy(false)
      }
    }

    return (
      <>
        <MobilePageTitle title={apiDispatch.dispatchNo} subtitle="Confirm & post outbound" />
        <div className="mob-card">
          <div className="text-sm">SO: {apiDispatch.salesOrderNo ?? '—'}</div>
          <div className="text-sm">Lines: {apiDispatch.lines.length}</div>
          <div className="text-sm">Ship-to: {apiDispatch.shipToAddress ?? '—'}</div>
          <MobileStatusChip label={apiDispatch.status} tone="amber" />
        </div>
        <input
          className="mob-scan-input mb-2"
          placeholder="Scan trailer / vehicle (optional note)"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
        />
        {msg && <div className="mob-card text-sm">{msg}</div>}
        <MobileStickyActionBar>
          <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void confirmLoad()}>
            {busy ? 'Working…' : apiDispatch.status === 'DRAFT' ? 'Confirm & Post' : 'Post Dispatch'}
          </button>
        </MobileStickyActionBar>
      </>
    )
  }

  if (!demoDispatch) return <MobilePageTitle title="Dispatch" subtitle="Not found" />

  const line = demoDispatch.lines[0]
  const woId = line?.workOrderId
  const finalQcOk = woId ? useQualityStore.getState().hasFinalQcPassed(woId) : false

  function linkTrailer() {
    if (!line) return
    const r = scanTrailer({
      scan: scan || trailerNo,
      dispatchId: demoDispatch!.id,
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
    const ready = qrValidateDispatchReady(demoDispatch!.id)
    if (!ready.ok) {
      setMsg(ready.error ?? 'Dispatch not ready')
      return
    }
    markLoading(demoDispatch!.id)
    for (const item of demoDispatch!.checklist) {
      if (!item.systemGate) toggleChecklist(demoDispatch!.id, item.id, true)
    }
    const r = confirmDemo(demoDispatch!.id)
    setMsg(r.ok ? 'Dispatch confirmed' : r.error ?? 'Failed')
  }

  return (
    <>
      <MobilePageTitle title={demoDispatch.dispatchNo} subtitle="Loading checklist" />
      <div className="mob-card">
        <div className="text-sm">Final QC: {finalQcOk ? '✓ Pass' : '✗ Required'}</div>
        <div className="text-sm">Serial: {line?.serialNo ?? line?.trailerNo ?? '—'}</div>
        <MobileStatusChip label={demoDispatch.status} tone="amber" />
      </div>
      <input className="mob-scan-input mb-2" placeholder="Scan trailer QR" value={scan} onChange={(e) => setScan(e.target.value)} />
      <input
        className="mob-field mb-2 w-full min-h-[44px] border rounded-lg px-3"
        placeholder="Trailer no"
        value={trailerNo}
        onChange={(e) => setTrailerNo(e.target.value)}
      />
      <button type="button" className="mob-btn mob-btn-secondary mb-2" onClick={linkTrailer}>
        Verify Trailer Scan
      </button>
      <MobilePhotoCapture
        label="Dispatch loading photo"
        onCapture={(url) => addPhoto(demoDispatch!.id, 'Mobile loading photo', url)}
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
