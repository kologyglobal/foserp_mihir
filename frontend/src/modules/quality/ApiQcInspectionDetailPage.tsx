import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '@/components/masters/MasterLayouts'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { notify } from '@/store/toastStore'
import {
  decideInspection,
  getInspection,
  type QualityInspection,
  type QualityInspectionDecision,
  type QualityParameterSnapshot,
} from '@/services/api/qualityApi'

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

export function ApiQcInspectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [inspection, setInspection] = useState<QualityInspection | null>(null)
  const [drafts, setDrafts] = useState<DraftResult[]>([])
  const [remarks, setRemarks] = useState('')
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
    setBusy(true)
    try {
      const parameterResults = drafts.map((d) => {
        const snap = snapshotById.get(d.parameterId)
        const numeric =
          d.measuredNumeric === '' ? null : Number.isFinite(Number(d.measuredNumeric)) ? Number(d.measuredNumeric) : null
        return {
          parameterId: d.parameterId,
          measuredValue: d.measuredValue || null,
          measuredNumeric: snap?.parameterType === 'NUMERIC' ? numeric : null,
          passed: d.passed,
          remarks: d.remarks || null,
        }
      })
      await decideInspection(inspection.id, {
        decision,
        remarks: remarks || undefined,
        acceptedQty: decision === 'PASS' ? Number(inspection.inspectedQty ?? 0) : undefined,
        rejectedQty: decision === 'REJECT' ? Number(inspection.inspectedQty ?? 0) : undefined,
        reworkQty: decision === 'REWORK' ? Number(inspection.inspectedQty ?? 0) : undefined,
        parameterResults: parameterResults.length ? parameterResults : undefined,
      })
      notify.success(`Inspection ${decision}`)
      navigate(decision === 'REWORK' || inspection.status === 'REWORK' ? '/quality/rework' : '/quality/queue')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Decision failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState variant="card" />
  if (!inspection) {
    return (
      <div className="p-8 text-center text-slate-500">
        Inspection not found.{' '}
        <Link to="/quality/queue" className="text-erp-accent hover:underline">
          Back to queue
        </Link>
      </div>
    )
  }

  return (
    <DetailLayout
      backTo={inspection.status === 'REWORK' ? '/quality/rework' : '/quality/queue'}
      backLabel={inspection.status === 'REWORK' ? 'Rework Workbench' : 'QC Queue'}
      title={inspection.inspectionNumber}
      subtitle={`${inspection.category.replace(/_/g, ' ')} · ${inspection.title}`}
      badges={<StatusBadge status={inspection.status} />}
    >
      <DetailSection title="Inspection">
        <DetailGrid>
          <DetailField label="Plan" value={inspection.inspectionPlan?.planName ?? inspection.inspectionPlan?.planCode ?? '—'} />
          <DetailField label="Work Order" value={inspection.productionOrderId ?? '—'} />
          <DetailField label="Inspected qty" value={inspection.inspectedQty ?? '—'} />
          <DetailField label="Requested" value={new Date(inspection.requestedAt).toLocaleString()} />
        </DetailGrid>
      </DetailSection>

      {(inspection.parameterSnapshot?.length ?? 0) > 0 && (
        <DetailSection title="Parameter results">
          <div className="space-y-3">
            {drafts.map((d) => {
              const snap = snapshotById.get(d.parameterId)
              if (!snap) return null
              return (
                <div key={d.parameterId} className="rounded-lg border border-erp-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{snap.parameterCode}</span>
                    <span className="text-erp-muted">{snap.parameterName}</span>
                    {snap.mandatory && <StatusBadge status="mandatory" />}
                    {snap.minValue != null && (
                      <span className="text-xs text-erp-muted">
                        {snap.minValue}–{snap.maxValue} {snap.uomCode ?? ''}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {snap.parameterType === 'NUMERIC' ? (
                      <label className="block text-sm">
                        <span className="font-medium">Measured</span>
                        <input
                          type="number"
                          className="erp-input mt-1 w-full"
                          disabled={decided}
                          value={d.measuredNumeric}
                          onChange={(e) =>
                            setDrafts((rows) =>
                              rows.map((r) => (r.parameterId === d.parameterId ? { ...r, measuredNumeric: e.target.value } : r)),
                            )
                          }
                        />
                      </label>
                    ) : snap.parameterType === 'BOOLEAN' ? (
                      <label className="block text-sm">
                        <span className="font-medium">Result</span>
                        <select
                          className="erp-input mt-1 w-full"
                          disabled={decided}
                          value={d.measuredValue}
                          onChange={(e) =>
                            setDrafts((rows) =>
                              rows.map((r) =>
                                r.parameterId === d.parameterId
                                  ? { ...r, measuredValue: e.target.value, passed: e.target.value === 'true' }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="">Select…</option>
                          <option value="true">Pass / Yes</option>
                          <option value="false">Fail / No</option>
                        </select>
                      </label>
                    ) : (
                      <label className="block text-sm sm:col-span-2">
                        <span className="font-medium">Value</span>
                        <input
                          className="erp-input mt-1 w-full"
                          disabled={decided}
                          value={d.measuredValue}
                          onChange={(e) =>
                            setDrafts((rows) =>
                              rows.map((r) => (r.parameterId === d.parameterId ? { ...r, measuredValue: e.target.value } : r)),
                            )
                          }
                        />
                      </label>
                    )}
                    {snap.passFailRule === 'MANUAL' && (
                      <label className="block text-sm">
                        <span className="font-medium">Pass?</span>
                        <select
                          className="erp-input mt-1 w-full"
                          disabled={decided}
                          value={d.passed == null ? '' : d.passed ? 'true' : 'false'}
                          onChange={(e) =>
                            setDrafts((rows) =>
                              rows.map((r) =>
                                r.parameterId === d.parameterId
                                  ? {
                                      ...r,
                                      passed: e.target.value === '' ? null : e.target.value === 'true',
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="">—</option>
                          <option value="true">Pass</option>
                          <option value="false">Fail</option>
                        </select>
                      </label>
                    )}
                    <label className="block text-sm sm:col-span-3">
                      <span className="font-medium">Remarks</span>
                      <input
                        className="erp-input mt-1 w-full"
                        disabled={decided}
                        value={d.remarks}
                        onChange={(e) =>
                          setDrafts((rows) =>
                            rows.map((r) => (r.parameterId === d.parameterId ? { ...r, remarks: e.target.value } : r)),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </DetailSection>
      )}

      {!decided && (
        <DetailSection title="Decision">
          <label className="mb-3 block max-w-xl text-sm">
            <span className="font-medium">Remarks</span>
            <textarea className="erp-input mt-1 w-full" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void submit('PASS')}>
              Pass
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void submit('REWORK')}>
              Rework
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void submit('REJECT')}>
              Reject
            </Button>
          </div>
        </DetailSection>
      )}
    </DetailLayout>
  )
}
