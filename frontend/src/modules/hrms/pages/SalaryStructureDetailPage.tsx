import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, RefreshCw, Save, CheckCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { appConfirm } from '@/store/confirmDialogStore'
import { HrStatusChip } from '@/modules/hrms/components'
import '../hrms-ui.css'
import {
  activateSalaryStructureVersion,
  createSalaryStructureVersion,
  getSalaryStructure,
  getSalaryStructureVersion,
  listSalaryComponents,
  updateSalaryStructureVersion,
  type HrSalaryCalculationType,
  type HrSalaryComponent,
  type HrSalaryStructure,
  type HrSalaryStructureLine,
  type HrSalaryStructureVersion,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'

type DraftLine = {
  salaryComponentId: string
  sequence: number
  calculationType: HrSalaryCalculationType
  fixedAmount: string
  percentage: string
  percentageOfComponentId: string
}

function ruleLabel(line: HrSalaryStructureLine | DraftLine, components: HrSalaryComponent[]): string {
  const ofCode =
    'percentageOfComponent' in line && line.percentageOfComponent
      ? line.percentageOfComponent.code
      : components.find((c) => c.id === line.percentageOfComponentId)?.code
  if (line.calculationType === 'FIXED') {
    const amt = 'fixedAmount' in line ? line.fixedAmount : null
    return `Fixed ₹${amt ?? '—'}`
  }
  if (line.calculationType === 'PERCENTAGE') {
    return `${line.percentage ?? '—'}% of ${ofCode ?? '—'}`
  }
  if (line.calculationType === 'OT_LINKED') return 'OT Linked'
  if (line.calculationType === 'ATTENDANCE_LINKED') return 'Attendance Linked'
  if (line.calculationType === 'STATUTORY') return 'Statutory'
  return line.calculationType
}

export function SalaryStructureDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useHrmsPermissions()
  const [structure, setStructure] = useState<HrSalaryStructure | null>(null)
  const [version, setVersion] = useState<HrSalaryStructureVersion | null>(null)
  const [components, setComponents] = useState<HrSalaryComponent[]>([])
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [loading, setLoading] = useState(true)
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('')

  const load = async (preferVersionId?: string) => {
    if (!id) return
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        getSalaryStructure(id),
        listSalaryComponents({ limit: 200, isActive: true }),
      ])
      const s = sRes.data
      setStructure(s ?? null)
      setComponents(cRes.data ?? [])
      const versions = s?.versions ?? []
      const pickId =
        preferVersionId ||
        s?.activeVersion?.id ||
        versions.find((v) => v.status === 'DRAFT')?.id ||
        versions[0]?.id
      if (pickId) {
        const vRes = await getSalaryStructureVersion(pickId)
        const v = vRes.data
        setVersion(v ?? null)
        setDraftLines(
          (v?.lines ?? []).map((l) => ({
            salaryComponentId: l.salaryComponentId,
            sequence: l.sequence,
            calculationType: l.calculationType,
            fixedAmount: l.fixedAmount != null ? String(l.fixedAmount) : '',
            percentage: l.percentage != null ? String(l.percentage) : '',
            percentageOfComponentId: l.percentageOfComponentId ?? '',
          })),
        )
      } else {
        setVersion(null)
        setDraftLines([])
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load structure')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const addLine = () => {
    setDraftLines((prev) => [
      ...prev,
      {
        salaryComponentId: '',
        sequence: (prev.length + 1) * 10,
        calculationType: 'FIXED',
        fixedAmount: '',
        percentage: '',
        percentageOfComponentId: '',
      },
    ])
  }

  const saveDraft = async () => {
    if (!version || version.status !== 'DRAFT' || !perms.canManageSalaryStructure) return
    try {
      await updateSalaryStructureVersion(version.id, {
        lines: draftLines
          .filter((l) => l.salaryComponentId)
          .map((l) => ({
            salaryComponentId: l.salaryComponentId,
            sequence: l.sequence,
            calculationType: l.calculationType,
            fixedAmount: l.calculationType === 'FIXED' && l.fixedAmount ? Number(l.fixedAmount) : null,
            percentage:
              l.calculationType === 'PERCENTAGE' && l.percentage ? Number(l.percentage) : null,
            percentageOfComponentId:
              l.calculationType === 'PERCENTAGE' && l.percentageOfComponentId
                ? l.percentageOfComponentId
                : null,
            isActive: true,
          })),
      })
      notify.success('Draft saved')
      await load(version.id)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const activate = async () => {
    if (!version || !perms.canManageSalaryStructure) return
    const ok = await appConfirm({
      title: 'Activate version',
      description: `Activate version ${version.versionNo}? Active versions become read-only.`,
    })
    if (!ok) return
    try {
      if (version.status === 'DRAFT') await saveDraft()
      await activateSalaryStructureVersion(version.id)
      notify.success('Version activated')
      await load(version.id)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Activate failed')
    }
  }

  const createVersion = async () => {
    if (!id || !newEffectiveFrom || !perms.canManageSalaryStructure) return
    try {
      const res = await createSalaryStructureVersion(id, {
        effectiveFrom: newEffectiveFrom,
        copyFromVersionId: structure?.activeVersion?.id ?? version?.id,
      })
      notify.success('Draft version created')
      setNewEffectiveFrom('')
      await load(res.data?.id)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create version failed')
    }
  }

  if (loading) {
    return (
      <OperationalPageShell title="Salary Structure" breadcrumbs={[{ label: 'HRMS' }, { label: 'Structures' }]}>
        <LoadingState />
      </OperationalPageShell>
    )
  }

  if (!structure) {
    return (
      <OperationalPageShell title="Salary Structure" breadcrumbs={[{ label: 'HRMS' }, { label: 'Structures' }]}>
        <p className="text-sm text-erp-muted">Structure not found.</p>
      </OperationalPageShell>
    )
  }

  const editable = version?.status === 'DRAFT' && perms.canManageSalaryStructure
  const hasActiveVersion = (structure.versions ?? []).some((v) => v.status === 'ACTIVE')

  return (
    <OperationalPageShell
      title={`${structure.code}${version ? ` — Version ${version.versionNo}` : ''}`}
      description={structure.name}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Structures', to: '/hrms/payroll/setup/structures' },
        { label: structure.code },
      ]}
    >
      <ErpCommandBar
        primaryAction={
          editable
            ? { id: 'save', label: 'Save Draft', icon: Save, onClick: () => void saveDraft() }
            : undefined
        }
        secondaryActions={[
          ...(editable
            ? [{ id: 'activate', label: 'Activate Version', icon: CheckCircle, onClick: () => void activate() }]
            : []),
          { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load(version?.id) },
        ]}
      />

      <div className="mb-4 grid gap-3 rounded border border-erp-border bg-white p-4 text-sm md:grid-cols-3">
        <div>
          <div className="text-xs uppercase text-erp-muted">Category</div>
          <div>{structure.workerCategory ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-erp-muted">Version status</div>
          <div>{version ? <HrStatusChip status={version.status} domain="salaryStructureVersion" /> : 'No version'}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-erp-muted">Effective from</div>
          <div>{version?.effectiveFrom ?? '—'}</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-erp-muted">Versions:</span>
        {(structure.versions ?? []).map((v) => (
          <button
            key={v.id}
            type="button"
            className={`hr-version-pill ${version?.id === v.id ? 'hr-version-pill--active' : ''}`}
            onClick={() => void load(v.id)}
          >
            v{v.versionNo}
            <HrStatusChip status={v.status} domain="salaryStructureVersion" />
          </button>
        ))}
        {perms.canManageSalaryStructure ? (
          <div className="ml-auto flex items-end gap-2">
            <FormField label={hasActiveVersion ? 'Revision effective from' : 'New version from'}>
              <Input type="date" value={newEffectiveFrom} onChange={(e) => setNewEffectiveFrom(e.target.value)} />
            </FormField>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => void createVersion()}>
              <Plus className="mr-1 h-4 w-4" />
              {hasActiveVersion ? 'Create Revision' : 'New Draft Version'}
            </button>
          </div>
        ) : null}
      </div>

      {!version ? (
        <p className="text-sm text-erp-muted">Create a draft version to add component lines.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-erp-border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
              <tr>
                <th className="px-3 py-2">Seq</th>
                <th className="px-3 py-2">Component</th>
                <th className="px-3 py-2">Rule</th>
                {editable ? <th className="px-3 py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(editable ? draftLines : version.lines ?? []).map((line, idx) => {
                const draft = editable ? (line as DraftLine) : null
                const display = !editable ? (line as HrSalaryStructureLine) : null
                return (
                  <tr key={idx} className="border-t border-erp-border align-top">
                    <td className="px-3 py-2">
                      {editable ? (
                        <Input
                          type="number"
                          className="w-20"
                          value={draft!.sequence}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setDraftLines((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, sequence: v } : p)),
                            )
                          }}
                        />
                      ) : (
                        display!.sequence
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <Select
                          value={draft!.salaryComponentId}
                          onChange={(e) => {
                            const cid = e.target.value
                            const comp = components.find((c) => c.id === cid)
                            setDraftLines((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      salaryComponentId: cid,
                                      calculationType: (comp?.calculationType ??
                                        p.calculationType) as HrSalaryCalculationType,
                                    }
                                  : p,
                              ),
                            )
                          }}
                        >
                          <option value="">{SELECT_PLACEHOLDER}</option>
                          {components.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        display!.salaryComponent?.code ?? display!.salaryComponentId
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <div className="flex flex-wrap gap-2">
                          <Select
                            value={draft!.calculationType}
                            onChange={(e) =>
                              setDraftLines((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? {
                                        ...p,
                                        calculationType: e.target.value as HrSalaryCalculationType,
                                      }
                                    : p,
                                ),
                              )
                            }
                          >
                            {(
                              [
                                'FIXED',
                                'PERCENTAGE',
                                'ATTENDANCE_LINKED',
                                'OT_LINKED',
                                'STATUTORY',
                              ] as const
                            ).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </Select>
                          {draft!.calculationType === 'FIXED' ? (
                            <Input
                              type="number"
                              className="w-28"
                              placeholder="Amount"
                              value={draft!.fixedAmount}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, fixedAmount: e.target.value } : p,
                                  ),
                                )
                              }
                            />
                          ) : null}
                          {draft!.calculationType === 'PERCENTAGE' ? (
                            <>
                              <Input
                                type="number"
                                className="w-20"
                                placeholder="%"
                                value={draft!.percentage}
                                onChange={(e) =>
                                  setDraftLines((prev) =>
                                    prev.map((p, i) =>
                                      i === idx ? { ...p, percentage: e.target.value } : p,
                                    ),
                                  )
                                }
                              />
                              <Select
                                value={draft!.percentageOfComponentId}
                                onChange={(e) =>
                                  setDraftLines((prev) =>
                                    prev.map((p, i) =>
                                      i === idx
                                        ? { ...p, percentageOfComponentId: e.target.value }
                                        : p,
                                    ),
                                  )
                                }
                              >
                                <option value="">{SELECT_PLACEHOLDER}</option>
                                {components.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.code}
                                  </option>
                                ))}
                              </Select>
                            </>
                          ) : null}
                          {!['FIXED', 'PERCENTAGE'].includes(draft!.calculationType) ? (
                            <span className="text-erp-muted">{ruleLabel(draft!, components)}</span>
                          ) : null}
                        </div>
                      ) : (
                        ruleLabel(display!, components)
                      )}
                    </td>
                    {editable ? (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setDraftLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {editable ? (
            <div className="border-t border-erp-border p-2">
              <button type="button" className="btn btn--secondary btn--sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                Add line
              </button>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-3 text-xs text-erp-muted">
        Active versions are read-only. Create a new version for revisions.{' '}
        <Link className="text-erp-primary" to="/hrms/payroll/setup/components">
          Manage components
        </Link>
      </p>
    </OperationalPageShell>
  )
}
