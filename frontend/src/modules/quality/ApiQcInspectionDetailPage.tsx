import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  QcParameterMeasurementForm,
  draftsToParameterResults,
  snapshotToParameterDrafts,
  validateMandatoryParameterDrafts,
  type QcParameterDraft,
} from '@/components/quality/QcParameterMeasurementForm'
import {
  kioskCardClass,
  kioskDangerBtn,
  kioskPrimaryBtn,
  kioskSecondaryBtn,
  kioskWarnBtn,
} from '@/modules/mobile/kiosk/kioskCss'
import { useWorkspacePageHeaderSetters } from '@/context/WorkspacePageHeaderContext'
import { notify } from '@/store/toastStore'
import {
  decideInspection,
  getInspection,
  type QualityInspection,
  type QualityInspectionCategory,
  type QualityInspectionDecision,
  type QualityInspectionStatus,
  type QualityParameterSnapshot,
} from '@/services/api/qualityApi'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

const QC_DECISIONS: Array<{ value: QualityInspectionDecision; label: string }> = [
  { value: 'PASS', label: 'Passed — continue' },
  { value: 'CONDITIONAL_PASS', label: 'Conditionally accepted' },
  { value: 'REWORK', label: 'Rework' },
  { value: 'REJECT', label: 'Failed / Rejected' },
  { value: 'HOLD', label: 'QC Hold' },
]

function formatCategory(category: QualityInspectionCategory | string): string {
  switch (category) {
    case 'IN_PROCESS':
      return 'In-process QC'
    case 'FINAL':
      return 'Final QC'
    case 'INCOMING':
      return 'Incoming QC'
    case 'SUBCONTRACT_RETURN':
      return 'Subcontract return QC'
    default:
      return String(category).replace(/_/g, ' ')
  }
}

function formatStatusLabel(status: QualityInspectionStatus | string): string {
  switch (status) {
    case 'PENDING':
      return 'Awaiting decision'
    case 'PASSED':
      return 'Passed'
    case 'REWORK':
      return 'Rework required'
    case 'REJECTED':
      return 'Rejected'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return String(status).replace(/_/g, ' ')
  }
}

function formatDecisionLabel(decision: QualityInspectionDecision | string | null | undefined): string | null {
  if (!decision) return null
  switch (decision) {
    case 'PASS':
      return 'Pass'
    case 'CONDITIONAL_PASS':
      return 'Conditional pass'
    case 'REWORK':
      return 'Rework'
    case 'REJECT':
      return 'Reject'
    case 'HOLD':
      return 'Hold'
    case 'USE_AS_IS':
      return 'Use as is'
    default:
      return String(decision).replace(/_/g, ' ')
  }
}

function decisionTone(value: QualityInspectionDecision, selected: boolean) {
  if (!selected) return kioskSecondaryBtn
  if (value === 'PASS' || value === 'CONDITIONAL_PASS') return kioskPrimaryBtn
  if (value === 'REJECT' || value === 'HOLD') return kioskDangerBtn
  return kioskWarnBtn
}

function buildInspectionSubtitle(inspection: QualityInspection): string {
  const parts: string[] = [formatCategory(inspection.category)]
  if (inspection.itemCode || inspection.itemName) {
    parts.push([inspection.itemCode, inspection.itemName].filter(Boolean).join(' — '))
  } else if (inspection.stageName) {
    parts.push(inspection.stageName)
  } else if (inspection.title) {
    // Title often already includes category prefix — show clean business text only.
    const stripped = inspection.title
      .replace(/^(In-process|Final|Incoming)\s+QC\s*[—–-]\s*/i, '')
      .trim()
    if (stripped) parts.push(stripped)
  }
  return parts.join(' · ')
}

/** Shopfloor QC inspection decide page (API mode). */
export function ApiQcInspectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const headerSetters = useWorkspacePageHeaderSetters()
  const setHeader = headerSetters?.setHeader
  const [loading, setLoading] = useState(true)
  const [inspection, setInspection] = useState<QualityInspection | null>(null)
  const [drafts, setDrafts] = useState<QcParameterDraft[]>([])
  const [remarks, setRemarks] = useState('')
  const [qcDecision, setQcDecision] = useState<QualityInspectionDecision>('PASS')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getInspection(id)
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
        setDrafts(snapshotToParameterDrafts(snap))
      }
      if (res.data.decision) setQcDecision(res.data.decision)
      setRemarks(res.data.decisionRemarks ?? res.data.remarks ?? '')
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

  const decided = inspection != null && inspection.status !== 'PENDING' && inspection.status !== 'REWORK'
  const backTo = inspection?.status === 'REWORK' ? '/quality/rework' : '/quality/queue'
  const backLabel = inspection?.status === 'REWORK' ? 'Rework Workbench' : 'QC Queue'
  const planLabel =
    inspection?.inspectionPlan?.planName ||
    inspection?.inspectionPlan?.planCode ||
    inspection?.planCodeSnapshot ||
    '—'
  const workOrderLabel = inspection?.productionOrderNumber || null
  const itemLabel = [inspection?.itemCode, inspection?.itemName].filter(Boolean).join(' — ') || null
  const stageOpLabel =
    inspection?.operationName ||
    inspection?.stageName ||
    (inspection?.operationSequence != null ? `Seq ${inspection.operationSequence}` : null)

  useEffect(() => {
    if (!setHeader) return
    if (!inspection) {
      setHeader({
        meta: {
          title: 'Quality Inspection',
          badge: 'Quality',
          favoritePath: id ? `/quality/inspections/${id}` : '/quality/queue',
          breadcrumbs: [
            { label: 'Quality', to: '/quality' },
            { label: 'QC Queue', to: '/quality/queue' },
            { label: 'Inspection' },
          ],
        },
        commandBar: null,
        actions: null,
      })
      return
    }
    const statusBit = formatStatusLabel(inspection.status)
    const decisionBit = formatDecisionLabel(inspection.decision)
    setHeader({
      meta: {
        title: inspection.inspectionNumber,
        badge: 'Quality',
        favoritePath: `/quality/inspections/${inspection.id}`,
        breadcrumbs: [
          { label: 'Quality', to: '/quality' },
          { label: 'QC Queue', to: '/quality/queue' },
          { label: inspection.inspectionNumber },
        ],
      },
      commandBar: null,
      actions: decided ? (
        <button
          type="button"
          className="rounded-md border border-erp-border bg-white px-3 py-1.5 text-sm font-semibold text-erp-primary hover:bg-slate-50"
          onClick={() => navigate(`/quality/inspections/${inspection.id}/report`)}
        >
          QC Report
        </button>
      ) : (
        <span className="hidden text-sm text-erp-muted sm:inline">
          {statusBit}
          {decisionBit ? ` · ${decisionBit}` : ''}
        </span>
      ),
    })
  }, [setHeader, inspection, decided, id, navigate])

  useEffect(() => {
    if (!setHeader) return
    return () => setHeader({ meta: null, commandBar: null, actions: null })
  }, [setHeader])

  const snapshotById = useMemo(() => {
    const map = new Map<string, QualityParameterSnapshot>()
    for (const s of inspection?.parameterSnapshot ?? []) map.set(s.parameterId, s)
    return map
  }, [inspection])

  const snapshot = Array.isArray(inspection?.parameterSnapshot) ? inspection.parameterSnapshot : []

  async function submit() {
    if (!inspection) return
    if (qcDecision === 'PASS' || qcDecision === 'CONDITIONAL_PASS') {
      const err = validateMandatoryParameterDrafts(snapshot, drafts)
      if (err) {
        notify.error(err)
        return
      }
    }
    setBusy(true)
    try {
      const parameterResults = draftsToParameterResults(drafts, snapshotById)
      const qty = Number(inspection.inspectedQty ?? 0)
      await decideInspection(inspection.id, {
        decision: qcDecision,
        remarks: remarks || undefined,
        acceptedQty: qcDecision === 'PASS' || qcDecision === 'CONDITIONAL_PASS' ? qty : undefined,
        rejectedQty: qcDecision === 'REJECT' ? qty : undefined,
        reworkQty: qcDecision === 'REWORK' ? qty : undefined,
        parameterResults: parameterResults.length ? parameterResults : undefined,
      })
      notify.success(`Inspection ${formatDecisionLabel(qcDecision) ?? qcDecision}`)
      if (qcDecision === 'PASS' || qcDecision === 'CONDITIONAL_PASS') {
        navigate(`/quality/inspections/${inspection.id}/report`)
        return
      }
      navigate(qcDecision === 'REWORK' ? '/quality/rework' : '/quality/queue')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Decision failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState variant="card" />
  if (!inspection) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#f3f2f1] p-8 text-center">
        <p className="text-[#605e5c]">Inspection not found.</p>
        <Link to="/quality/queue" className="text-base font-semibold text-[#0078d4] hover:underline">
          Back to QC queue
        </Link>
      </div>
    )
  }

  const decisionLabel = formatDecisionLabel(inspection.decision)
  const statusLabel = formatStatusLabel(inspection.status)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f3f2f1] pb-32">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <PageBackLink to={backTo} label={backLabel} />

        <header className="mt-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#605e5c]">
            {formatCategory(inspection.category)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242424] sm:text-3xl">
            {inspection.inspectionNumber}
          </h1>
          <p className="mt-1 text-base text-[#605e5c]">{buildInspectionSubtitle(inspection)}</p>
        </header>

        <div className="grid gap-4">
          <div
            className={cn(
              kioskCardClass,
              decided ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#605e5c]">Status</p>
                <p className="mt-1 text-xl font-bold text-[#242424]">
                  {statusLabel}
                  {decisionLabel ? (
                    <>
                      <span className="mx-2 font-normal text-[#c8c6c4]">·</span>
                      <span className="text-base font-semibold">{decisionLabel}</span>
                    </>
                  ) : null}
                </p>
              </div>
              {decided ? (
                <button
                  type="button"
                  className={`${kioskSecondaryBtn} !w-auto !min-h-12 !px-5 !py-3 !text-base`}
                  onClick={() => navigate(`/quality/inspections/${inspection.id}/report`)}
                >
                  QC Report
                </button>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Plan</dt>
                <dd className="mt-0.5 text-base font-semibold text-[#242424]">{planLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Inspected qty</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-[#242424]">
                  {inspection.inspectedQty ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Work order</dt>
                <dd className="mt-0.5 text-base font-semibold text-[#242424]">
                  {workOrderLabel && inspection.productionOrderId ? (
                    <Link
                      to={`/manufacturing/work-orders/${inspection.productionOrderId}`}
                      className="text-[#0078d4] hover:underline"
                    >
                      {workOrderLabel}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Product</dt>
                <dd className="mt-0.5 text-base font-semibold text-[#242424]">{itemLabel ?? '—'}</dd>
              </div>
              {stageOpLabel ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                    {inspection.operationName ? 'Operation' : 'Stage'}
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold text-[#242424]">
                    {inspection.operationCode
                      ? `${inspection.operationCode} — ${stageOpLabel}`
                      : stageOpLabel}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Requested</dt>
                <dd className="mt-0.5 text-sm text-[#242424]">{formatDateTime(inspection.requestedAt)}</dd>
              </div>
            </dl>
          </div>

          <QcParameterMeasurementForm
            snapshot={snapshot}
            drafts={drafts}
            onChange={setDrafts}
            disabled={decided || busy}
            variant="kiosk"
          />

          {!decided ? (
            <div className={kioskCardClass}>
              <p className="text-sm font-bold uppercase tracking-wide text-[#605e5c]">Decision</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {QC_DECISIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={busy}
                    className={decisionTone(o.value, qcDecision === o.value)}
                    onClick={() => setQcDecision(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-[#242424]">Remarks</span>
                <textarea
                  className="mt-2 w-full min-h-24 rounded-xl border border-[#edebe9] bg-white px-4 py-3 text-lg text-[#242424] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/30 disabled:opacity-60"
                  rows={3}
                  value={remarks}
                  disabled={busy}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Decision notes"
                />
              </label>
              <p className="mt-3 text-center text-sm text-[#605e5c]">
                Pass requires measurements · opens QC report when approved
              </p>
            </div>
          ) : (
            <div className={kioskCardClass}>
              <p className="text-sm font-bold uppercase tracking-wide text-[#605e5c]">Decision recorded</p>
              <p className="mt-2 text-lg font-semibold text-[#242424]">
                {decisionLabel ?? statusLabel}
              </p>
              {(inspection.decisionRemarks || inspection.remarks) && (
                <p className="mt-2 whitespace-pre-wrap text-base text-[#605e5c]">
                  {inspection.decisionRemarks || inspection.remarks}
                </p>
              )}
              {inspection.decidedAt ? (
                <p className="mt-2 text-sm text-[#605e5c]">Decided {formatDateTime(inspection.decidedAt)}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#edebe9] bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className={`${kioskSecondaryBtn} sm:w-auto sm:min-w-[8rem]`}
            disabled={busy}
            onClick={() => navigate(backTo)}
          >
            Back
          </button>
          <div className="flex flex-col gap-2 sm:flex-row sm:min-w-[18rem]">
            {decided ? (
              <button
                type="button"
                className={`${kioskPrimaryBtn} sm:min-w-[12rem]`}
                onClick={() => navigate(`/quality/inspections/${inspection.id}/report`)}
              >
                Open QC Report
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`${kioskSecondaryBtn} sm:w-auto sm:min-w-[7rem]`}
                  disabled={busy}
                  onClick={() => navigate(backTo)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className={`${kioskPrimaryBtn} sm:min-w-[12rem]`}
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? 'Submitting…' : 'Submit QC'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
