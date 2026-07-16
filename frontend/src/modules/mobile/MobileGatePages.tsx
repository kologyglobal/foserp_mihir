import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useInsideGateVehicles, useLoadingPlannedDispatches } from '../../hooks/useStableStoreData'
import { useMobileGateStore } from '../../store/mobileGateStore'
import { useDispatchStore } from '../../store/dispatchStore'
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
  const inside = useInsideGateVehicles()
  const dispatches = useLoadingPlannedDispatches()

  return (
    <>
      <MobilePageTitle title="Gate Control" subtitle="Vehicle inward / outward" />
      <div className="mob-grid-2 mb-4">
        <div className="mob-card text-center">
          <div className="text-2xl font-bold">{inside.length}</div>
          <div className="text-xs text-[#605e5c]">Inside</div>
        </div>
        <div className="mob-card text-center">
          <div className="text-2xl font-bold">{dispatches.length}</div>
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
      ) : (
        inside.map((e) => (
          <div key={e.id} className="mob-card">
            <div className="font-semibold">{e.vehicleNo}</div>
            <div className="text-sm text-[#605e5c]">{e.driverName} · {e.partyName}</div>
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

  function submit() {
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
    createInward({ ...form, photoDataUrl: photo, referenceType: 'visitor' })
    navigate('/m/gate')
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle title="Vehicle Inward" />
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
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Create Gate Entry
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

  function submit() {
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
      <MobilePageTitle title="Vehicle Outward" subtitle="Requires gate pass or dispatch reference" />
      {Object.entries(form).map(([field, val]) => (
        <div key={field} className="mob-field mb-3">
          <label>{field}</label>
          <input value={val} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
        </div>
      ))}
      {msg && <div className="mob-card text-[#c42b2f] text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Record Exit
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileGatePassPage() {
  const { id } = useParams<{ id: string }>()
  const dispatch = useDispatchStore((s) => s.getDispatch(id ?? ''))

  if (!dispatch) {
    return <MobilePageTitle title="Gate Pass" subtitle="Dispatch not found" />
  }

  return (
    <>
      <MobilePageTitle title="Gate Pass" subtitle={dispatch.dispatchNo} />
      <div className="mob-card">
        <div className="font-semibold">{dispatch.dispatchNo}</div>
        <div className="text-sm">Vehicle: {dispatch.vehicleNo ?? '—'}</div>
        <div className="text-sm">LR: {dispatch.lrNo ?? '—'}</div>
        <div className="text-sm">Driver: {dispatch.driverName ?? '—'}</div>
        <MobileStatusChip label={dispatch.status} tone="blue" />
      </div>
      <Link to={`/dispatch/${dispatch.id}/gate-pass`} className="mob-btn mob-btn-secondary block text-center no-underline">
        Print full gate pass (desktop)
      </Link>
    </>
  )
}
