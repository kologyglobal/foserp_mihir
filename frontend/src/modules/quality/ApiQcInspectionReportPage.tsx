import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getInspection, type QualityInspection } from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'

function fmt(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  return value
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function measuredDisplay(row: {
  parameterType: string
  measuredValue: string | null
  measuredNumeric: number | null
  uomCode: string | null
}) {
  if (row.parameterType === 'NUMERIC' && row.measuredNumeric != null) {
    return `${row.measuredNumeric}${row.uomCode ? ` ${row.uomCode}` : ''}`
  }
  if (row.measuredValue != null && row.measuredValue !== '') return row.measuredValue
  return '—'
}

export function ApiQcInspectionReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [inspection, setInspection] = useState<QualityInspection | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getInspection(id)
      setInspection(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load QC report')
      setInspection(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState variant="card" />
  if (!inspection) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Inspection not found.</p>
        <Link to="/quality/queue" className="text-sm font-semibold text-erp-primary hover:underline">
          Back to QC queue
        </Link>
      </div>
    )
  }

  const results =
    inspection.parameterResults?.length
      ? [...inspection.parameterResults].sort((a, b) => a.sortOrder - b.sortOrder)
      : (inspection.parameterSnapshot ?? []).map((s) => ({
          id: s.parameterId,
          parameterId: s.parameterId,
          parameterCode: s.parameterCode,
          parameterName: s.parameterName,
          parameterType: s.parameterType,
          mandatory: s.mandatory,
          severity: s.severity,
          passFailRule: s.passFailRule,
          uomCode: s.uomCode,
          minValue: s.minValue,
          maxValue: s.maxValue,
          targetValue: s.targetValue,
          sortOrder: s.sortOrder,
          measuredValue: null as string | null,
          measuredNumeric: null as number | null,
          passed: null as boolean | null,
          remarks: null as string | null,
        }))

  const detailPath = `/quality/inspections/${inspection.id}`

  return (
    <div className="po-print-page erp-page">
      <div className="po-print-toolbar no-print">
        <div>
          <p className="po-print-toolbar__title">{inspection.inspectionNumber}</p>
          <p className="po-print-toolbar__subtitle">Quality inspection report — print / PDF</p>
        </div>
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print / PDF
          </ErpButton>
          <ErpButton
            type="button"
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate(detailPath)}
          >
            Back to inspection
          </ErpButton>
        </ErpButtonGroup>
      </div>

      <article className="po-print-doc">
        <header className="mb-4 border-b border-slate-300 pb-3">
          <h1 className="m-0 text-lg font-bold tracking-tight text-slate-900">Quality Control Report</h1>
          <p className="m-0 mt-1 text-[12px] text-slate-600">{inspection.title}</p>
        </header>

        <section className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Inspection No.
            </p>
            <p className="m-0 font-mono font-semibold">{inspection.inspectionNumber}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Category</p>
            <p className="m-0">{inspection.category.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="m-0 font-semibold">{inspection.status}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Decision</p>
            <p className="m-0 font-semibold">{fmt(inspection.decision)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Plan</p>
            <p className="m-0">
              {inspection.inspectionPlan?.planName ??
                inspection.inspectionPlan?.planCode ??
                inspection.planCodeSnapshot ??
                '—'}
            </p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Work order</p>
            <p className="m-0 font-mono text-[12px]">{fmt(inspection.productionOrderId)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Inspected qty
            </p>
            <p className="m-0 tabular-nums">{fmt(inspection.inspectedQty)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Accepted</p>
            <p className="m-0 tabular-nums">{fmt(inspection.acceptedQty)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rejected</p>
            <p className="m-0 tabular-nums">{fmt(inspection.rejectedQty)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Requested</p>
            <p className="m-0">{fmtDate(inspection.requestedAt)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Decided</p>
            <p className="m-0">{fmtDate(inspection.decidedAt)}</p>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="mb-2 mt-0 text-[13px] font-bold uppercase tracking-wide text-slate-800">
            Measurement results
          </h2>
          {results.length === 0 ? (
            <p className="m-0 text-[12px] text-slate-500">No parameters were captured on this inspection.</p>
          ) : (
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="px-2 py-1.5 font-semibold">Code</th>
                  <th className="px-2 py-1.5 font-semibold">Parameter</th>
                  <th className="px-2 py-1.5 font-semibold">Spec</th>
                  <th className="px-2 py-1.5 font-semibold">Measured</th>
                  <th className="px-2 py-1.5 font-semibold">Result</th>
                  <th className="px-2 py-1.5 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.id ?? row.parameterId} className="border-b border-slate-200">
                    <td className="px-2 py-1.5 font-mono">{row.parameterCode}</td>
                    <td className="px-2 py-1.5">{row.parameterName}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">
                      {row.minValue != null || row.maxValue != null
                        ? `${row.minValue ?? '—'} – ${row.maxValue ?? '—'}${row.uomCode ? ` ${row.uomCode}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums font-medium">{measuredDisplay(row)}</td>
                    <td className="px-2 py-1.5 font-semibold">
                      {row.passed == null ? '—' : row.passed ? 'PASS' : 'FAIL'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{fmt(row.remarks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {(inspection.decisionRemarks || inspection.remarks) && (
          <section className="mb-4">
            <h2 className="mb-1 mt-0 text-[13px] font-bold uppercase tracking-wide text-slate-800">
              Remarks
            </h2>
            <p className="m-0 whitespace-pre-wrap text-[12px] text-slate-700">
              {inspection.decisionRemarks || inspection.remarks}
            </p>
          </section>
        )}

        <footer className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-300 pt-6 text-[11px] text-slate-600">
          <div>
            <p className="mb-8 mt-0">Inspector signature</p>
            <p className="m-0 border-t border-slate-400 pt-1">Name / date</p>
          </div>
          <div>
            <p className="mb-8 mt-0">Reviewed by</p>
            <p className="m-0 border-t border-slate-400 pt-1">Name / date</p>
          </div>
        </footer>
      </article>
    </div>
  )
}
