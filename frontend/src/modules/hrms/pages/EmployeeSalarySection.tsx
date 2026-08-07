import { useEffect, useState } from 'react'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  createSalaryAssignment,
  getEmployeeEffectiveSalary,
  getSalaryStructure,
  listSalaryAssignments,
  listSalaryStructures,
  previewSalaryStructure,
  reviseSalaryAssignment,
  type HrSalaryAssignment,
  type HrSalaryPreview,
  type HrSalaryStructure,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'

type Props = {
  employeeId: string
  employeeLabel?: string
}

export function EmployeeSalarySection({ employeeId, employeeLabel }: Props) {
  const perms = useHrmsPermissions()
  const canView = perms.canViewSalaryAssignment
  const canManage = perms.canManageSalaryAssignment

  const [effective, setEffective] = useState<Record<string, unknown> | null>(null)
  const [history, setHistory] = useState<HrSalaryAssignment[]>([])
  const [structures, setStructures] = useState<HrSalaryStructure[]>([])
  const [structureId, setStructureId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [preview, setPreview] = useState<HrSalaryPreview | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!canView || !employeeId) return
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [eff, hist, structs] = await Promise.all([
        getEmployeeEffectiveSalary(employeeId, today).catch(() => ({ data: null })),
        listSalaryAssignments({ employeeId, limit: 50 }),
        listSalaryStructures({ limit: 100, isActive: true }),
      ])
      setEffective((eff.data as Record<string, unknown> | null) ?? null)
      setHistory(hist.data ?? [])
      setStructures(structs.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load salary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [employeeId, canView])

  const selectedStructure = structures.find((s) => s.id === structureId)
  const versions =
    selectedStructure?.versions?.filter((v) => v.status === 'ACTIVE' || v.status === 'DRAFT') ??
    (selectedStructure?.activeVersion ? [selectedStructure.activeVersion] : [])

  useEffect(() => {
    if (!versionId || !effectiveFrom) {
      setPreview(null)
      return
    }
    void previewSalaryStructure({
      employeeId,
      salaryStructureVersionId: versionId,
      effectiveDate: effectiveFrom,
    })
      .then((res) => setPreview(res.data ?? null))
      .catch(() => setPreview(null))
  }, [versionId, effectiveFrom, employeeId])

  if (!canView) return null

  const structureMeta = effective?.structure as { code?: string; name?: string } | undefined
  const versionMeta = effective?.version as { versionNo?: number; effectiveFrom?: string } | undefined
  const assignmentMeta = effective?.assignment as
    | { monthlyGross?: number | null; annualCtc?: number | null; effectiveFrom?: string }
    | undefined

  const activeAssignment = history.find((h) => h.status === 'ACTIVE')

  const submitAssign = async () => {
    if (!canManage || !versionId || !effectiveFrom) return
    try {
      if (activeAssignment) {
        const monthly = preview?.summary.totalEarnings ?? null
        await reviseSalaryAssignment(activeAssignment.id, {
          salaryStructureVersionId: versionId,
          effectiveFrom,
          monthlyGross: monthly,
          annualCtc: monthly != null ? Math.round(monthly * 12 * 100) / 100 : null,
        })
        notify.success('Salary revised')
      } else {
        const monthly = preview?.summary.totalEarnings ?? null
        await createSalaryAssignment({
          employeeId,
          salaryStructureVersionId: versionId,
          effectiveFrom,
          monthlyGross: monthly,
          annualCtc: monthly != null ? Math.round(monthly * 12 * 100) / 100 : null,
          status: 'ACTIVE',
        })
        notify.success('Salary structure assigned')
      }
      setShowAssign(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Assignment failed')
    }
  }

  useEffect(() => {
    if (!structureId) return
    void getSalaryStructure(structureId)
      .then((res) => {
        const detail = res.data
        if (!detail) return
        setStructures((prev) => prev.map((s) => (s.id === structureId ? { ...s, ...detail } : s)))
        const active = detail.activeVersion ?? detail.versions?.find((v) => v.status === 'ACTIVE')
        if (active) setVersionId(active.id)
      })
      .catch(() => {})
  }, [structureId])

  return (
    <section className="mt-4 rounded border border-erp-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Salary</h2>
          <p className="text-xs text-erp-muted">
            Sensitive — requires salary assignment permission
            {employeeLabel ? ` · ${employeeLabel}` : ''}
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAssign((v) => !v)}>
            {activeAssignment ? 'Revise Salary' : 'Assign Salary Structure'}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-erp-muted">Loading…</p>
      ) : (
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-erp-muted">Current structure</div>
            <div className="font-medium">
              {structureMeta
                ? `${structureMeta.code}${versionMeta?.versionNo != null ? ` v${versionMeta.versionNo}` : ''}`
                : '— Not assigned —'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-erp-muted">Effective from</div>
            <div>{assignmentMeta?.effectiveFrom ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-erp-muted">Monthly gross</div>
            <div>
              {assignmentMeta?.monthlyGross != null ? `₹${Number(assignmentMeta.monthlyGross).toLocaleString()}` : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-erp-muted">Annual CTC</div>
            <div>
              {assignmentMeta?.annualCtc != null ? `₹${Number(assignmentMeta.annualCtc).toLocaleString()}` : '-'}
            </div>
          </div>
        </div>
      )}

      {showAssign && canManage ? (
        <div className="mt-4 grid gap-2 rounded border border-dashed border-erp-border p-3 md:grid-cols-3">
          <FormField label="Salary structure" required>
            <Select
              value={structureId}
              onChange={(e) => {
                setStructureId(e.target.value)
                setVersionId('')
              }}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Version" required>
            <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNo} ({v.status}) from {v.effectiveFrom}
                </option>
              ))}
              {selectedStructure?.activeVersion &&
              !versions.some((v) => v.id === selectedStructure.activeVersion!.id) ? (
                <option value={selectedStructure.activeVersion.id}>
                  v{selectedStructure.activeVersion.versionNo} (ACTIVE)
                </option>
              ) : null}
            </Select>
          </FormField>
          <FormField label="Effective from" required>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </FormField>
          {preview ? (
            <div className="md:col-span-3 rounded bg-erp-surface p-2 text-sm">
              <div>
                Monthly gross preview:{' '}
                <strong>₹{preview.summary.totalEarnings.toLocaleString()}</strong>
              </div>
              <div>
                Annual CTC preview (×12):{' '}
                <strong>₹{(preview.summary.totalEarnings * 12).toLocaleString()}</strong>
              </div>
              <p className="mt-1 text-xs text-erp-muted">Configuration preview only — not a payroll run.</p>
            </div>
          ) : null}
          <div className="md:col-span-3">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void submitAssign()}>
              Save assignment
            </button>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-erp-muted">History / revisions</h3>
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-erp-muted">
              <tr>
                <th className="py-1 pr-3">Structure</th>
                <th className="py-1 pr-3">From</th>
                <th className="py-1 pr-3">To</th>
                <th className="py-1 pr-3">Gross</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-erp-border">
                  <td className="py-1 pr-3">
                    {h.version?.structure?.code ?? '-'}
                    {h.version ? ` v${h.version.versionNo}` : ''}
                  </td>
                  <td className="py-1 pr-3">{h.effectiveFrom}</td>
                  <td className="py-1 pr-3">{h.effectiveTo ?? '-'}</td>
                  <td className="py-1 pr-3">
                    {h.monthlyGross != null ? `₹${h.monthlyGross.toLocaleString()}` : '-'}
                  </td>
                  <td className="py-1">{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
