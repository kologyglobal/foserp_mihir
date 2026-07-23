import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Switch } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { FormField } from '@/components/forms/FormField'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateProfile,
  createProfile,
  deactivateProfile,
  deleteProfile,
  getProfile,
  getProfileReadiness,
  listBoms,
  listRoutings,
  getRouting,
  updateProfile,
} from '@/services/api/manufacturingApi'
import { useSetupLookup } from './useSetupLookups'
import {
  EXECUTION_MODE_VALUES,
  PLANNING_METHOD_VALUES,
  PRODUCTION_TYPE_VALUES,
  type ConsumptionMethod,
  type ExecutionMode,
  type PlanningMethod,
  type Profile,
  type ProfileReadiness,
  type ProductionType,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

interface ProfileFormState {
  code: string
  name: string
  productItemId: string
  productionType: ProductionType
  executionMode: ExecutionMode
  planningMethod: PlanningMethod
  materialConsumptionMethod: ConsumptionMethod
  wipTrackingMethod: 'LOGICAL_WIP' | 'STOCKED_SEMI_FINISHED' | 'BOTH'
  outputTrackingMethod: 'QUANTITY' | 'LOT' | 'BATCH' | 'SERIAL' | 'JOB' | 'PROJECT' | 'HEAT' | 'PIECE'
  plantCode: string
  defaultBomVersionId: string
  defaultRoutingVersionId: string
  productionWarehouseId: string
  wipWarehouseId: string
  finishedGoodsWarehouseId: string
  scrapWarehouseId: string
  overproductionTolerancePercent: string
  underproductionTolerancePercent: string
  serialTrackingRequired: boolean
  batchTrackingRequired: boolean
  jobTrackingRequired: boolean
  heatTrackingRequired: boolean
  subcontractingAllowed: boolean
  childProductionOrdersEnabled: boolean
  directProductionOrderAllowed: boolean
  partialCompletionAllowed: boolean
}

const EMPTY_FORM: ProfileFormState = {
  code: '',
  name: '',
  productItemId: '',
  productionType: 'ASSEMBLY',
  executionMode: 'SIMPLE',
  planningMethod: 'MANUAL',
  materialConsumptionMethod: 'BACKFLUSH',
  wipTrackingMethod: 'LOGICAL_WIP',
  outputTrackingMethod: 'QUANTITY',
  plantCode: '',
  defaultBomVersionId: '',
  defaultRoutingVersionId: '',
  productionWarehouseId: '',
  wipWarehouseId: '',
  finishedGoodsWarehouseId: '',
  scrapWarehouseId: '',
  overproductionTolerancePercent: '0',
  underproductionTolerancePercent: '0',
  serialTrackingRequired: false,
  batchTrackingRequired: false,
  jobTrackingRequired: false,
  heatTrackingRequired: false,
  subcontractingAllowed: false,
  childProductionOrdersEnabled: false,
  directProductionOrderAllowed: true,
  partialCompletionAllowed: true,
}

function profileToForm(row: Profile): ProfileFormState {
  return {
    code: row.code,
    name: row.name,
    productItemId: row.productItemId,
    productionType: row.productionType,
    executionMode: row.executionMode,
    planningMethod: row.planningMethod,
    materialConsumptionMethod: row.materialConsumptionMethod,
    wipTrackingMethod: row.wipTrackingMethod,
    outputTrackingMethod: row.outputTrackingMethod,
    plantCode: row.plantCode ?? '',
    defaultBomVersionId: row.defaultBomVersionId ?? '',
    defaultRoutingVersionId: row.defaultRoutingVersionId ?? '',
    productionWarehouseId: row.productionWarehouseId ?? '',
    wipWarehouseId: row.wipWarehouseId ?? '',
    finishedGoodsWarehouseId: row.finishedGoodsWarehouseId ?? '',
    scrapWarehouseId: row.scrapWarehouseId ?? '',
    overproductionTolerancePercent: String(row.overproductionTolerancePercent ?? '0'),
    underproductionTolerancePercent: String(row.underproductionTolerancePercent ?? '0'),
    serialTrackingRequired: row.serialTrackingRequired,
    batchTrackingRequired: row.batchTrackingRequired,
    jobTrackingRequired: row.jobTrackingRequired,
    heatTrackingRequired: row.heatTrackingRequired,
    subcontractingAllowed: row.subcontractingAllowed,
    childProductionOrdersEnabled: row.childProductionOrdersEnabled,
    directProductionOrderAllowed: row.directProductionOrderAllowed,
    partialCompletionAllowed: row.partialCompletionAllowed,
  }
}

function formPayload(form: ProfileFormState) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    productItemId: form.productItemId,
    productionType: form.productionType,
    executionMode: form.executionMode,
    planningMethod: form.planningMethod,
    materialConsumptionMethod: form.materialConsumptionMethod,
    wipTrackingMethod: form.wipTrackingMethod,
    outputTrackingMethod: form.outputTrackingMethod,
    plantCode: form.plantCode.trim() || undefined,
    defaultBomVersionId: form.defaultBomVersionId || null,
    defaultRoutingVersionId: form.defaultRoutingVersionId || null,
    productionWarehouseId: form.productionWarehouseId || null,
    wipWarehouseId: form.wipWarehouseId || null,
    finishedGoodsWarehouseId: form.finishedGoodsWarehouseId || null,
    scrapWarehouseId: form.scrapWarehouseId || null,
    overproductionTolerancePercent: Number(form.overproductionTolerancePercent) || 0,
    underproductionTolerancePercent: Number(form.underproductionTolerancePercent) || 0,
    serialTrackingRequired: form.serialTrackingRequired,
    batchTrackingRequired: form.batchTrackingRequired,
    jobTrackingRequired: form.jobTrackingRequired,
    heatTrackingRequired: form.heatTrackingRequired,
    subcontractingAllowed: form.subcontractingAllowed,
    childProductionOrdersEnabled: form.childProductionOrdersEnabled,
    directProductionOrderAllowed: form.directProductionOrderAllowed,
    partialCompletionAllowed: form.partialCompletionAllowed,
  }
}

type VersionOption = { id: string; label: string }

const LIST_PATH = '/manufacturing/profiles'

export function ProfileEditorPage() {
  const { profileId } = useParams<{ profileId: string }>()
  const location = useLocation()
  const isNew = !profileId || profileId === 'new'
  const isEditRoute = isNew || /\/edit\/?$/.test(location.pathname)
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const { options: warehouses } = useSetupLookup('warehouses')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [busyToggle, setBusyToggle] = useState(false)
  const [bomOptions, setBomOptions] = useState<VersionOption[]>([])
  const [routeOptions, setRouteOptions] = useState<VersionOption[]>([])
  const [readiness, setReadiness] = useState<ProfileReadiness | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  const canManage = perms.canManageProfile
  const canEdit = canManage && isEditRoute
  const viewPath = profileId ? `${LIST_PATH}/${profileId}` : LIST_PATH
  const editPath = profileId ? `${LIST_PATH}/${profileId}/edit` : LIST_PATH
  const title = isNew ? 'New Manufacturing Profile' : form.name.trim() || profile?.name || 'Manufacturing Profile'

  const loadReadiness = useCallback(async (id: string) => {
    setReadinessLoading(true)
    try {
      const res = await getProfileReadiness(id)
      setReadiness(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to fetch readiness')
      setReadiness(null)
    } finally {
      setReadinessLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    if (!apiMode || isNew || !profileId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getProfile(profileId)
      setProfile(res.data)
      setForm(profileToForm(res.data))
      void loadReadiness(profileId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load profile')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [apiMode, isNew, profileId, loadReadiness])

  useEffect(() => {
    if (perms.canViewSetup || perms.canViewProfile) void loadProfile()
    else setLoading(false)
  }, [loadProfile, perms.canViewSetup, perms.canViewProfile])

  useEffect(() => {
    if (!apiMode || !form.productItemId) {
      setBomOptions([])
      setRouteOptions([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [bomRes, itemRouteRes, allRouteRes] = await Promise.all([
          listBoms({ productItemId: form.productItemId, limit: 50 }),
          listRoutings({ productItemId: form.productItemId, isActive: true, limit: 50 }),
          listRoutings({ isActive: true, limit: 100 }),
        ])
        if (cancelled) return

        const boms: VersionOption[] = []
        for (const bom of bomRes.data) {
          for (const version of bom.versions ?? []) {
            if (version.status !== 'ACTIVE' && version.id !== form.defaultBomVersionId) continue
            boms.push({
              id: version.id,
              label: `${bom.code} · Rev ${version.revisionCode} (${version.status})`,
            })
          }
        }
        setBomOptions(boms)

        const routeMap = new Map<string, VersionOption>()
        const addRoutes = async (routingId: string, code: string, name: string, versions?: Array<{ id: string; revisionCode: string; status: string }>) => {
          let vers = versions
          if (!vers?.length) {
            const full = await getRouting(routingId)
            vers = full.data.versions ?? []
          }
          for (const version of vers) {
            if (version.status !== 'ACTIVE' && version.id !== form.defaultRoutingVersionId) continue
            routeMap.set(version.id, {
              id: version.id,
              label: `${code || name} · Rev ${version.revisionCode} (${version.status})`,
            })
          }
        }

        await Promise.all([
          ...itemRouteRes.data.map((r) => addRoutes(r.id, r.code, r.name, r.versions)),
          ...allRouteRes.data.filter((r) => !r.productItemId).map((r) => addRoutes(r.id, r.code, r.name, r.versions)),
        ])
        if (!cancelled) setRouteOptions([...routeMap.values()])
      } catch {
        if (!cancelled) {
          setBomOptions([])
          setRouteOptions([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiMode, form.productItemId, form.defaultBomVersionId, form.defaultRoutingVersionId])

  const canSave = useMemo(
    () => Boolean(form.code.trim() && form.name.trim() && form.productItemId),
    [form.code, form.name, form.productItemId],
  )

  const save = async () => {
    if (!canSave || !canEdit) return
    setSaving(true)
    try {
      const payload = formPayload(form)
      if (isNew) {
        const created = await createProfile(payload)
        notify.success('Manufacturing profile created.')
        navigate(`/manufacturing/profiles/${created.data.id}`, { replace: true })
      } else if (profileId) {
        const updated = await updateProfile(profileId, payload)
        setProfile(updated.data)
        setForm(profileToForm(updated.data))
        notify.success('Manufacturing profile saved.')
        void loadReadiness(profileId)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async () => {
    if (!profile || !canManage) return
    setBusyToggle(true)
    try {
      const next = profile.isActive
        ? await deactivateProfile(profile.id)
        : await activateProfile(profile.id)
      setProfile(next.data)
      notify.success(next.data.isActive ? 'Profile activated.' : 'Profile deactivated.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyToggle(false)
    }
  }

  const remove = async () => {
    if (!profile || !canManage) return
    const ok = await appConfirm({
      title: 'Delete profile?',
      description: `Delete ${profile.code}? This soft-deletes the profile.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusyToggle(true)
    try {
      await deleteProfile(profile.id)
      notify.success('Profile deleted.')
      navigate(LIST_PATH)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyToggle(false)
    }
  }

  useEffect(() => {
    if (!isNew && isEditRoute && !canManage && profileId) {
      navigate(viewPath, { replace: true })
    }
  }, [isNew, isEditRoute, canManage, profileId, viewPath, navigate])

  if (!apiMode) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Profiles' }} parentCrumb={{ label: 'Profiles', to: LIST_PATH }}>
        <EmptyState icon={SlidersHorizontal} title="API mode required" description="Manufacturing profiles require VITE_USE_API=true." />
      </ManufacturingSetupShell>
    )
  }

  if (!perms.canViewSetup && !perms.canViewProfile) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Profiles' }} parentCrumb={{ label: 'Profiles', to: LIST_PATH }}>
        <EmptyState icon={SlidersHorizontal} title="Access denied" description="Missing profile view permission." />
      </ManufacturingSetupShell>
    )
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Profiles' }} parentCrumb={{ label: 'Profiles', to: LIST_PATH }}>
        <LoadingState variant="form" rows={8} />
      </ManufacturingSetupShell>
    )
  }

  if (!isNew && !profile) {
    return (
      <ManufacturingSetupShell title="Profile not found" backLink={{ to: LIST_PATH, label: 'Back to Profiles' }} parentCrumb={{ label: 'Profiles', to: LIST_PATH }}>
        <EmptyState
          icon={SlidersHorizontal}
          title="Profile not found"
          description="This manufacturing profile may have been deleted."
          action={
            <ErpButton size="sm" onClick={() => navigate(LIST_PATH)}>
              Back to list
            </ErpButton>
          }
        />
      </ManufacturingSetupShell>
    )
  }

  return (
    <ManufacturingSetupShell
      title={title}
      description={
        isNew
          ? 'Create a manufacturing profile for an item.'
          : canEdit
            ? 'Edit profile settings, defaults, and warehouses.'
            : 'View manufacturing profile settings and readiness.'
      }
      backLink={{ to: LIST_PATH, label: 'Back to Profiles' }}
      parentCrumb={{ label: 'Profiles', to: LIST_PATH }}
      breadcrumbLabel={isNew ? 'New' : canEdit ? `${form.code || profile?.code} · Edit` : form.code || profile?.code}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && profile ? (
            <DynamicsStatusChip
              label={profile.isActive ? 'Active' : 'Inactive'}
              tone={profile.isActive ? 'success' : 'neutral'}
            />
          ) : null}
          {!isNew && canManage && profile ? (
            <>
              <ErpButton size="sm" variant="outline" loading={busyToggle} onClick={() => void toggleActive()}>
                {profile.isActive ? 'Deactivate' : 'Activate'}
              </ErpButton>
              <ErpButton size="sm" variant="outline" loading={busyToggle} onClick={() => void remove()}>
                Delete
              </ErpButton>
            </>
          ) : null}
          {!isNew && !canEdit && canManage ? (
            <ErpButton size="sm" onClick={() => navigate(editPath)}>
              Edit
            </ErpButton>
          ) : null}
          {canEdit && !isNew ? (
            <ErpButton size="sm" variant="outline" onClick={() => navigate(viewPath)}>
              View
            </ErpButton>
          ) : null}
          <ErpButton size="sm" variant="outline" onClick={() => navigate(LIST_PATH)}>
            {canEdit ? 'Cancel' : 'Close'}
          </ErpButton>
          {canEdit ? (
            <ErpButton size="sm" loading={saving} disabled={!canSave} onClick={() => void save()}>
              {isNew ? 'Create' : 'Save'}
            </ErpButton>
          ) : null}
        </div>
      }
    >
      {!isNew && !canEdit ? (
        <div className="mb-3 rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2 text-[12px] text-erp-muted">
          Viewing in read-only mode.
          {canManage ? (
            <>
              {' '}
              <button type="button" className="font-semibold text-erp-primary hover:underline" onClick={() => navigate(editPath)}>
                Switch to edit
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-4 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
          <h2 className="text-[13px] font-semibold text-erp-text">Identity</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Code" required>
              <Input
                value={form.code}
                disabled={!canEdit || !isNew}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                autoFocus={isNew}
              />
            </FormField>
            <FormField label="Plant code">
              <Input
                value={form.plantCode}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, plantCode: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Name" required className="sm:col-span-2">
              <Input
                value={form.name}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus={!isNew && canEdit}
              />
            </FormField>
            <FormField label="Item" required className="sm:col-span-2" hint="Search Item Master by code or name.">
              <ItemLookupSelect
                value={form.productItemId}
                disabled={!canEdit}
                placeholder="Search item code or name…"
                onChange={(sel) =>
                  setForm((f) => ({
                    ...f,
                    productItemId: sel?.itemId ?? '',
                    defaultBomVersionId: '',
                    defaultRoutingVersionId: '',
                  }))
                }
              />
            </FormField>
          </div>

          <h2 className="border-t border-erp-border pt-4 text-[13px] font-semibold text-erp-text">Production</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Production Type">
              <Select
                value={form.productionType}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, productionType: e.target.value as ProductionType }))}
              >
                {PRODUCTION_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Execution Mode">
              <Select
                value={form.executionMode}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, executionMode: e.target.value as ExecutionMode }))}
              >
                {EXECUTION_MODE_VALUES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Planning Method">
              <Select
                value={form.planningMethod}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, planningMethod: e.target.value as PlanningMethod }))}
              >
                {PLANNING_METHOD_VALUES.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Material Consumption">
              <Select
                value={form.materialConsumptionMethod}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    materialConsumptionMethod: e.target.value as ConsumptionMethod,
                  }))
                }
              >
                <option value="BACKFLUSH">Backflush</option>
                <option value="ACTUAL">Actual</option>
                <option value="MANUAL_ADJUSTED">Manual Adjusted</option>
              </Select>
            </FormField>
            <FormField label="WIP Tracking">
              <Select
                value={form.wipTrackingMethod}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    wipTrackingMethod: e.target.value as ProfileFormState['wipTrackingMethod'],
                  }))
                }
              >
                <option value="LOGICAL_WIP">Logical WIP</option>
                <option value="STOCKED_SEMI_FINISHED">Stocked Semi-Finished</option>
                <option value="BOTH">Both</option>
              </Select>
            </FormField>
            <FormField label="Output Tracking">
              <Select
                value={form.outputTrackingMethod}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    outputTrackingMethod: e.target.value as ProfileFormState['outputTrackingMethod'],
                  }))
                }
              >
                <option value="QUANTITY">Quantity</option>
                <option value="LOT">Lot</option>
                <option value="BATCH">Batch</option>
                <option value="SERIAL">Serial</option>
                <option value="JOB">Job</option>
                <option value="PROJECT">Project</option>
                <option value="HEAT">Heat</option>
                <option value="PIECE">Piece</option>
              </Select>
            </FormField>
          </div>

          <h2 className="border-t border-erp-border pt-4 text-[13px] font-semibold text-erp-text">Defaults</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Default BOM version" hint="Active revisions for this item.">
              <Select
                value={form.defaultBomVersionId}
                disabled={!canEdit || !form.productItemId}
                onChange={(e) => setForm((f) => ({ ...f, defaultBomVersionId: e.target.value }))}
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {bomOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Default routing version" hint="Active item routes and templates.">
              <Select
                value={form.defaultRoutingVersionId}
                disabled={!canEdit || !form.productItemId}
                onChange={(e) => setForm((f) => ({ ...f, defaultRoutingVersionId: e.target.value }))}
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {routeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="sm:col-span-2 text-[11px] text-erp-muted">
              Manage revisions in{' '}
              <Link to="/manufacturing/setup/boms" className="font-medium text-erp-primary hover:underline">
                BOMs
              </Link>{' '}
              and{' '}
              <Link to="/manufacturing/setup/routings" className="font-medium text-erp-primary hover:underline">
                Routings
              </Link>
              .
            </p>
          </div>

          <h2 className="border-t border-erp-border pt-4 text-[13px] font-semibold text-erp-text">Warehouses</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['productionWarehouseId', 'Production Warehouse'],
                ['wipWarehouseId', 'WIP Warehouse'],
                ['finishedGoodsWarehouseId', 'Finished Goods Warehouse'],
                ['scrapWarehouseId', 'Scrap Warehouse'],
              ] as const
            ).map(([field, label]) => (
              <FormField key={field} label={label}>
                <Select
                  value={form[field]}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            ))}
          </div>

          <h2 className="border-t border-erp-border pt-4 text-[13px] font-semibold text-erp-text">Tolerances & tracking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Overproduction Tolerance %">
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={form.overproductionTolerancePercent}
                onChange={(e) => setForm((f) => ({ ...f, overproductionTolerancePercent: e.target.value }))}
              />
            </FormField>
            <FormField label="Underproduction Tolerance %">
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!canEdit}
                value={form.underproductionTolerancePercent}
                onChange={(e) => setForm((f) => ({ ...f, underproductionTolerancePercent: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Switch
              checked={form.serialTrackingRequired}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, serialTrackingRequired: v }))}
              label="Serial tracking required"
            />
            <Switch
              checked={form.batchTrackingRequired}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, batchTrackingRequired: v }))}
              label="Batch tracking required"
            />
            <Switch
              checked={form.jobTrackingRequired}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, jobTrackingRequired: v }))}
              label="Job tracking required"
            />
            <Switch
              checked={form.heatTrackingRequired}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, heatTrackingRequired: v }))}
              label="Heat tracking required"
            />
            <Switch
              checked={form.directProductionOrderAllowed}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, directProductionOrderAllowed: v }))}
              label="Direct production order allowed"
            />
            <Switch
              checked={form.partialCompletionAllowed}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, partialCompletionAllowed: v }))}
              label="Partial completion allowed"
            />
            <Switch
              checked={form.subcontractingAllowed}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, subcontractingAllowed: v }))}
              label="Subcontracting allowed"
            />
            <Switch
              checked={form.childProductionOrdersEnabled}
              disabled={!canEdit}
              onChange={(v) => setForm((f) => ({ ...f, childProductionOrdersEnabled: v }))}
              label="Child production orders enabled"
            />
          </div>

          {canEdit ? (
            <div className="flex justify-end gap-2 border-t border-erp-border pt-3">
              <ErpButton variant="outline" onClick={() => navigate(LIST_PATH)}>
                Cancel
              </ErpButton>
              <ErpButton loading={saving} disabled={!canSave} onClick={() => void save()}>
                {isNew ? 'Create' : 'Save changes'}
              </ErpButton>
            </div>
          ) : null}
        </section>

        {!isNew ? (
          <aside className="h-fit space-y-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-erp-text">Readiness</h2>
              <ErpButton size="sm" variant="outline" loading={readinessLoading} onClick={() => profileId && void loadReadiness(profileId)}>
                Refresh
              </ErpButton>
            </div>
            {readinessLoading && !readiness ? (
              <LoadingState variant="form" rows={4} />
            ) : readiness ? (
              <div className="space-y-2 text-[12.5px]">
                <p className={readiness.ready ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                  {readiness.ready ? 'Ready for production' : 'Not ready'}
                </p>
                <ul className="space-y-1">
                  {Object.entries(readiness.checks).map(([key, ok]) => (
                    <li key={key} className="flex items-center gap-2">
                      <span className={ok ? 'text-emerald-600' : 'text-erp-muted'}>{ok ? '✓' : '○'}</span>
                      <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                    </li>
                  ))}
                </ul>
                {readiness.missing.length > 0 ? (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2">
                    <p className="font-semibold text-amber-900">Missing</p>
                    <ul className="ml-4 list-disc text-amber-900">
                      {readiness.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-erp-muted">Click Refresh to check readiness.</p>
            )}
          </aside>
        ) : null}
      </div>
    </ManufacturingSetupShell>
  )
}
