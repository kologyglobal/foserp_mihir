import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { MobilePageTitle, MobileStatusChip, MobileStickyActionBar } from '@/components/mobile'
import { isApiMode } from '@/config/apiConfig'
import {
  decideQcKioskInspection,
  getQcKioskInspection,
  getQcKioskQueue,
  getNcr,
  type QualityInspection,
  type QualityInspectionDecision,
  type QualityNcr,
  type QualityParameterSnapshot,
} from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { kioskCardClass, kioskDangerBtn, kioskPrimaryBtn, kioskSecondaryBtn, kioskWarnBtn } from './kioskCss'

type DraftResult = {
  parameterId: string
  measuredValue: string
  measuredNumeric: string
  passed: boolean | null
  remarks: string
}

function snapshotToDraft(snapshot: QualityParameterSnapshot[]): DraftResult[] {
  return [...snapshot]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      parameterId: s.parameterId,
      measuredValue: '',
      measuredNumeric: '',
      passed: null,
      remarks: '',
    }))
}

function toneForStatus(status: string): 'green' | 'amber' | 'red' | 'blue' | 'gray' {
  if (status === 'PASSED') return 'green'
  if (status === 'PENDING' || status === 'REWORK') return 'amber'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'red'
  return 'blue'
}

/** Live QC queue for kiosk / phone. */
export function MobileQcKioskListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityInspection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getQcKioskQueue({ limit: 100 })
      setRows(
        res.data.items.map((i) => ({
          id: i.id,
          inspectionNumber: i.inspectionNumber,
          category: i.category as QualityInspection['category'],
          status: i.status as QualityInspection['status'],
          title: i.title,
          productionOrderId: i.productionOrderId,
          stageId: i.stageId,
          operationId: null,
          itemId: i.itemId,
          inspectedQty: i.inspectedQty,
          requestedAt: i.requestedAt,
          decision: null,
          acceptedQty: null,
          rejectedQty: null,
          reworkQty: null,
          remarks: null,
          decisionRemarks: null,
          decidedAt: null,
          createdAt: i.requestedAt,
          updatedAt: i.requestedAt,
        })),
      )
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load QC queue')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!isApiMode()) {
    return (
      <div className="mob-kiosk">
        <MobilePageTitle title="Quality Kiosk" subtitle="API required" />
        <div className="mob-card text-sm text-[#605e5c]">
          Enable <code>VITE_USE_API=true</code> to inspect live manufacturing / incoming QC.
        </div>
        <Link to="/m/kiosk" className={`${kioskSecondaryBtn} mt-3`}>
          Back to kiosk
        </Link>
      </div>
    )
  }

  return (
    <div className="mob-kiosk space-y-3">
      <div className="flex items-start justify-between gap-2">
        <MobilePageTitle title="Quality / QC" subtitle={`${rows.length} open`} />
        <button
          type="button"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#edebe9] bg-white"
          onClick={() => void load()}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        </button>
      </div>
      <Link to="/m/kiosk" className="text-sm font-semibold text-[#0078d4]">
        ← Kiosk home
      </Link>
      <Link to="/m/shop-floor" className={kioskSecondaryBtn}>
        Open Shopfloor
      </Link>

      {loading ? <div className="mob-card text-center text-[#605e5c]">Loading inspections…</div> : null}
      {!loading && rows.length === 0 ? (
        <div className={kioskCardClass}>
          <ClipboardCheck className="mb-2 h-8 w-8 text-[#605e5c]" aria-hidden />
          <p className="font-semibold">No open inspections</p>
          <p className="mt-1 text-sm text-[#605e5c]">New QC appears when a quality-required stage is completed.</p>
        </div>
      ) : null}

      {rows.map((insp) => (
        <button
          key={insp.id}
          type="button"
          className={`${kioskCardClass} w-full text-left`}
          onClick={() => navigate(`/m/qc/${insp.id}`)}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-lg font-bold text-[#0078d4]">{insp.inspectionNumber}</p>
              <p className="mt-1 text-sm font-medium">{insp.title}</p>
              <p className="mt-1 text-xs text-[#605e5c]">
                {insp.category.replace(/_/g, ' ')} · Qty {insp.inspectedQty ?? '—'}
              </p>
            </div>
            <MobileStatusChip label={insp.status} tone={toneForStatus(insp.status)} />
          </div>
          <p className="mt-2 text-[11px] text-[#605e5c]">{formatDateTime(insp.requestedAt)}</p>
        </button>
      ))}
    </div>
  )
}

/** Live QC decide screen — Pass / Rework / Reject. */
export function MobileQcKioskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [inspection, setInspection] = useState<QualityInspection | null>(null)
  const [drafts, setDrafts] = useState<DraftResult[]>([])
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id || !isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getQcKioskInspection(id)
      setInspection(res.data)
      const snap = Array.isArray(res.data.parameterSnapshot) ? res.data.parameterSnapshot : []
      if (res.data.parameterResults?.length) {
        setDrafts(
          res.data.parameterResults.map((r) => ({
            parameterId: r.parameterId,
            measuredValue: r.measuredValue ?? '',
            measuredNumeric: r.measuredNumeric != null ? String(r.measuredNumeric) : '',
            passed: r.passed,
            remarks: r.remarks ?? '',
          })),
        )
      } else {
        setDrafts(snapshotToDraft(snap))
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load inspection')
      setInspection(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const snapshotById = useMemo(() => {
    const map = new Map<string, QualityParameterSnapshot>()
    for (const s of inspection?.parameterSnapshot ?? []) map.set(s.parameterId, s)
    return map
  }, [inspection])

  const decided = inspection != null && inspection.status !== 'PENDING' && inspection.status !== 'REWORK'

  async function submit(decision: QualityInspectionDecision) {
    if (!inspection) return
    const snapList = Array.isArray(inspection.parameterSnapshot) ? inspection.parameterSnapshot : []
    if (decision === 'PASS' || decision === 'CONDITIONAL_PASS') {
      for (const snap of snapList) {
        if (!snap.mandatory) continue
        const d = drafts.find((x) => x.parameterId === snap.parameterId)
        if (!d) {
          notify.error(`Enter measurement for ${snap.parameterCode}`)
          return
        }
        if (snap.parameterType === 'NUMERIC' && (d.measuredNumeric.trim() === '' || !Number.isFinite(Number(d.measuredNumeric)))) {
          notify.error(`Enter numeric measurement for ${snap.parameterCode}`)
          return
        }
        if (snap.parameterType === 'BOOLEAN' && d.passed == null && !d.measuredValue) {
          notify.error(`Select result for ${snap.parameterCode}`)
          return
        }
        if (snap.passFailRule === 'MANUAL' && d.passed == null) {
          notify.error(`Mark pass/fail for ${snap.parameterCode}`)
          return
        }
      }
    }
    setBusy(true)
    try {
      const parameterResults = drafts.map((d) => {
        const snap = snapshotById.get(d.parameterId)
        const numeric =
          d.measuredNumeric === '' ? null : Number.isFinite(Number(d.measuredNumeric)) ? Number(d.measuredNumeric) : null
        return {
          parameterId: d.parameterId,
          measuredValue:
            snap?.parameterType === 'BOOLEAN'
              ? d.passed == null
                ? d.measuredValue || null
                : d.passed
                  ? 'true'
                  : 'false'
              : d.measuredValue || null,
          measuredNumeric: snap?.parameterType === 'NUMERIC' ? numeric : null,
          passed: d.passed,
          remarks: d.remarks || null,
        }
      })
      const qty = Number(inspection.inspectedQty ?? 0)
      await decideQcKioskInspection(inspection.id, {
        decision,
        remarks: remarks || undefined,
        acceptedQty: decision === 'PASS' ? qty : undefined,
        rejectedQty: decision === 'REJECT' ? qty : undefined,
        reworkQty: decision === 'REWORK' ? qty : undefined,
        parameterResults: parameterResults.length ? parameterResults : undefined,
      })
      notify.success(`Inspection ${decision}`)
      if (decision === 'PASS' || decision === 'CONDITIONAL_PASS') {
        navigate(`/quality/inspections/${inspection.id}/report`)
        return
      }
      navigate('/m/qc')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Decision failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isApiMode()) {
    return (
      <div className="mob-kiosk">
        <MobilePageTitle title="QC" subtitle="API required" />
      </div>
    )
  }

  if (loading) return <div className="mob-card text-center text-[#605e5c]">Loading…</div>
  if (!inspection) {
    return (
      <div className="mob-kiosk">
        <MobilePageTitle title="QC" subtitle="Not found" />
        <Link to="/m/qc" className={kioskSecondaryBtn}>
          Back to queue
        </Link>
      </div>
    )
  }

  return (
    <div className="mob-kiosk space-y-3 pb-28">
      <MobilePageTitle title={inspection.inspectionNumber} subtitle={inspection.category.replace(/_/g, ' ')} />
      <Link to="/m/qc" className="text-sm font-semibold text-[#0078d4]">
        ← QC queue
      </Link>

      <div className={kioskCardClass}>
        <MobileStatusChip label={inspection.status} tone={toneForStatus(inspection.status)} />
        <p className="mt-2 font-semibold">{inspection.title}</p>
        <p className="mt-1 text-sm text-[#605e5c]">Inspected qty: {inspection.inspectedQty ?? '—'}</p>
        <p className="mt-1 text-xs text-[#605e5c]">{formatDateTime(inspection.requestedAt)}</p>
      </div>

      {drafts.map((d) => {
        const snap = snapshotById.get(d.parameterId)
        if (!snap) return null
        return (
          <div key={d.parameterId} className={kioskCardClass}>
            <p className="font-semibold">{snap.parameterName}</p>
            <p className="text-xs text-[#605e5c]">
              {snap.parameterType}
              {snap.mandatory ? ' · mandatory' : ''}
              {snap.minValue != null || snap.maxValue != null
                ? ` · ${snap.minValue ?? '—'} – ${snap.maxValue ?? '—'}`
                : ''}
            </p>
            {snap.parameterType === 'BOOLEAN' || snap.parameterType === 'boolean' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={d.passed === true ? kioskPrimaryBtn : kioskSecondaryBtn}
                  onClick={() => setDrafts((rows) => rows.map((x) => (x.parameterId === d.parameterId ? { ...x, passed: true } : x)))}
                >
                  Pass
                </button>
                <button
                  type="button"
                  className={d.passed === false ? kioskDangerBtn : kioskSecondaryBtn}
                  onClick={() => setDrafts((rows) => rows.map((x) => (x.parameterId === d.parameterId ? { ...x, passed: false } : x)))}
                >
                  Fail
                </button>
              </div>
            ) : snap.parameterType === 'NUMERIC' || snap.parameterType === 'numeric' ? (
              <input
                type="number"
                className="mt-3 w-full min-h-14 rounded-xl border border-[#edebe9] px-4 text-lg"
                value={d.measuredNumeric}
                onChange={(e) =>
                  setDrafts((rows) =>
                    rows.map((x) => (x.parameterId === d.parameterId ? { ...x, measuredNumeric: e.target.value } : x)),
                  )
                }
              />
            ) : (
              <input
                type="text"
                className="mt-3 w-full min-h-14 rounded-xl border border-[#edebe9] px-4 text-lg"
                value={d.measuredValue}
                onChange={(e) =>
                  setDrafts((rows) =>
                    rows.map((x) => (x.parameterId === d.parameterId ? { ...x, measuredValue: e.target.value } : x)),
                  )
                }
              />
            )}
          </div>
        )
      })}

      <div className={kioskCardClass}>
        <label className="text-sm font-semibold" htmlFor="qc-remarks">
          Remarks
        </label>
        <textarea
          id="qc-remarks"
          className="mt-2 w-full min-h-24 rounded-xl border border-[#edebe9] px-3 py-2"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={decided || busy}
        />
      </div>

      {!decided ? (
        <MobileStickyActionBar>
          <button type="button" className={`${kioskPrimaryBtn} mb-2`} disabled={busy} onClick={() => void submit('PASS')}>
            {busy ? '…' : 'Pass'}
          </button>
          <button type="button" className={`${kioskWarnBtn} mb-2`} disabled={busy} onClick={() => void submit('REWORK')}>
            Rework
          </button>
          <button type="button" className={kioskDangerBtn} disabled={busy} onClick={() => void submit('REJECT')}>
            Reject / NCR
          </button>
        </MobileStickyActionBar>
      ) : (
        <div className="mob-card text-sm">Already decided: {inspection.decision ?? inspection.status}</div>
      )}
    </div>
  )
}

/** Live NCR read-only kiosk view. */
export function MobileNcrKioskPage() {
  const { id } = useParams<{ id: string }>()
  const [ncr, setNcr] = useState<QualityNcr | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !isApiMode()) {
      setLoading(false)
      return
    }
    void getNcr(id)
      .then((res) => setNcr(res.data))
      .catch(() => setNcr(null))
      .finally(() => setLoading(false))
  }, [id])

  if (!isApiMode()) {
    return <MobilePageTitle title="NCR" subtitle="API required" />
  }
  if (loading) return <div className="mob-card text-center">Loading…</div>
  if (!ncr) return <MobilePageTitle title="NCR" subtitle="Not found" />

  return (
    <div className="mob-kiosk space-y-3">
      <MobilePageTitle title={ncr.ncrNumber} subtitle={ncr.title} />
      <div className={kioskCardClass}>
        <MobileStatusChip label={ncr.status} tone={toneForStatus(ncr.status)} />
        <p className="mt-2 text-sm">{ncr.description ?? 'No description'}</p>
        <p className="mt-2 text-xs text-[#605e5c]">Severity: {ncr.severity}</p>
      </div>
      <Link to="/m/qc" className={kioskSecondaryBtn}>
        Back to QC
      </Link>
    </div>
  )
}
