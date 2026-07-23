import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, GitBranch, Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { Input, Select, Switch } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell, AccountConfirmModal } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  certifyRoutingVersion,
  closeRoutingVersion,
  compareRoutingVersions,
  createDependency,
  createOperation,
  createStageGroup,
  deleteDependency,
  deleteOperation,
  deleteStageGroup,
  generateRoutingStagesFromBom,
  getRouting,
  getRoutingBomContext,
  getRoutingVersion,
  getRoutingWhereUsed,
  listMachines,
  listWorkCentres,
  reviseRoutingVersion,
  updateRouting,
  validateRoutingVersion,
  type RoutingBomContext,
  type RoutingWhereUsed,
} from '@/services/api/manufacturingApi'
import { listInspectionPlans, type QualityInspectionPlan } from '@/services/api/qualityApi'
import {
  DEPENDENCY_TYPE_VALUES,
  MANUFACTURING_TIME_UNIT_LABELS,
  MANUFACTURING_TIME_UNIT_VALUES,
  ROUTING_FLOW_TYPE_LABELS,
  ROUTING_FLOW_TYPE_VALUES,
  STAGE_COMPLETION_RULE_VALUES,
  routingLifecycleLabel,
  type Dependency,
  type DependencyType,
  type Machine,
  type ManufacturingTimeUnit,
  type ManufacturingVersionStatus,
  type Operation,
  type Routing,
  type RoutingCompareResult,
  type RoutingFlowType,
  type RoutingVersion,
  type StageCompletionRule,
  type StageGroup,
  type ValidationResult,
  type WorkCentre,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
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
  name: string
  sequence: string
  workCentreId: string
  defaultMachineId: string
  setupTimeValue: string
  setupTimeUnit: ManufacturingTimeUnit
  runTimeValue: string
  runTimeUnit: ManufacturingTimeUnit
  qualityRequired: boolean
  qcTestGroupId: string
}

const EMPTY_OPERATION_FORM: OperationFormState = {
  name: '',
  sequence: '10',
  workCentreId: '',
  defaultMachineId: '',
  setupTimeValue: '0',
  setupTimeUnit: 'MINUTE',
  runTimeValue: '0',
  runTimeUnit: 'MINUTE',
  qualityRequired: false,
  qcTestGroupId: '',
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

const VERSION_STATUS_TONE: Record<ManufacturingVersionStatus, ErpStatusChipTone> = {
  DRAFT: 'pending',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUPERSEDED: 'neutral',
  ARCHIVED: 'neutral',
}

type BomRefNode = RoutingBomContext['tree'][number]

function BomReferenceTree({ nodes, depth }: { nodes: BomRefNode[]; depth: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'mt-0.5 space-y-0.5 border-l border-erp-border/70 pl-2'}>
      {nodes.map((node) => {
        const isStageCandidate =
          (node.lineType === 'SUBASSEMBLY' || node.lineType === 'MANUFACTURED_COMPONENT') &&
          node.makeOrBuy === 'MAKE' &&
          !node.phantomAssembly
        const label = node.descriptionOverride?.trim() || node.item?.name || node.itemId.slice(0, 8)
        const code = node.item?.code ?? '—'
        return (
          <li key={node.id}>
            <div
              className={`rounded px-1.5 py-1 text-[11px] ${
                isStageCandidate
                  ? 'bg-sky-50 font-medium text-sky-950'
                  : node.phantomAssembly || node.makeOrBuy === 'BUY'
                    ? 'text-erp-muted'
                    : 'text-erp-text'
              }`}
            >
              <span className="font-mono text-[10px] text-erp-muted">{code}</span>{' '}
              <span>{label}</span>
              <span className="ml-1 text-[10px] text-erp-muted">
                {node.lineType.replace(/_/g, ' ').toLowerCase()}
                {node.phantomAssembly ? ' · phantom' : ''}
                {node.makeOrBuy === 'BUY' ? ' · buy' : ''}
              </span>
            </div>
            {node.children?.length ? <BomReferenceTree nodes={node.children} depth={depth + 1} /> : null}
          </li>
        )
      })}
    </ul>
  )
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
  const [qcPlans, setQcPlans] = useState<QualityInspectionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [productionFlowType, setProductionFlowType] = useState<RoutingFlowType>('SERIAL')
  const [savingFlowType, setSavingFlowType] = useState(false)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false)
  const [stageForm, setStageForm] = useState<StageFormState>(EMPTY_STAGE_FORM)
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
  const [bomContext, setBomContext] = useState<RoutingBomContext | null>(null)
  const [generatingFromBom, setGeneratingFromBom] = useState(false)
  const [whereUsed, setWhereUsed] = useState<RoutingWhereUsed | null>(null)
  const [loadingWhereUsed, setLoadingWhereUsed] = useState(false)

  const workCentreLabel = useCallback(
    (id: string | null) => (id ? workCentres.find((w) => w.id === id)?.name ?? id.slice(0, 8) : '—'),
    [workCentres],
  )
  const machineLabel = useCallback(
    (id: string | null) => (id ? machines.find((m) => m.id === id)?.name ?? id.slice(0, 8) : '—'),
    [machines],
  )
  const qcPlanLabel = useCallback(
    (id: string | null | undefined) => {
      if (!id) return null
      const plan = qcPlans.find((p) => p.id === id)
      return plan ? `${plan.planCode} — ${plan.planName}` : id.slice(0, 8)
    },
    [qcPlans],
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
    try {
      const bomRes = await getRoutingBomContext(versionId)
      setBomContext(bomRes.data)
    } catch {
      setBomContext(null)
    }
  }, [])

  const loadWhereUsed = useCallback(async (versionId: string) => {
    setLoadingWhereUsed(true)
    try {
      const res = await getRoutingWhereUsed(versionId)
      setWhereUsed(res.data)
    } catch {
      setWhereUsed(null)
    } finally {
      setLoadingWhereUsed(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [wcRes, machineRes, qcRes] = await Promise.all([
        listWorkCentres({ limit: 100 }),
        listMachines({ limit: 100 }),
        listInspectionPlans({ limit: 100, status: 'ACTIVE' }).catch(() => ({ data: [] as QualityInspectionPlan[] })),
      ])
      setWorkCentres(wcRes.data)
      setMachines(machineRes.data)
      setQcPlans(qcRes.data)

      let resolvedRoutingId = routingIdParam
      let resolvedVersionId = versionIdParam

      if (resolvedVersionId && !resolvedRoutingId) {
        const versionRes = await getRoutingVersion(resolvedVersionId)
        resolvedRoutingId = versionRes.data.routingId
      }
      if (!resolvedRoutingId) return

      const routingRes = await getRouting(resolvedRoutingId)
      setRouting(routingRes.data)
      setProductionFlowType(routingRes.data.productionFlowType ?? 'SERIAL')
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
    setWhereUsed(null)
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
  const isCertified = version?.status === 'ACTIVE'
  const isArchived = version?.status === 'ARCHIVED'
  const canManage = isDraft && perms.canManageRouting
  const lifecycleDisplay = version
    ? routingLifecycleLabel(version.status, version.lifecycleLabel)
    : ''

  const sortedOperations = useMemo(
    () => [...operations].sort((a, b) => a.sequence - b.sequence),
    [operations],
  )

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

  useEffect(() => {
    if (isCertified && selectedVersionId) {
      void loadWhereUsed(selectedVersionId)
    } else {
      setWhereUsed(null)
    }
  }, [isCertified, selectedVersionId, loadWhereUsed])

  const saveProductionFlowType = async (next: RoutingFlowType) => {
    if (!routing || !isDraft) return
    setProductionFlowType(next)
    setSavingFlowType(true)
    try {
      const res = await updateRouting(routing.id, { productionFlowType: next })
      setRouting(res.data)
      notify.success('Production type updated.')
    } catch (e) {
      setProductionFlowType(routing.productionFlowType ?? 'SERIAL')
      notify.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingFlowType(false)
    }
  }

  const nextOperationSequence = useMemo(() => {
    const maxSeq = operations.reduce((max, op) => Math.max(max, op.sequence), 0)
    return maxSeq > 0 ? maxSeq + 10 : 10
  }, [operations])

  useEffect(() => {
    if (!canManage) return
    setOpForm((f) => {
      if (f.name.trim() || f.workCentreId || f.qualityRequired) return f
      if (f.sequence === String(nextOperationSequence)) return f
      return { ...f, sequence: String(nextOperationSequence) }
    })
  }, [canManage, nextOperationSequence])

  const canSaveOperation =
    Boolean(opForm.name.trim()) &&
    Boolean(opForm.workCentreId) &&
    (!opForm.qualityRequired || Boolean(opForm.qcTestGroupId.trim()))

  const saveOperation = async () => {
    if (!selectedVersionId || !canSaveOperation) return
    const sequence = Number(opForm.sequence) || nextOperationSequence
    setSaving(true)
    try {
      await createOperation(selectedVersionId, {
        code: `OP-${sequence}`,
        name: opForm.name.trim(),
        sequence,
        workCentreId: opForm.workCentreId,
        defaultMachineId: opForm.defaultMachineId || undefined,
        setupTimeValue: Number(opForm.setupTimeValue) || 0,
        setupTimeUnit: opForm.setupTimeUnit,
        runTimeValue: Number(opForm.runTimeValue) || 0,
        runTimeUnit: opForm.runTimeUnit,
        qualityRequired: opForm.qualityRequired,
        qcTestGroupId: opForm.qualityRequired ? opForm.qcTestGroupId.trim() || undefined : undefined,
      })
      notify.success('Operation added.')
      setOpForm({
        ...EMPTY_OPERATION_FORM,
        sequence: String(sequence + 10),
      })
      await loadVersionDetail(selectedVersionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to add operation')
    } finally {
      setSaving(false)
    }
  }

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
      if (res.data.valid) notify.success('Route version is valid.')
      else {
        const warningCount = res.data.warnings?.length ?? 0
        notify.warning(
          `${res.data.errors.length} validation issue(s)${warningCount ? `, ${warningCount} warning(s)` : ''}.`,
        )
      }
      return res.data
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
      return null
    } finally {
      setValidating(false)
    }
  }

  const runCertify = async () => {
    if (!selectedVersionId) return
    let currentValidation = validation
    if (!currentValidation?.valid) {
      currentValidation = (await runValidate()) ?? null
      if (!currentValidation?.valid) return
    }
    const ok = await appConfirm({
      title: 'Certify route',
      description: `Certify version ${version?.revisionCode ?? ''} (v${version?.versionNumber ?? ''}) with ${currentValidation.operationCount ?? operations.length} operation(s)? This will supersede any prior certified version.`,
      confirmLabel: 'Certify Route',
    })
    if (!ok) return
    setBusy(true)
    try {
      await certifyRoutingVersion(selectedVersionId)
      notify.success('Route version certified.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Certification failed')
    } finally {
      setBusy(false)
    }
  }

  const runRevise = async () => {
    if (!selectedVersionId) return
    const revisionNotes = await appPromptNote({
      title: 'Create new version',
      description: 'Enter revision notes for the new draft version.',
      confirmLabel: 'Create Version',
      note: {
        label: 'Revision notes',
        placeholder: 'Describe what changed…',
        required: true,
      },
    })
    if (!revisionNotes?.trim()) return
    setBusy(true)
    try {
      const res = await reviseRoutingVersion(selectedVersionId, { revisionNotes: revisionNotes.trim() })
      notify.success('New draft version created.')
      navigate(`/manufacturing/setup/routing-versions/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Revision failed')
    } finally {
      setBusy(false)
    }
  }

  const runClose = async () => {
    if (!selectedVersionId) return
    const reason = await appPromptNote({
      title: 'Close route version',
      description: 'Provide a reason for closing this certified version.',
      confirmLabel: 'Close Version',
      tone: 'danger',
      note: {
        label: 'Reason',
        placeholder: 'Why is this version being closed?',
        required: true,
      },
    })
    if (!reason?.trim()) return
    setBusy(true)
    try {
      await closeRoutingVersion(selectedVersionId, { reason: reason.trim() })
      notify.success('Route version closed.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Close failed')
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

  const runGenerateFromBom = async () => {
    if (!selectedVersionId) return
    const replaceExisting = stageGroups.length > 0
    const ok = await appConfirm({
      title: 'Generate stages from BOM',
      description: replaceExisting
        ? 'This will remove existing stage groups (and their operations/dependencies) on this draft, then recreate stages from BOM MAKE sub-assemblies. Continue?'
        : 'Create stage groups from BOM MAKE sub-assemblies / manufactured components, plus a final assembly stage. You can edit work centres and operations after.',
      confirmLabel: replaceExisting ? 'Replace & generate' : 'Generate',
      tone: replaceExisting ? 'danger' : 'default',
    })
    if (!ok) return
    setGeneratingFromBom(true)
    try {
      const res = await generateRoutingStagesFromBom(selectedVersionId, replaceExisting)
      notify.success(`Generated ${res.data.stageGroups.length} stage(s) from BOM.`)
      await loadVersionDetail(selectedVersionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGeneratingFromBom(false)
    }
  }

  if (!apiMode) {
    return <ManufacturingSetupShell title="Route Editor">{null}</ManufacturingSetupShell>
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title="Route Editor">
        <LoadingState variant="form" rows={8} />
      </ManufacturingSetupShell>
    )
  }

  if (!routing || !version) {
    return (
      <ManufacturingSetupShell title="Route Editor">
        <EmptyState icon={GitBranch} title="Route not found" description="This route or version could not be loaded." />
      </ManufacturingSetupShell>
    )
  }

  const headerActions = isArchived ? (
    <div className="flex flex-wrap gap-2">
      <ErpButton size="sm" variant="outline" onClick={openCompare} disabled={versions.length < 2}>
        Compare
      </ErpButton>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {isDraft && perms.canValidateRouting ? (
        <ErpButton size="sm" variant="outline" loading={validating} onClick={() => void runValidate()}>
          Validate
        </ErpButton>
      ) : null}
      {isDraft && perms.canCertifyRouting ? (
        <ErpButton size="sm" loading={busy} onClick={() => void runCertify()}>
          Certify Route
        </ErpButton>
      ) : null}
      {isCertified && perms.canVersionRouting ? (
        <ErpButton size="sm" loading={busy} onClick={() => void runRevise()}>
          Create New Version
        </ErpButton>
      ) : null}
      {(isCertified || versions.length >= 2) ? (
        <ErpButton size="sm" variant="outline" onClick={openCompare} disabled={versions.length < 2}>
          Compare
        </ErpButton>
      ) : null}
      {isCertified && perms.canCloseRouting ? (
        <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void runClose()}>
          Close
        </ErpButton>
      ) : null}
    </div>
  )

  return (
    <ManufacturingSetupShell title={`${routing.code} — ${routing.name}`} actions={headerActions}>
      <div className="mb-4 rounded-lg border border-erp-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-erp-muted">{routing.code}</span>
              <ErpStatusChip
                label={lifecycleDisplay}
                tone={VERSION_STATUS_TONE[version.status]}
              />
            </div>
            <h2 className="text-[15px] font-semibold text-erp-text">{routing.name}</h2>
            <p className="text-[12px] text-erp-muted">
              Version {version.versionNumber} · Rev {version.revisionCode}
            </p>
          </div>
          <label className="text-[11px] font-medium text-erp-muted">
            Switch version
            <Select value={selectedVersionId} onChange={(e) => void switchVersion(e.target.value)} className="mt-0.5 block w-44">
              {[...versions]
                .sort((a, b) => b.versionNumber - a.versionNumber)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    Rev {v.revisionCode} (v{v.versionNumber}) — {routingLifecycleLabel(v.status, v.lifecycleLabel)}
                  </option>
                ))}
            </Select>
          </label>
        </div>
        <div className="mt-3 max-w-xs">
          <FormField label="Production Type">
            {isDraft && perms.canManageRouting ? (
              <Select
                value={productionFlowType}
                disabled={savingFlowType}
                onChange={(e) => void saveProductionFlowType(e.target.value as RoutingFlowType)}
              >
                {ROUTING_FLOW_TYPE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {ROUTING_FLOW_TYPE_LABELS[v]}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={ROUTING_FLOW_TYPE_LABELS[productionFlowType]} disabled />
            )}
          </FormField>
        </div>
      </div>

      {!isDraft ? (
        <div className="mb-3 rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-muted">
          This version is <strong>{lifecycleDisplay}</strong> and read-only.
          {isCertified && perms.canVersionRouting ? ' Use “Create New Version” to start a new editable draft.' : null}
        </div>
      ) : null}

      {validation ? (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-[12px] ${
            validation.valid && !(validation.warnings?.length)
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {validation.valid ? (
            <span>
              Valid — {validation.stageGroupCount ?? stageGroups.length} stage(s),{' '}
              {validation.operationCount ?? operations.length} operation(s).
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
          {(validation.warnings?.length ?? 0) > 0 ? (
            <>
              <p className="mt-2 font-semibold">{validation.warnings!.length} warning(s):</p>
              <ul className="ml-4 list-disc">
                {validation.warnings!.map((warn) => (
                  <li key={warn}>{warn}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {isCertified ? (
        <div className="mb-4 rounded-md border border-erp-border bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Where Used</p>
          {loadingWhereUsed ? (
            <p className="text-[12px] text-erp-muted">Loading…</p>
          ) : !whereUsed || whereUsed.profiles.length === 0 ? (
            <p className="text-[12px] text-erp-muted">No manufacturing profiles reference this route.</p>
          ) : (
            <ul className="space-y-1 text-[12px]">
              {whereUsed.profiles.map((profile) => (
                <li key={profile.id} className="font-mono text-[11px]">
                  {profile.code} — {profile.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Operations</p>
          <p className="text-[11px] text-erp-muted">
            Enter route steps inline. When QC is required, pick a QC group from Quality Inspection Plans.
          </p>
        </div>
        {canManage ? (
          <ErpButton size="sm" loading={saving} disabled={!canSaveOperation} onClick={() => void saveOperation()}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Operation
          </ErpButton>
        ) : null}
      </div>

      <div className="mb-4 overflow-x-auto rounded-lg border border-erp-border bg-white">
        <table className="erp-table w-full min-w-[1180px] text-left text-[12px]">
          <thead>
            <tr>
              <th className="w-20">Op No</th>
              <th className="min-w-[160px]">Description</th>
              <th className="min-w-[140px]">Work Centre</th>
              <th className="min-w-[130px]">Machine</th>
              <th className="w-24">Setup</th>
              <th className="w-24">Setup unit</th>
              <th className="w-24">Run</th>
              <th className="w-24">Run unit</th>
              <th className="w-16 text-center">QC</th>
              <th className="min-w-[180px]">QC group</th>
              {canManage ? <th className="w-24 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {sortedOperations.map((op) => (
              <tr key={op.id}>
                <td className="font-mono text-[11px] tabular-nums">{op.sequence}</td>
                <td className="font-medium">{op.name}</td>
                <td>{workCentreLabel(op.workCentreId)}</td>
                <td>{machineLabel(op.defaultMachineId)}</td>
                <td className="tabular-nums">{op.setupTimeMinutes || '0'}</td>
                <td>{MANUFACTURING_TIME_UNIT_LABELS[op.setupTimeUnit ?? 'MINUTE']}</td>
                <td className="tabular-nums">{op.runTimeValue || '0'}</td>
                <td>{MANUFACTURING_TIME_UNIT_LABELS[op.runTimeUnit ?? 'MINUTE']}</td>
                <td className="text-center">{op.qualityRequired ? 'Yes' : '—'}</td>
                <td className="text-[11px]">
                  {op.qualityRequired ? qcPlanLabel(op.qcTestGroupId) ?? '—' : '—'}
                </td>
                {canManage ? (
                  <td className="text-right">
                    <button
                      type="button"
                      disabled={removingId === op.id}
                      onClick={() => void runDeleteOperation(op.id)}
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}

            {canManage ? (
              <tr className="bg-erp-surface-alt/40">
                <td className="align-top py-2">
                  <Input
                    type="number"
                    min={1}
                    value={opForm.sequence}
                    onChange={(e) => setOpForm((f) => ({ ...f, sequence: e.target.value }))}
                    className="h-8 w-[4.5rem] text-[12px]"
                    aria-label="Operation number"
                  />
                </td>
                <td className="align-top py-2">
                  <Input
                    value={opForm.name}
                    onChange={(e) => setOpForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Operation description"
                    className="h-8 min-w-[10rem] text-[12px]"
                    aria-label="Description"
                  />
                </td>
                <td className="align-top py-2">
                  <Select
                    value={opForm.workCentreId}
                    onChange={(e) => setOpForm((f) => ({ ...f, workCentreId: e.target.value, defaultMachineId: '' }))}
                    className="h-8 min-w-[9rem] text-[12px]"
                    aria-label="Work centre"
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {workCentres.map((wc) => (
                      <option key={wc.id} value={wc.id}>
                        {wc.code} — {wc.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="align-top py-2">
                  <Select
                    value={opForm.defaultMachineId}
                    onChange={(e) => setOpForm((f) => ({ ...f, defaultMachineId: e.target.value }))}
                    className="h-8 min-w-[8rem] text-[12px]"
                    aria-label="Machine"
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {machines
                      .filter((m) => !opForm.workCentreId || m.workCentreId === opForm.workCentreId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} — {m.name}
                        </option>
                      ))}
                  </Select>
                </td>
                <td className="align-top py-2">
                  <Input
                    type="number"
                    min={0}
                    value={opForm.setupTimeValue}
                    onChange={(e) => setOpForm((f) => ({ ...f, setupTimeValue: e.target.value }))}
                    className="h-8 w-[4.5rem] text-[12px]"
                    aria-label="Setup time"
                  />
                </td>
                <td className="align-top py-2">
                  <Select
                    value={opForm.setupTimeUnit}
                    onChange={(e) => setOpForm((f) => ({ ...f, setupTimeUnit: e.target.value as ManufacturingTimeUnit }))}
                    className="h-8 min-w-[5.5rem] text-[12px]"
                    aria-label="Setup unit"
                  >
                    {MANUFACTURING_TIME_UNIT_VALUES.map((u) => (
                      <option key={u} value={u}>
                        {MANUFACTURING_TIME_UNIT_LABELS[u]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="align-top py-2">
                  <Input
                    type="number"
                    min={0}
                    value={opForm.runTimeValue}
                    onChange={(e) => setOpForm((f) => ({ ...f, runTimeValue: e.target.value }))}
                    className="h-8 w-[4.5rem] text-[12px]"
                    aria-label="Run time"
                  />
                </td>
                <td className="align-top py-2">
                  <Select
                    value={opForm.runTimeUnit}
                    onChange={(e) => setOpForm((f) => ({ ...f, runTimeUnit: e.target.value as ManufacturingTimeUnit }))}
                    className="h-8 min-w-[5.5rem] text-[12px]"
                    aria-label="Run unit"
                  >
                    {MANUFACTURING_TIME_UNIT_VALUES.map((u) => (
                      <option key={u} value={u}>
                        {MANUFACTURING_TIME_UNIT_LABELS[u]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="align-top py-2 text-center">
                  <Switch
                    checked={opForm.qualityRequired}
                    onChange={(v) =>
                      setOpForm((f) => ({ ...f, qualityRequired: v, qcTestGroupId: v ? f.qcTestGroupId : '' }))
                    }
                    label="QC"
                  />
                </td>
                <td className="align-top py-2">
                  <Select
                    value={opForm.qcTestGroupId}
                    onChange={(e) => setOpForm((f) => ({ ...f, qcTestGroupId: e.target.value }))}
                    disabled={!opForm.qualityRequired}
                    className="h-8 min-w-[11rem] text-[12px]"
                    aria-label="QC group"
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {qcPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.planCode} — {plan.planName}
                      </option>
                    ))}
                  </Select>
                  {opForm.qualityRequired && qcPlans.length === 0 ? (
                    <p className="mt-1 text-[10px] text-amber-700">No active QC plans — create one under Quality.</p>
                  ) : null}
                </td>
                <td className="align-top py-2 text-right">
                  <ErpButton size="sm" loading={saving} disabled={!canSaveOperation} onClick={() => void saveOperation()}>
                    Add
                  </ErpButton>
                </td>
              </tr>
            ) : null}

            {!canManage && sortedOperations.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[12px] text-erp-muted">
                  No operations on this revision.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <details
        className="rounded-lg border border-erp-border bg-white"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[12px] font-semibold text-erp-text">
          <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced: stages &amp; dependencies
        </summary>
        <div className="border-t border-erp-border p-4">
          {canManage ? (
            <div className="mb-3 flex flex-wrap gap-2">
              <ErpButton
                size="sm"
                variant="outline"
                loading={generatingFromBom}
                onClick={() => void runGenerateFromBom()}
                disabled={!bomContext?.bomVersion}
              >
                Generate stages from BOM
              </ErpButton>
              <ErpButton size="sm" variant="outline" onClick={openAddStage}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Stage
              </ErpButton>
              <ErpButton size="sm" variant="outline" onClick={openAddDependency} disabled={operations.length < 2}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Dependency
              </ErpButton>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div className="min-w-0">
              {stageGroups.length === 0 ? (
                <p className="text-[12px] text-erp-muted">No stage groups. Operations use the default MAIN stage.</p>
              ) : (
                <div className="space-y-3">
                  {[...stageGroups]
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((sg) => (
                      <div key={sg.id} className="rounded-md border border-erp-border bg-erp-surface-alt/30 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10.5px] text-erp-muted">#{sg.displayOrder}</span>{' '}
                            <span className="text-[13px] font-semibold text-erp-text">{sg.name}</span>
                            {sg.sourceBomLineId ? (
                              <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                                From BOM
                              </span>
                            ) : null}
                          </div>
                          {canManage ? (
                            <ErpButton
                              size="sm"
                              variant="outline"
                              loading={removingId === sg.id}
                              onClick={() => void runDeleteStage(sg.id, (operationsByStage.get(sg.id) ?? []).length)}
                            >
                              Remove
                            </ErpButton>
                          ) : null}
                        </div>
                        <div className="space-y-1 text-[12px] text-erp-muted">
                          {(operationsByStage.get(sg.id) ?? []).map((op) => (
                            <div key={op.id}>#{op.sequence} {op.code} — {op.name}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {dependencies.length > 0 ? (
                <div className="mt-4 rounded-md border border-erp-border bg-erp-surface-alt/30 p-3">
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
            </div>

            <aside className="rounded-md border border-erp-border bg-erp-surface-alt/20 p-3 lg:sticky lg:top-3 lg:self-start">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">BOM reference</p>
                  {bomContext?.bomVersion ? (
                    <p className="text-[12px] text-erp-text">
                      {bomContext.bomVersion.bomCode} · Rev {bomContext.bomVersion.revisionCode} (v
                      {bomContext.bomVersion.versionNumber})
                    </p>
                  ) : null}
                </div>
                {bomContext?.bomVersion ? (
                  <Link
                    to={`/manufacturing/setup/boms/${bomContext.bomVersion.bomId}`}
                    className="shrink-0 text-[11px] font-semibold text-erp-primary hover:underline"
                  >
                    Open BOM
                  </Link>
                ) : null}
              </div>
              {!bomContext ? (
                <p className="text-[12px] text-erp-muted">Loading BOM context…</p>
              ) : bomContext.unresolvedReason === 'NO_PRODUCT_ITEM' ? (
                <p className="text-[12px] text-erp-muted">
                  Routes are not item-linked. Use Manufacturing Profile (item → default BOM / routing) for BOM context, or add operations manually.
                </p>
              ) : bomContext.unresolvedReason === 'NO_BOM' ? (
                <p className="text-[12px] text-erp-muted">No BOM found for the linked manufacturing profile item.</p>
              ) : bomContext.unresolvedReason === 'NO_ACTIVE_BOM_VERSION' ? (
                <p className="text-[12px] text-erp-muted">No ACTIVE BOM version for the linked manufacturing profile item.</p>
              ) : bomContext.tree.length === 0 ? (
                <p className="text-[12px] text-erp-muted">BOM has no component lines yet.</p>
              ) : (
                <BomReferenceTree nodes={bomContext.tree} depth={0} />
              )}
            </aside>
          </div>
        </div>
      </details>

      <AccountDrawerShell
        open={stageDrawerOpen}
        onClose={() => setStageDrawerOpen(false)}
        title="Add Stage Group"
        eyebrow="Manufacturing Setup"
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
              <option value="">{SELECT_PLACEHOLDER}</option>
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
        open={depDrawerOpen}
        onClose={() => setDepDrawerOpen(false)}
        title="Add Dependency"
        eyebrow="Manufacturing Setup"
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
        title="Compare Route Versions"
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
