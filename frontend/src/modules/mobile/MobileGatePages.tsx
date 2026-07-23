import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { gateService } from '@/modules/gate/api/gateService'
import type { GateVehicle } from '@/modules/gate/types/gate.types'
import { useInsideGateVehicles, useLoadingPlannedDispatches } from '../../hooks/useStableStoreData'
import { useMobileGateStore } from '../../store/mobileGateStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { getOutboundDispatch } from '@/services/api/dispatchApi'
import {
  MobilePageTitle,
  MobileStatusChip,
  MobileStickyActionBar,
  MobilePhotoCapture,
  MobileOfflineBanner,
} from '../../components/mobile'
import { useMobileDraftStore } from '../../store/mobileDraftStore'
import { mobileGateCanCreate } from '../../utils/mobilePermissions'

export function MobileGatePage() {
  const navigate = useNavigate()
  const demoInside = useInsideGateVehicles()
  const demoDispatches = useLoadingPlannedDispatches()
  const [apiVehicles, setApiVehicles] = useState<GateVehicle[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  const loadApi = useCallback(async () => {
    if (!isApiMode()) return
    setApiLoading(true)
    setApiError('')
    try {
      const vehicles = await gateService.getVehicles({ insideOnly: true })
      setApiVehicles(vehicles)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not load gate vehicles')
    } finally {
      setApiLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadApi()
  }, [loadApi])

  const inside = isApiMode() ? apiVehicles : demoInside
  const waiting = isApiMode() ? 0 : demoDispatches.length

  return (
    <>
      <MobilePageTitle
        title="Gate Control"
        subtitle={isApiMode() ? 'Live gate API' : 'Vehicle inward / outward (demo)'}
      />
      {apiError ? <div className="mob-card text-sm text-[#c42b2f] mb-3">{apiError}</div> : null}
      <div className="mob-grid-2 mb-4">
        <div className="mob-card text-center">
          <div className="text-2xl font-bold">{apiLoading ? '…' : inside.length}</div>
          <div className="text-xs text-[#605e5c]">Inside</div>
        </div>
        <div className="mob-card text-center">
          <div className="text-2xl font-bold">{waiting}</div>
          <div className="text-xs text-[#605e5c]">Dispatch waiting</div>
        </div>
      </div>
      <button type="button" className="mob-btn mob-btn-primary mb-2" onClick={() => navigate('/m/gate/inward')}>
        Vehicle Inward
      </button>
      <button type="button" className="mob-btn mob-btn-secondary mb-4" onClick={() => navigate('/m/gate/outward')}>
        Vehicle Outward
      </button>
      <div className="mob-section-title">Vehicles inside</div>
      {inside.length === 0 ? (
        <div className="mob-card text-sm text-[#605e5c]">No vehicles inside yard</div>
      ) : isApiMode() ? (
        (inside as GateVehicle[]).map((e) => (
          <div key={e.id} className="mob-card">
            <div className="font-semibold">{e.vehicleNumber}</div>
            <div className="text-sm text-[#605e5c]">
              {e.driverName} · {e.companyName ?? e.purpose}
            </div>
            <MobileStatusChip label={e.status} tone="green" />
          </div>
        ))
      ) : (
        demoInside.map((e) => (
          <div key={e.id} className="mob-card">
            <div className="font-semibold">{e.vehicleNo}</div>
            <div className="text-sm text-[#605e5c]">
              {e.driverName} · {e.partyName}
            </div>
            <MobileStatusChip label="inside" tone="green" />
          </div>
        ))
      )}
    </>
  )
}

export function MobileGateInwardPage() {
  const navigate = useNavigate()
  const createInward = useMobileGateStore((s) => s.createInward)
  const isOnline = useMobileDraftStore((s) => s.isOnline)
  const saveDraft = useMobileDraftStore((s) => s.saveDraft)
  const canCreate = mobileGateCanCreate()
  const [form, setForm] = useState({
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
    partyName: '',
    purpose: 'Material delivery',
    referenceNo: '',
    remarks: '',
  })
  const [photo, setPhoto] = useState<string>()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!canCreate) {
      setMsg('Permission denied for gate entry')
      return
    }
    if (!form.vehicleNo.trim()) {
      setMsg('Vehicle number required')
      return
    }
    if (!isOnline) {
      saveDraft({
        kind: 'gate_entry',
        title: `Gate inward ${form.vehicleNo}`,
        payload: { ...form, photo, direction: 'inward' },
      })
      setMsg('Saved offline draft — will sync when online')
      return
    }

    if (isApiMode()) {
      setBusy(true)
      setMsg('')
      try {
        const vehicle = await gateService.createVehicleEntry({
          vehicleNumber: form.vehicleNo.trim(),
          vehicleType: 'TRUCK',
          purpose: form.purpose || 'Material delivery',
          companyName: form.partyName || undefined,
          driverName: form.driverName || 'Driver',
          driverMobile: form.driverMobile || undefined,
          licenceVerified: 'not_checked',
          relatedDocument: form.referenceNo || undefined,
          gate: 'MAIN',
          remarks: form.remarks || undefined,
          markArrived: true,
        })
        await gateService.allowVehicleInside(vehicle.id)
        navigate('/m/gate')
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Gate inward failed')
      } finally {
        setBusy(false)
      }
      return
    }

    createInward({ ...form, photoDataUrl: photo, referenceType: 'visitor' })
    navigate('/m/gate')
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle title="Vehicle Inward" subtitle={isApiMode() ? 'Creates live gate vehicle entry' : undefined} />
      {['vehicleNo', 'driverName', 'driverMobile', 'partyName', 'purpose', 'referenceNo', 'remarks'].map((field) => (
        <div key={field} className="mob-field mb-3">
          <label>{field.replace(/([A-Z])/g, ' $1')}</label>
          <input
            value={(form as Record<string, string>)[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          />
        </div>
      ))}
      <MobilePhotoCapture label="Capture entry photo" onCapture={setPhoto} />
      {msg && <div className="mob-card text-sm mt-2">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Create Gate Entry'}
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileGateOutwardPage() {
  const navigate = useNavigate()
  const createOutward = useMobileGateStore((s) => s.createOutward)
  const [form, setForm] = useState({
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
    partyName: '',
    purpose: 'Dispatch exit',
    referenceNo: '',
    gatePassId: '',
    dispatchId: '',
  })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (isApiMode()) {
      if (!form.vehicleNo.trim()) {
        setMsg('Vehicle number required')
        return
      }
      setBusy(true)
      setMsg('')
      try {
        const vehicles = await gateService.getVehicles({ search: form.vehicleNo.trim() })
        const match =
          vehicles.find((v) => v.vehicleNumber.toUpperCase() === form.vehicleNo.trim().toUpperCase()) ??
          vehicles[0]
        if (!match) {
          setMsg('Vehicle not found in gate register')
          return
        }
        if (match.status === 'allowed_inside' || match.status === 'loading' || match.status === 'unloading') {
          await gateService.markVehicleReadyForExit(match.id)
          await gateService.recordVehicleExit(match.id, form.purpose || undefined)
        } else if (match.status === 'ready_exit') {
          await gateService.recordVehicleExit(match.id, form.purpose || undefined)
        } else {
          setMsg(`Vehicle status is ${match.status} — cannot exit`)
          return
        }
        navigate('/m/gate')
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Gate outward failed')
      } finally {
        setBusy(false)
      }
      return
    }

    const r = createOutward({
      ...form,
      exitTime: new Date().toISOString(),
      referenceType: 'dispatch',
    })
    if (!r.ok) {
      setMsg(r.error ?? 'Failed')
      return
    }
    navigate('/m/gate')
  }

  return (
    <>
      <MobilePageTitle
        title="Vehicle Outward"
        subtitle={isApiMode() ? 'Looks up vehicle and records exit via API' : 'Requires gate pass or dispatch reference'}
      />
      {Object.entries(form).map(([field, val]) => (
        <div key={field} className="mob-field mb-3">
          <label>{field}</label>
          <input value={val} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
        </div>
      ))}
      {msg && <div className="mob-card text-[#c42b2f] text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Record Exit'}
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileGatePassPage() {
  const { id } = useParams<{ id: string }>()
  const demoDispatch = useDispatchStore((s) => s.getDispatch(id ?? ''))
  const [apiDispatch, setApiDispatch] = useState<Awaited<ReturnType<typeof getOutboundDispatch>> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isApiMode() || !id) return
    void getOutboundDispatch(id)
      .then(setApiDispatch)
      .catch((err) => setError(err instanceof Error ? err.message : 'Not found'))
  }, [id])

  if (isApiMode()) {
    if (error) return <MobilePageTitle title="Gate Pass" subtitle={error} />
    if (!apiDispatch) return <MobilePageTitle title="Gate Pass" subtitle="Loading…" />
    return (
      <>
        <MobilePageTitle title="Gate Pass" subtitle={apiDispatch.dispatchNo} />
        <div className="mob-card">
          <div className="font-semibold">{apiDispatch.dispatchNo}</div>
          <div className="text-sm">SO: {apiDispatch.salesOrderNo ?? '—'}</div>
          <div className="text-sm">Ship-to: {apiDispatch.shipToAddress ?? '—'}</div>
          <MobileStatusChip label={apiDispatch.status} tone="blue" />
        </div>
        <Link to={`/dispatch/${apiDispatch.id}`} className="mob-btn mob-btn-secondary block text-center no-underline">
          Open dispatch (desktop)
        </Link>
      </>
    )
  }

  if (!demoDispatch) {
    return <MobilePageTitle title="Gate Pass" subtitle="Dispatch not found" />
  }

  return (
    <>
      <MobilePageTitle title="Gate Pass" subtitle={demoDispatch.dispatchNo} />
      <div className="mob-card">
        <div className="font-semibold">{demoDispatch.dispatchNo}</div>
        <div className="text-sm">Vehicle: {demoDispatch.vehicleNo ?? '—'}</div>
        <div className="text-sm">LR: {demoDispatch.lrNo ?? '—'}</div>
        <div className="text-sm">Driver: {demoDispatch.driverName ?? '—'}</div>
        <MobileStatusChip label={demoDispatch.status} tone="blue" />
      </div>
      <Link to={`/dispatch/${demoDispatch.id}/gate-pass`} className="mob-btn mob-btn-secondary block text-center no-underline">
        Print full gate pass (desktop)
      </Link>
    </>
  )
}
