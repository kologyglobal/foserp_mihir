import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOpenJobCards } from '../../hooks/useStableStoreData'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMobileDraftStore } from '../../store/mobileDraftStore'
import {
  MobilePageTitle,
  MobileJobCardTimer,
  MobileStepperInput,
  MobileStickyActionBar,
  MobilePhotoCapture,
  MobileOfflineBanner,
} from '../../components/mobile'
import { mobileShopFloorCanEdit } from '../../utils/mobilePermissions'

export function MobileShopFloorPage() {
  const navigate = useNavigate()
  const jobCards = useOpenJobCards()

  return (
    <>
      <MobilePageTitle title="Shop Floor" subtitle="My job cards today" />
      {jobCards.slice(0, 40).map((jc) => (
        <button
          key={jc.id}
          type="button"
          className="mob-card w-full text-left mb-2"
          onClick={() => navigate(`/m/job-card/${jc.id}`)}
        >
          <div className="flex justify-between items-start">
            <div className="font-semibold">{jc.jobCardNo}</div>
            <MobileJobCardTimer status={jc.status} />
          </div>
          <div className="text-sm text-[#605e5c]">WO {jc.woNo} · Op seq {jc.sequenceNo}</div>
        </button>
      ))}
    </>
  )
}

export function MobileJobCardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const jc = useWorkOrderStore((s) => s.jobCards.find((j) => j.id === id))
  const start = useWorkOrderStore((s) => s.startJobCard)
  const pause = useWorkOrderStore((s) => s.pauseJobCard)
  const complete = useWorkOrderStore((s) => s.completeJobCard)
  const [msg, setMsg] = useState('')
  const canEdit = mobileShopFloorCanEdit()

  if (!jc) return <MobilePageTitle title="Job Card" subtitle="Not found" />

  function act(action: 'start' | 'pause' | 'resume' | 'complete') {
    if (!canEdit) {
      setMsg('Permission denied')
      return
    }
    if (action === 'start' || action === 'resume') {
      const r = start(jc!.id, { assignedTeam: jc!.assignedTeam ?? 'Mobile Ops', startTime: new Date().toTimeString().slice(0, 5) })
      setMsg(r.ok ? (action === 'resume' ? 'Resumed' : 'Started') : r.error ?? 'Failed')
    } else if (action === 'pause') {
      const r = pause(jc!.id)
      setMsg(r.ok ? 'Paused' : r.error ?? 'Failed')
    } else {
      const r = complete(jc!.id, {
        endTime: new Date().toTimeString().slice(0, 5),
        actualHours: jc!.plannedHours ?? 1,
        remarks: 'Mobile complete',
      })
      setMsg(r.ok ? 'Completed' : r.error ?? 'Failed')
    }
  }

  return (
    <>
      <MobilePageTitle title={jc.jobCardNo} subtitle={`WO ${jc.woNo}`} />
      <div className="mob-card">
        <MobileJobCardTimer status={jc.status} />
        <div className="text-sm mt-2">Team: {jc.assignedTeam ?? 'Unassigned'}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button type="button" className="mob-btn mob-btn-primary" onClick={() => act('start')}>
          Start
        </button>
        <button type="button" className="mob-btn mob-btn-secondary" onClick={() => act('pause')}>
          Pause
        </button>
        <button type="button" className="mob-btn mob-btn-secondary" onClick={() => act('resume')}>
          Resume
        </button>
        <button type="button" className="mob-btn mob-btn-secondary col-span-2" onClick={() => act('complete')}>
          Complete
        </button>
        <button type="button" className="mob-btn mob-btn-secondary col-span-2" onClick={() => navigate(`/m/job-card/${jc.id}/daily-entry`)}>
          Daily Entry
        </button>
      </div>
      {msg && <div className="mob-card text-sm">{msg}</div>}
    </>
  )
}

export function MobileJobCardDailyEntryPage() {
  const { id } = useParams<{ id: string }>()
  const jc = useWorkOrderStore((s) => s.jobCards.find((j) => j.id === id))
  const saveDraft = useMobileDraftStore((s) => s.saveDraft)
  const isOnline = useMobileDraftStore((s) => s.isOnline)
  const [qty, setQty] = useState(1)
  const [hours, setHours] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [msg, setMsg] = useState('')

  if (!jc) return <MobilePageTitle title="Daily Entry" subtitle="Not found" />

  function save() {
    const payload = {
      jobCardId: jc!.id,
      date: new Date().toISOString().slice(0, 10),
      shift: 'A',
      qtyCompleted: qty,
      actualHours: hours,
      remarks,
    }
    saveDraft({
      kind: 'job_card_daily',
      title: `Daily ${jc!.jobCardNo}`,
      entityId: jc!.id,
      payload,
    })
    if (isOnline) {
      useWorkOrderStore.getState().completeJobCard(jc!.id, {
        endTime: new Date().toTimeString().slice(0, 5),
        actualHours: hours,
        remarks: remarks || 'Mobile daily entry',
      })
    }
    setMsg(isOnline ? 'Saved and synced' : 'Draft saved offline')
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle title="Daily Entry" subtitle={jc.jobCardNo} />
      <div className="mob-field mb-3">
        <label>Qty completed</label>
        <MobileStepperInput value={qty} onChange={setQty} />
      </div>
      <div className="mob-field mb-3 mt-3">
        <label>Actual hours</label>
        <MobileStepperInput value={hours} onChange={setHours} />
      </div>
      <div className="mob-field mb-3">
        <label>Remarks</label>
        <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      <MobilePhotoCapture label="Work photo" onCapture={() => {}} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={save}>
          Save Entry
        </button>
      </MobileStickyActionBar>
    </>
  )
}
