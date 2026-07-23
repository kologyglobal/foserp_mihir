import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQualityStore } from '../../store/qualityStore'
import { buildEmptyParameterResults } from '../../utils/qcPlanResolver'
import type { QcParameterResult } from '../../types/qcParameters'
import {
  MobilePageTitle,
  MobileStatusChip,
  MobileStickyActionBar,
  MobilePhotoCapture,
} from '../../components/mobile'
import { mobileQcCanInspect } from '../../utils/mobilePermissions'

function fillParam(r: QcParameterResult, value: unknown, photo?: string): QcParameterResult {
  if (r.parameterType === 'boolean') return { ...r, actualValue: value as boolean }
  if (r.parameterType === 'photo_required') return { ...r, actualValue: photo ?? '', attachmentRef: photo ?? '' }
  if (r.parameterType === 'numeric') return { ...r, actualValue: value as number }
  return { ...r, actualValue: String(value ?? '') }
}

export function MobileQcListDemoPage() {
  const navigate = useNavigate()
  const inspections = useQualityStore((s) => s.inspections)
  const pending = useMemo(() => inspections.filter((i) => i.status === 'pending'), [inspections])

  return (
    <>
      <MobilePageTitle title="Quality Inspections" subtitle={`${pending.length} pending (demo)`} />
      {pending.map((insp) => (
        <button
          key={insp.id}
          type="button"
          className="mob-card w-full text-left mb-2"
          onClick={() => navigate(`/m/qc/${insp.id}`)}
        >
          <div className="font-semibold">{insp.inspectionNo}</div>
          <div className="text-sm">
            {insp.category} · {insp.woNo ?? insp.grnNo ?? insp.itemCode ?? '—'}
          </div>
          <MobileStatusChip label={insp.status} tone="amber" />
        </button>
      ))}
    </>
  )
}

export function MobileQcDetailDemoPage() {
  const { id } = useParams<{ id: string }>()
  const insp = useQualityStore((s) => s.getInspection(id ?? ''))
  const record = useQualityStore((s) => s.recordInspectionDecision)
  const recordIncoming = useQualityStore((s) => s.recordIncomingQcDecision)
  const [params, setParams] = useState<QcParameterResult[]>(() =>
    insp ? (insp.parameterResults.length ? [...insp.parameterResults] : buildEmptyParameterResults(insp.parameterSnapshot)) : [],
  )
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const canInspect = mobileQcCanInspect()

  if (!insp) return <MobilePageTitle title="QC" subtitle="Not found" />

  function submit(decision: 'pass' | 'reject') {
    if (!canInspect) {
      setMsg('Permission denied')
      return
    }
    for (const p of params) {
      if (p.mandatory && (p.actualValue === undefined || p.actualValue === '' || p.actualValue === null)) {
        setMsg(`Mandatory parameter blank: ${p.parameterName}`)
        return
      }
      if (p.parameterType === 'photo_required' && decision === 'pass' && !photos[p.parameterId] && !p.attachmentRef) {
        setMsg(`Photo required: ${p.parameterName}`)
        return
      }
    }
    const filled = params.map((p) =>
      p.parameterType === 'photo_required' ? fillParam(p, photos[p.parameterId], photos[p.parameterId]) : p,
    )
    const qty = insp!.acceptedQty ?? 1
    const r =
      insp!.category === 'incoming'
        ? recordIncoming(insp!.id, {
            inspector: 'Mobile QC',
            result: decision,
            remarks: 'Mobile inspection',
            acceptedQty: decision === 'pass' ? qty : 0,
            rejectedQty: decision === 'reject' ? qty : 0,
            parameterResults: filled,
            useAutoDecision: true,
          })
        : record(insp!.id, {
            inspector: 'Mobile QC',
            result: decision,
            remarks: 'Mobile inspection',
            parameterResults: filled,
            useAutoDecision: true,
            ncrSeverity: decision === 'reject' ? 'critical' : undefined,
            ncrDefectDescription: decision === 'reject' ? 'Mobile QC critical fail' : undefined,
          })
    setMsg(r.ok ? `Submitted — ${decision}` : (r.error ?? 'Failed'))
  }

  return (
    <>
      <MobilePageTitle title={insp.inspectionNo} subtitle={insp.category} />
      {params.map((p) => (
        <div key={p.parameterId} className="mob-card mb-2">
          <div className="font-semibold text-sm">{p.parameterName}</div>
          {p.parameterType === 'boolean' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                className="mob-btn mob-btn-primary"
                onClick={() => setParams((ps) => ps.map((x) => (x.parameterId === p.parameterId ? fillParam(x, true) : x)))}
              >
                Pass
              </button>
              <button
                type="button"
                className="mob-btn mob-btn-danger"
                onClick={() => setParams((ps) => ps.map((x) => (x.parameterId === p.parameterId ? fillParam(x, false) : x)))}
              >
                Fail
              </button>
            </div>
          )}
          {p.parameterType === 'numeric' && (
            <input
              type="number"
              className="mt-2 w-full min-h-[44px] border rounded-lg px-3"
              placeholder={`${p.minValue ?? ''} – ${p.maxValue ?? ''}`}
              onChange={(e) =>
                setParams((ps) => ps.map((x) => (x.parameterId === p.parameterId ? fillParam(x, Number(e.target.value)) : x)))
              }
            />
          )}
          {p.parameterType === 'photo_required' && (
            <MobilePhotoCapture
              label="Capture photo"
              onCapture={(url) => setPhotos((ph) => ({ ...ph, [p.parameterId]: url }))}
            />
          )}
        </div>
      ))}
      {msg ? <div className="mob-card text-sm">{msg}</div> : null}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary mb-2" onClick={() => submit('pass')}>
          Submit Pass
        </button>
        <button type="button" className="mob-btn mob-btn-danger" onClick={() => submit('reject')}>
          Submit Fail / NCR
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileNcrDemoPage() {
  const { id } = useParams<{ id: string }>()
  const ncr = useQualityStore((s) => s.ncrs.find((n) => n.id === id))

  if (!ncr) return <MobilePageTitle title="NCR" subtitle="Not found" />

  return (
    <>
      <MobilePageTitle title={ncr.ncrNo} subtitle={ncr.defectDescription} />
      <div className="mob-card">
        <MobileStatusChip label={ncr.status} tone="red" />
        <div className="text-sm mt-2">{ncr.rootCause ?? 'No root cause yet'}</div>
      </div>
      <MobilePhotoCapture label="Add evidence photo" onCapture={() => {}} />
    </>
  )
}
