import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GitBranch, Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Switch } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell, AccountConfirmModal } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import {
  activateRoutingVersion,
  compareRoutingVersions,
  createDependency,
  createOperation,
  createStageGroup,
  deleteDependency,
  deleteOperation,
  deleteStageGroup,
  getRouting,
  getRoutingVersion,
  listMachines,
  listWorkCentres,
  reviseRoutingVersion,
  validateRoutingVersion,
} from '@/services/api/manufacturingApi'
import {
  DEPENDENCY_TYPE_VALUES,
  IO_TYPE_VALUES,
  RUN_TIME_BASIS_VALUES,
  STAGE_COMPLETION_RULE_VALUES,
  type Dependency,
  type DependencyType,
  type IoType,
  type Machine,
  type Operation,
  type Routing,
  type RoutingCompareResult,
  type RoutingVersion,
  type RunTimeBasis,
  type StageCompletionRule,
  type StageGroup,
  type ValidationResult,
  type WorkCentre,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { appConfirm } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'

interface StageFormState {
  code: string
  name: string
  displayOrder: string
  defaultWorkCentreId: string
  completionRule: StageCompletionRule
  isOptional: boolean
  parallelAllowed: boolean
  qualityRequired: boolean
}

const EMPTY_STAGE_FORM: StageFormState = {
  code: '',
  name: '',
  displayOrder: '1',
  defaultWorkCentreId: '',
  completionRule: 'ALL_OPERATIONS',
  isOptional: false,
  parallelAllowed: false,
  qualityRequired: false,
}

interface OperationFormState {
  stageGroupId: string
  code: string
  name: string
  sequence: string
  workCentreId: string
  defaultMachineId: string
  setupTimeMinutes: string
  runTimeValue: string
  runTimeBasis: RunTimeBasis
  inputType: IoType
  outputType: IoType
  qualityRequired: boolean
}

const EMPTY_OPERATION_FORM: OperationFormState = {
  stageGroupId: '',
  code: '',
  name: '',
  sequence: '1',
  workCentreId: '',
  defaultMachineId: '',
  setupTimeMinutes: '0',
  runTimeValue: '0',
  runTimeBasis: 'PER_UNIT',
  inputType: 'MATERIAL',
  outputType: 'NONE',
  qualityRequired: false,
}

interface DependencyFormState {
  predecessorOperationId: string
  successorOperationId: string
  dependencyType: DependencyType
  minimumCompletionPercent: string
  isMandatory: boolean
  allowParallel: boolean
}

const EMPTY_DEPENDENCY_FORM: DependencyFormState = {
  predecessorOperationId: '',
  successorOperationId: '',
  dependencyType: 'FINISH_TO_START',
  minimumCompletionPercent: '100',
  isMandatory: true,
  allowParallel: false,
}

export function RoutingVersionEditorPage() {
  const { routingId: routingIdParam, versionId: versionIdParam } = useParams<{ routingId?: string; versionId?: string }>()
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()

  const [routing, setRouting] = useState<Routing | null>(null)
  const [versions, setVersions] = useState<RoutingVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [version, setVersion] = useState<RoutingVersion | null>(null)
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)

  const [stageDrawerOpen, setStageDrawerOpen] = useState(false)
  const [stageForm, setStageForm] = useState<StageFormState>(EMPTY_STAGE_FORM)
  const [opDrawerOpen, setOpDrawerOpen] = useState(false)
  const [opForm, setOpForm] = useState<OperationFormState>(EMPTY_OPERATION_FORM)
  const [depDrawerOpen, setDepDrawerOpen] = useState(false)
  const [depForm, setDepForm] = useState<DependencyFormState>(EMPTY_DEPENDENCY_FORM)
  const [depError, setDepError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [compareResult, setCompareResult] = useState<RoutingCompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const workCentreLabel = useCallback(
    (id: string | null) => (id ? workCentres.find((w) => w.id === id)?.name ?? id.slice(0, 8) : '—'),
    [workCentres],
  )
  const machineLabel = useCallback(
    (id: string | null) => (id ? machines.find((m) => m.id === id)?.name ?? id.slice(0, 8) : '—'),
    [machines],
  )
  const operationLabel = useCallback(
    (id: string) => {
      const op = operations.find((o) => o.id === id)
      return op ? `${op.code} — ${op.name}` : id.slice(0, 8)
    },
    [operations],
  )

  const loadVersionDetail = useCallback(async (versionId: string) => {
    const res = await getRoutingVersion(versionId)
    setVersion(res.data)
    setStageGroups(res.data.stageGroups)
    setOperations(res.data.operations)
    setDependencies(res.data.dependencies)
  }, [])

  const loadAll = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [wcRes, machineRes] = await Promise.all([listWorkCentres({ limit: 100 }), listMachines({ limit: 100 })])
      setWorkCentres(wcRes.data)
      setMachines(machineRes.data)

      let resolvedRoutingId = routingIdParam
      let resolvedVersionId = versionIdParam

      if (resolvedVersionId && !resolvedRoutingId) {
        const versionRes = await getRoutingVersion(resolvedVersionId)
        resolvedRoutingId = versionRes.data.routingId
      }
      if (!resolvedRoutingId) return

      const routingRes = await getRouting(resolvedRoutingId)
      setRouting(routingRes.data)
      setVersions(routingRes.data.versions)

      if (!resolvedVersionId) {
        const active = routingRes.data.versions.find((v) => v.status === 'ACTIVE')
        const latest = [...routingRes.data.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]
        resolvedVersionId = (active ?? latest)?.id
      }
      if (resolvedVersionId) {
        setSelectedVersionId(resolvedVersionId)
        await loadVersionDetail(resolvedVersionId)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load routing')
    } finally {
      setLoading(false)
    }
  }, [apiMode, routingIdParam, versionIdParam, loadVersionDetail])

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routingIdParam, versionIdParam])

  const switchVersion = async (versionId: string) => {
    setSelectedVersionId(versionId)
    setValidation(null)
    setLoading(true)
    try {
      await loadVersionDetail(versionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const isDraft = version?.status === 'DRAFT'
  const canManage = isDraft && perms.canManageRouting

  const operationsByStage = useMemo(() => {
    const map = new Map<string, Operation[]>()
    for (const op of operations) {
      const list = map.get(op.stageGroupId) ?? []
      list.push(op)
      map.set(op.stageGroupId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.sequence - b.sequence)
    return map
  }, [operations])

  const openAddStage = () => {
    setStageForm({ ...EMPTY_STAGE_FORM, displayOrder: String(stageGroups.length + 1) })
    setStageDrawerOpen(true)
  }

  const saveStage = async () => {
    if (!selectedVersionId) return
    setSaving(true)
    try {
      await createStageGroup(selectedVersionId, {
        code: stageForm.code.trim(),
        name: stageForm.name.trim(),
        displayOrder: Number(stageForm.displayOrder) || 1,
        defaultWorkCentreId: stageForm.defaultWorkCentreId || undefined,
        completionRule: stageForm.completionRule,
        isOptional: stageForm.isOptional,
        parallelAllowed: stageForm.parallelAllowed,
        qualityRequired: stageForm.qualityRequired,
      })
      notify.success('Stage group added.')
      setStageDrawerOpen(false)
      await loadVersionDetail(selectedVersionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to add stage group')
    } finally {
      setSaving(false)
    }
  }

  const openAddOperation = (stageGroupId?: string) => {
    setOpForm({ ...EMPTY_OPERATION_FORM, stageGroupId: stageGroupId ?? stageGroups[0]?.id ?? '' })
    setOpDrawerOpen(true)
  }

  const saveOperation = async () => {
    if (!selectedVersionId) return
    setSaving(true)
    try {
      await createOperation(selectedVersionId, {
        stageGroupId: opForm.stageGroupId,
        code: opForm.code.trim(),
        name: opForm.name.trim(),
        sequence: Number(opForm.sequence) || 1,
        workCentreId: opForm.workCentreId || undefined,
        defaultMachineId: opForm.defaultMachineId || undefined,
        setupTimeMinutes: Number(opForm.setupTimeMinutes) || 0,
        runTimeValue: Number(opForm.runTimeValue) || 0,
        runTimeBasis: opForm.runTimeBasis,
        inputType: opForm.inputType,
        outputType: opForm.outputType,
        qualityRequired: opForm.qualityRequired,
      })
      notify.success('Operation added.')
      setOpDrawerOpen(false)
      await loadVersionDetail(selectedVersionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to add operation')
    } finally {
      setSaving(false)
    }
  }

  const openAddDependency = () => {
    setDepForm({
      ...EMPTY_DEPENDENCY_FORM,
      predecessorOperationId: operations[0]?.id ?? '',
      successorOperationId: operations[1]?.id ?? '',
    })
    setDepError(null)
    setDepDrawerOpen(true)
  }

  const saveDependency = async () => {
    if (!selectedVersionId) return
    setSaving(true)
    setDepError(null)
    try {
      await createDependency(selectedVersionId, {
        predecessorOperationId: depForm.predecessorOperationId,
        successorOperationId: depForm.successorOperationId,
        dependencyType: depForm.dependencyType,
        minimumCompletionPercent: Number(depForm.minimumCompletionPercent) || 100,
        isMandatory: depForm.isMandatory,
        allowParallel: depForm.allowParallel,
      })
      notify.success('Dependency added.')
      setDepDrawerOpen(false)
      await loadVersionDetail(selectedVersionId)
    } catch (e) {
      // Cycle / self-dependency errors surface here from the backend cycle check.
      setDepError(e instanceof Error ? e.message : 'Failed to add dependency')
    } finally {
      setSaving(false)
    }
  }

  const runValidate = async () => {
    if (!selectedVersionId) return
    setValidating(true)
    try {
      const res = await validateRoutingVersion(selectedVersionId)
      setValidation(res.data)
      if (res.data.valid) notify.success('Routing version is valid.')
      else notify.warning(`${res.data.errors.length} validation issue(s) found.`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const runActivate = async () => {
    if (!selectedVersionId) return
    const ok = await appConfirm({
      title: 'Activate routing version',
      description: 'Activate this routing version? It will supersede any prior active version.',
      confirmLabel: 'Activate',
    })
    if (!ok) return
    setBusy(true)
    try {
      await activateRoutingVersion(selectedVersionId)
      notify.success('Routing version activated.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  const runRevise = async () => {
    if (!selectedVersionId) return
    setBusy(true)
    try {
      const res = await reviseRoutingVersion(selectedVersionId)
      notify.success('New draft revision created.')
      navigate(`/manufacturing/setup/routing-versions/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Revision failed')
    } finally {
      setBusy(false)
    }
  }

  const openCompare = () => {
    setCompareFrom(versions.filter((v) => v.id !== selectedVersionId)[0]?.id ?? '')
    setCompareTo(selectedVersionId)
    setCompareResult(null)
    setCompareOpen(true)
  }

  const runCompare = async () => {
    if (!compareFrom || !compareTo) return
    setComparing(true)
    try {
      const res = await compareRoutingVersions(compareFrom, compareFrom, compareTo)
      setCompareResult(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setComparing(false)
    }
  }

  const runDeleteStage = async (stageId: string, opCount: number) => {
    const ok = await appConfirm({
      title: 'Remove stage group',
      description:
        opCount > 0
          ? 'Remove this stage group? Operations in the stage must be removed first.'
          : 'Remove this stage group from the draft?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingId(stageId)
    try {
      await deleteStageGroup(stageId)
      notify.success('Stage group removed.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  const runDeleteOperation = async (operationId: string) => {
    const ok = await appConfirm({
      title: 'Remove operation',
      description: 'Remove this operation from the draft?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingId(operationId)
    try {
      await deleteOperation(operationId)
      notify.success('Operation removed.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  const runDeleteDependency = async (dependencyId: string) => {
    const ok = await appConfirm({
      title: 'Remove dependency',
      description: 'Remove this dependency from the draft?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingId(dependencyId)
    try {
      await deleteDependency(dependencyId)
      notify.success('Dependency removed.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  if (!apiMode) {
    return <ManufacturingSetupShell title="Routing Editor">{null}</ManufacturingSetupShell>
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title="Routing Editor">
        <LoadingState variant="form" rows={8} />
      </ManufacturingSetupShell>
    )
  }

  if (!routing || !version) {
    return (
      <ManufacturingSetupShell title="Routing Editor">
        <EmptyState icon={GitBranch} title="Routing not found" description="This routing or version could not be loaded." />
      </ManufacturingSetupShell>
    )
  }

  return (
    <ManufacturingSetupShell
      title={`${routing.code} — ${routing.name}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <ErpButton size="sm" variant="outline" loading={validating} onClick={() => void runValidate()}>
            Validate
          </ErpButton>
          <ErpButton size="sm" variant="outline" onClick={openCompare} disabled={versions.length < 2}>
            Compare
          </ErpButton>
          {isDraft && perms.canActivateRouting ? (
            <ErpButton size="sm" loading={busy} onClick={() => void runActivate()}>
              Activate
            </ErpButton>
          ) : null}
          {!isDraft && perms.canManageRouting ? (
            <ErpButton size="sm" loading={busy} onClick={() => void runRevise()}>
              Create Revision
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-medium text-erp-muted">
          Version
          <Select value={selectedVersionId} onChange={(e) => void switchVersion(e.target.value)} className="mt-0.5 block w-40">
            {[...versions]
              .sort((a, b) => b.versionNumber - a.versionNumber)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  Rev {v.revisionCode} (v{v.versionNumber})
                </option>
              ))}
          </Select>
        </label>
        <StatusDot label={version.status} tone={statusToneFromLabel(version.status)} />
        {canManage ? (
          <>
            <ErpButton size="sm" variant="outline" onClick={openAddStage}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Stage
            </ErpButton>
            <ErpButton size="sm" variant="outline" onClick={() => openAddOperation()} disabled={stageGroups.length === 0}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Operation
            </ErpButton>
            <ErpButton size="sm" variant="outline" onClick={openAddDependency} disabled={operations.length < 2}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Dependency
            </ErpButton>
          </>
        ) : null}
      </div>

      {!isDraft ? (
        <div className="mb-3 rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-muted">
          This version is <strong>{version.status}</strong> and read-only. Use “Create Revision” to make a new
          editable draft.
        </div>
      ) : null}

      {validation ? (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-[12px] ${
            validation.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {validation.valid ? (
            <span>
              Valid — {validation.stageGroupCount ?? stageGroups.length} stage(s), {validation.operationCount ?? operations.length} operation(s).
            </span>
          ) : (
            <>
              <p className="font-semibold">{validation.errors.length} issue(s):</p>
              <ul className="ml-4 list-disc">
                {validation.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {stageGroups.length === 0 ? (
        <EmptyState icon={GitBranch} title="No stage groups yet" description="Add the first stage group to this routing version." />
      ) : (
        <div className="space-y-3">
          {[...stageGroups]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((sg) => (
              <div key={sg.id} className="rounded-md border border-erp-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10.5px] text-erp-muted">#{sg.displayOrder}</span>{' '}
                    <span className="text-[13px] font-semibold text-erp-text">{sg.name}</span>
                    <span className="ml-2 text-[11px] text-erp-muted">
                      {sg.completionRule.replace(/_/g, ' ').toLowerCase()}
                      {sg.defaultWorkCentreId ? ` · ${workCentreLabel(sg.defaultWorkCentreId)}` : ''}
                    </span>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <ErpButton size="sm" variant="outline" onClick={() => openAddOperation(sg.id)}>
                        <Plus className="mr-1 h-3 w-3" />
                        Operation
                      </ErpButton>
                      <ErpButton
                        size="sm"
                        variant="outline"
                        loading={removingId === sg.id}
                        onClick={() => void runDeleteStage(sg.id, (operationsByStage.get(sg.id) ?? []).length)}
                      >
                        Remove
                      </ErpButton>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {(operationsByStage.get(sg.id) ?? []).map((op) => (
                    <div key={op.id} className="flex items-center justify-between rounded border border-erp-border/60 bg-erp-surface-alt/40 px-2 py-1 text-[12px]">
                      <span>
                        <span className="font-mono text-[10.5px] text-erp-muted">#{op.sequence}</span>{' '}
                        <span className="font-medium">{op.code} — {op.name}</span>
                        <span className="ml-2 text-erp-muted">
                          {workCentreLabel(op.workCentreId)}
                          {op.defaultMachineId ? ` / ${machineLabel(op.defaultMachineId)}` : ''} · setup {op.setupTimeMinutes}m + run{' '}
                          {op.runTimeValue} ({op.runTimeBasis.replace(/_/g, ' ').toLowerCase()})
                        </span>
                      </span>
                      {canManage ? (
                        <button
                          type="button"
                          disabled={removingId === op.id}
                          onClick={() => void runDeleteOperation(op.id)}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {(operationsByStage.get(sg.id) ?? []).length === 0 ? (
                    <p className="text-[11px] text-erp-muted">No operations in this stage yet.</p>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      )}

      {dependencies.length > 0 ? (
        <div className="mt-4 rounded-md border border-erp-border bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Dependencies</p>
          <ul className="space-y-1 text-[12px]">
            {dependencies.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>
                  {operationLabel(d.predecessorOperationId)} → {operationLabel(d.successorOperationId)}{' '}
                  <span className="text-erp-muted">({d.dependencyType.replace(/_/g, ' ').toLowerCase()})</span>
                </span>
                {canManage ? (
                  <button
                    type="button"
                    disabled={removingId === d.id}
                    onClick={() => void runDeleteDependency(d.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AccountDrawerShell
        open={stageDrawerOpen}
        onClose={() => setStageDrawerOpen(false)}
        title="Add Stage Group"
        eyebrow="Routing Draft"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setStageDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton loading={saving} disabled={!stageForm.code.trim() || !stageForm.name.trim()} onClick={() => void saveStage()}>
              Add
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input value={stageForm.code} onChange={(e) => setStageForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Name" required>
            <Input value={stageForm.name} onChange={(e) => setStageForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Display Order">
            <Input type="number" min={0} value={stageForm.displayOrder} onChange={(e) => setStageForm((f) => ({ ...f, displayOrder: e.target.value }))} />
          </FormField>
          <FormField label="Default Work Centre">
            <Select value={stageForm.defaultWorkCentreId} onChange={(e) => setStageForm((f) => ({ ...f, defaultWorkCentreId: e.target.value }))}>
              <option value="">Not set</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.code} — {wc.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Completion Rule">
            <Select value={stageForm.completionRule} onChange={(e) => setStageForm((f) => ({ ...f, completionRule: e.target.value as StageCompletionRule }))}>
              {STAGE_COMPLETION_RULE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <Switch checked={stageForm.isOptional} onChange={(v) => setStageForm((f) => ({ ...f, isOptional: v }))} label="Optional stage" />
          <Switch checked={stageForm.parallelAllowed} onChange={(v) => setStageForm((f) => ({ ...f, parallelAllowed: v }))} label="Parallel allowed" />
          <Switch checked={stageForm.qualityRequired} onChange={(v) => setStageForm((f) => ({ ...f, qualityRequired: v }))} label="Quality required" />
        </div>
      </AccountDrawerShell>

      <AccountDrawerShell
        open={opDrawerOpen}
        onClose={() => setOpDrawerOpen(false)}
        title="Add Operation"
        eyebrow="Routing Draft"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setOpDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              loading={saving}
              disabled={!opForm.code.trim() || !opForm.name.trim() || !opForm.stageGroupId}
              onClick={() => void saveOperation()}
            >
              Add
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Stage Group" required>
            <Select value={opForm.stageGroupId} onChange={(e) => setOpForm((f) => ({ ...f, stageGroupId: e.target.value }))}>
              <option value="">Select stage…</option>
              {stageGroups.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.code} — {sg.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Code" required>
            <Input value={opForm.code} onChange={(e) => setOpForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Name" required>
            <Input value={opForm.name} onChange={(e) => setOpForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Sequence">
            <Input type="number" min={1} value={opForm.sequence} onChange={(e) => setOpForm((f) => ({ ...f, sequence: e.target.value }))} />
          </FormField>
          <FormField label="Work Centre">
            <Select value={opForm.workCentreId} onChange={(e) => setOpForm((f) => ({ ...f, workCentreId: e.target.value, defaultMachineId: '' }))}>
              <option value="">Not set</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.code} — {wc.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Default Machine" hint="Must belong to the selected work centre.">
            <Select value={opForm.defaultMachineId} onChange={(e) => setOpForm((f) => ({ ...f, defaultMachineId: e.target.value }))}>
              <option value="">Not set</option>
              {machines
                .filter((m) => !opForm.workCentreId || m.workCentreId === opForm.workCentreId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Setup Time (minutes)">
            <Input type="number" min={0} value={opForm.setupTimeMinutes} onChange={(e) => setOpForm((f) => ({ ...f, setupTimeMinutes: e.target.value }))} />
          </FormField>
          <FormField label="Run Time">
            <Input type="number" min={0} value={opForm.runTimeValue} onChange={(e) => setOpForm((f) => ({ ...f, runTimeValue: e.target.value }))} />
          </FormField>
          <FormField label="Run Time Basis">
            <Select value={opForm.runTimeBasis} onChange={(e) => setOpForm((f) => ({ ...f, runTimeBasis: e.target.value as RunTimeBasis }))}>
              {RUN_TIME_BASIS_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Input Type">
            <Select value={opForm.inputType} onChange={(e) => setOpForm((f) => ({ ...f, inputType: e.target.value as IoType }))}>
              {IO_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Output Type">
            <Select value={opForm.outputType} onChange={(e) => setOpForm((f) => ({ ...f, outputType: e.target.value as IoType }))}>
              {IO_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <Switch checked={opForm.qualityRequired} onChange={(v) => setOpForm((f) => ({ ...f, qualityRequired: v }))} label="Quality required" />
        </div>
      </AccountDrawerShell>

      <AccountDrawerShell
        open={depDrawerOpen}
        onClose={() => setDepDrawerOpen(false)}
        title="Add Dependency"
        eyebrow="Routing Draft"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDepDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              loading={saving}
              disabled={!depForm.predecessorOperationId || !depForm.successorOperationId || depForm.predecessorOperationId === depForm.successorOperationId}
              onClick={() => void saveDependency()}
            >
              Add
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          {depError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{depError}</div>
          ) : null}
          <FormField label="Predecessor" required>
            <Select value={depForm.predecessorOperationId} onChange={(e) => setDepForm((f) => ({ ...f, predecessorOperationId: e.target.value }))}>
              {operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.code} — {op.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Successor" required>
            <Select value={depForm.successorOperationId} onChange={(e) => setDepForm((f) => ({ ...f, successorOperationId: e.target.value }))}>
              {operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.code} — {op.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Dependency Type">
            <Select value={depForm.dependencyType} onChange={(e) => setDepForm((f) => ({ ...f, dependencyType: e.target.value as DependencyType }))}>
              {DEPENDENCY_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Minimum Completion %">
            <Input
              type="number"
              min={0}
              max={100}
              value={depForm.minimumCompletionPercent}
              onChange={(e) => setDepForm((f) => ({ ...f, minimumCompletionPercent: e.target.value }))}
            />
          </FormField>
          <Switch checked={depForm.isMandatory} onChange={(v) => setDepForm((f) => ({ ...f, isMandatory: v }))} label="Mandatory" />
          <Switch checked={depForm.allowParallel} onChange={(v) => setDepForm((f) => ({ ...f, allowParallel: v }))} label="Allow parallel" />
        </div>
      </AccountDrawerShell>

      <AccountConfirmModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare Routing Versions"
        confirmLabel="Close"
        onConfirm={() => setCompareOpen(false)}
      >
        <div className="mt-3 space-y-3 text-left">
          <div className="flex gap-2">
            <FormField label="From" className="flex-1">
              <Select value={compareFrom} onChange={(e) => setCompareFrom(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Rev {v.revisionCode} (v{v.versionNumber})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="To" className="flex-1">
              <Select value={compareTo} onChange={(e) => setCompareTo(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Rev {v.revisionCode} (v{v.versionNumber})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <ErpButton size="sm" loading={comparing} onClick={() => void runCompare()}>
            Compare
          </ErpButton>
          {compareResult ? (
            <div className="space-y-2 text-[12.5px]">
              <p>
                <strong>{compareResult.addedOperations.length}</strong> added,{' '}
                <strong>{compareResult.removedOperations.length}</strong> removed,{' '}
                <strong>{compareResult.changedOperations.length}</strong> changed.
              </p>
              {(compareResult.summaries?.length ?? 0) > 0 ? (
                <ul className="ml-4 list-disc space-y-1">
                  {compareResult.summaries!.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <>
                  {compareResult.addedOperations.length > 0 ? (
                    <div>
                      <p className="font-semibold text-emerald-700">Added</p>
                      <ul className="ml-4 list-disc">
                        {compareResult.addedOperations.map((code) => (
                          <li key={`add-${code}`}>{code}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {compareResult.removedOperations.length > 0 ? (
                    <div>
                      <p className="font-semibold text-red-700">Removed</p>
                      <ul className="ml-4 list-disc">
                        {compareResult.removedOperations.map((code) => (
                          <li key={`rem-${code}`}>{code}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {compareResult.changedOperations.length > 0 ? (
                    <div>
                      <p className="font-semibold text-amber-700">Changed</p>
                      <ul className="ml-4 list-disc">
                        {compareResult.changedOperations.map((code) => (
                          <li key={`chg-${code}`}>{code}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </AccountConfirmModal>
    </ManufacturingSetupShell>
  )
}
