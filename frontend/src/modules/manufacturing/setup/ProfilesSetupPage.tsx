import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Switch } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell, AccountConfirmModal } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateProfile,
  createProfile,
  deactivateProfile,
  getProfileReadiness,
  listProfiles,
} from '@/services/api/manufacturingApi'
import { useSetupLookup } from './useSetupLookups'
import {
  EXECUTION_MODE_VALUES,
  PRODUCTION_TYPE_VALUES,
  type ExecutionMode,
  type Profile,
  type ProfileReadiness,
  type ProductionType,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'
import { SetupViewPopup } from './SetupViewPopup'

interface ProfileFormState {
  code: string
  name: string
  productItemId: string
  productionType: ProductionType
  executionMode: ExecutionMode
  materialConsumptionMethod: 'BACKFLUSH' | 'ACTUAL' | 'MANUAL_ADJUSTED'
  wipTrackingMethod: 'LOGICAL_WIP' | 'STOCKED_SEMI_FINISHED' | 'BOTH'
  outputTrackingMethod: 'QUANTITY' | 'LOT' | 'BATCH' | 'SERIAL' | 'JOB' | 'PROJECT' | 'HEAT' | 'PIECE'
  productionWarehouseId: string
  wipWarehouseId: string
  finishedGoodsWarehouseId: string
  scrapWarehouseId: string
  overproductionTolerancePercent: string
  underproductionTolerancePercent: string
  serialTrackingRequired: boolean
  batchTrackingRequired: boolean
}

const EMPTY_FORM: ProfileFormState = {
  code: '',
  name: '',
  productItemId: '',
  productionType: 'ASSEMBLY',
  executionMode: 'SIMPLE',
  materialConsumptionMethod: 'BACKFLUSH',
  wipTrackingMethod: 'LOGICAL_WIP',
  outputTrackingMethod: 'QUANTITY',
  productionWarehouseId: '',
  wipWarehouseId: '',
  finishedGoodsWarehouseId: '',
  scrapWarehouseId: '',
  overproductionTolerancePercent: '0',
  underproductionTolerancePercent: '0',
  serialTrackingRequired: false,
  batchTrackingRequired: false,
}

export function ProfilesSetupPage() {
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Profile[]>([])
  const { options: items } = useSetupLookup('items')
  const { options: warehouses } = useSetupLookup('warehouses')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewing, setViewing] = useState<Profile | null>(null)
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM)
  const [moreOpen, setMoreOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [readinessFor, setReadinessFor] = useState<Profile | null>(null)
  const [readiness, setReadiness] = useState<ProfileReadiness | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  const itemLabel = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      return item?.label ?? '—'
    },
    [items],
  )

  const warehouseLabel = useCallback(
    (id: string | null) => {
      if (!id) return '—'
      return warehouses.find((w) => w.id === id)?.label ?? '—'
    },
    [warehouses],
  )

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listProfiles({ search: search || undefined, limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load profiles')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [apiMode, search])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setMoreOpen(false)
    setDrawerOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await createProfile({
        code: form.code.trim(),
        name: form.name.trim(),
        productItemId: form.productItemId,
        productionType: form.productionType,
        executionMode: form.executionMode,
        materialConsumptionMethod: form.materialConsumptionMethod,
        wipTrackingMethod: form.wipTrackingMethod,
        outputTrackingMethod: form.outputTrackingMethod,
        productionWarehouseId: form.productionWarehouseId || undefined,
        wipWarehouseId: form.wipWarehouseId || undefined,
        finishedGoodsWarehouseId: form.finishedGoodsWarehouseId || undefined,
        scrapWarehouseId: form.scrapWarehouseId || undefined,
        overproductionTolerancePercent: Number(form.overproductionTolerancePercent) || 0,
        underproductionTolerancePercent: Number(form.underproductionTolerancePercent) || 0,
        serialTrackingRequired: form.serialTrackingRequired,
        batchTrackingRequired: form.batchTrackingRequired,
      })
      notify.success('Manufacturing profile created.')
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: Profile) => {
    setBusyId(row.id)
    try {
      if (row.isActive) {
        await deactivateProfile(row.id)
        notify.success('Profile deactivated.')
      } else {
        await activateProfile(row.id)
        notify.success('Profile activated.')
      }
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const checkReadiness = async (row: Profile) => {
    setReadinessFor(row)
    setReadinessLoading(true)
    setReadiness(null)
    try {
      const res = await getProfileReadiness(row.id)
      setReadiness(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to fetch readiness')
      setReadinessFor(null)
    } finally {
      setReadinessLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <ManufacturingSetupShell
      title="Manufacturing Profiles"
      actions={
        apiMode && perms.canManageProfile ? (
          <ErpButton size="sm" onClick={openNew}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Profile
          </ErpButton>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup && !perms.canViewProfile ? (
        <EmptyState icon={SlidersHorizontal} title="Access denied" description="Missing profile view permission." />
      ) : (
        <>
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="max-w-xs" />
          </div>
          {loading ? <LoadingState variant="table" rows={6} cols={6} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState icon={SlidersHorizontal} title="No profiles found" description="Create a manufacturing profile for an item." />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[760px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Item</th>
                    <th>Production Type</th>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-[11px] font-medium">{row.code}</td>
                      <td className="font-medium">{row.name}</td>
                      <td>{itemLabel(row.productItemId)}</td>
                      <td>{row.productionType.replace(/_/g, ' ')}</td>
                      <td>{row.executionMode}</td>
                      <td>
                        <DynamicsStatusChip
                          label={row.isActive ? 'Active' : 'Inactive'}
                          tone={row.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <ErpButton size="sm" variant="outline" onClick={() => setViewing(row)}>
                            View
                          </ErpButton>
                          <ErpButton size="sm" variant="outline" onClick={() => void checkReadiness(row)}>
                            Check Readiness
                          </ErpButton>
                          {perms.canManageProfile ? (
                            <ErpButton
                              size="sm"
                              variant="outline"
                              loading={busyId === row.id}
                              onClick={() => void toggleActive(row)}
                            >
                              {row.isActive ? 'Deactivate' : 'Activate'}
                            </ErpButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      <SetupViewPopup
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? 'Manufacturing Profile'}
        subtitle={viewing?.code}
        widthClassName="max-w-2xl"
        fields={
          viewing
            ? [
                { label: 'Code', value: viewing.code, mono: true },
                {
                  label: 'Status',
                  value: (
                    <DynamicsStatusChip
                      label={viewing.isActive ? 'Active' : 'Inactive'}
                      tone={viewing.isActive ? 'success' : 'neutral'}
                    />
                  ),
                },
                { label: 'Name', value: viewing.name, fullWidth: true },
                { label: 'Item', value: itemLabel(viewing.productItemId), fullWidth: true },
                { label: 'Production Type', value: viewing.productionType.replace(/_/g, ' ') },
                { label: 'Execution Mode', value: viewing.executionMode },
                { label: 'Material Consumption', value: viewing.materialConsumptionMethod },
                { label: 'WIP Tracking', value: viewing.wipTrackingMethod.replace(/_/g, ' ') },
                { label: 'Output Tracking', value: viewing.outputTrackingMethod },
                { label: 'Plant', value: viewing.plantCode ?? '—' },
                { label: 'Production WH', value: warehouseLabel(viewing.productionWarehouseId) },
                { label: 'WIP WH', value: warehouseLabel(viewing.wipWarehouseId) },
                { label: 'FG WH', value: warehouseLabel(viewing.finishedGoodsWarehouseId) },
                { label: 'Scrap WH', value: warehouseLabel(viewing.scrapWarehouseId) },
                {
                  label: 'Serial / Batch',
                  value: `${viewing.serialTrackingRequired ? 'Serial' : '—'} / ${viewing.batchTrackingRequired ? 'Batch' : '—'}`,
                },
                { label: 'Updated', value: viewing.updatedAt.slice(0, 10) },
              ]
            : []
        }
        footerExtra={
          viewing ? (
            <ErpButton
              variant="outline"
              onClick={() => {
                const row = viewing
                setViewing(null)
                void checkReadiness(row)
              }}
            >
              Check Readiness
            </ErpButton>
          ) : null
        }
      />

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Manufacturing Profile"
        eyebrow="Manufacturing Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              loading={saving}
              disabled={!form.code.trim() || !form.name.trim() || !form.productItemId}
              onClick={() => void save()}
            >
              Save
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Item" required hint="Search Item Master by code or name.">
            <ItemLookupSelect
              value={form.productItemId}
              placeholder="Search item code or name…"
              onChange={(sel) => setForm((f) => ({ ...f, productItemId: sel?.itemId ?? '' }))}
            />
          </FormField>
          <FormField label="Production Type">
            <Select
              value={form.productionType}
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
              onChange={(e) => setForm((f) => ({ ...f, executionMode: e.target.value as ExecutionMode }))}
            >
              {EXECUTION_MODE_VALUES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Material Consumption">
            <Select
              value={form.materialConsumptionMethod}
              onChange={(e) => setForm((f) => ({ ...f, materialConsumptionMethod: e.target.value as ProfileFormState['materialConsumptionMethod'] }))}
            >
              <option value="BACKFLUSH">Backflush</option>
              <option value="ACTUAL">Actual</option>
              <option value="MANUAL_ADJUSTED">Manual Adjusted</option>
            </Select>
          </FormField>
          <FormField label="WIP Tracking">
            <Select
              value={form.wipTrackingMethod}
              onChange={(e) => setForm((f) => ({ ...f, wipTrackingMethod: e.target.value as ProfileFormState['wipTrackingMethod'] }))}
            >
              <option value="LOGICAL_WIP">Logical WIP</option>
              <option value="STOCKED_SEMI_FINISHED">Stocked Semi-Finished</option>
              <option value="BOTH">Both</option>
            </Select>
          </FormField>
          <FormField label="Output Tracking">
            <Select
              value={form.outputTrackingMethod}
              onChange={(e) => setForm((f) => ({ ...f, outputTrackingMethod: e.target.value as ProfileFormState['outputTrackingMethod'] }))}
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

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex items-center gap-1 text-[12px] font-semibold text-erp-primary"
          >
            {moreOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            More settings
          </button>

          {moreOpen ? (
            <div className="space-y-3 rounded-md border border-erp-border bg-erp-surface-alt/40 p-3">
              {(['productionWarehouseId', 'wipWarehouseId', 'finishedGoodsWarehouseId', 'scrapWarehouseId'] as const).map(
                (field) => (
                  <FormField
                    key={field}
                    label={
                      field === 'productionWarehouseId'
                        ? 'Production Warehouse'
                        : field === 'wipWarehouseId'
                          ? 'WIP Warehouse'
                          : field === 'finishedGoodsWarehouseId'
                            ? 'Finished Goods Warehouse'
                            : 'Scrap Warehouse'
                    }
                  >
                    {warehouses.length > 0 ? (
                      <Select value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}>
                        <option value="">Not set</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={form[field]}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value.trim() }))}
                        placeholder="Warehouse UUID (optional)"
                      />
                    )}
                  </FormField>
                ),
              )}
              <FormField label="Overproduction Tolerance %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.overproductionTolerancePercent}
                  onChange={(e) => setForm((f) => ({ ...f, overproductionTolerancePercent: e.target.value }))}
                />
              </FormField>
              <FormField label="Underproduction Tolerance %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.underproductionTolerancePercent}
                  onChange={(e) => setForm((f) => ({ ...f, underproductionTolerancePercent: e.target.value }))}
                />
              </FormField>
              <Switch
                checked={form.serialTrackingRequired}
                onChange={(v) => setForm((f) => ({ ...f, serialTrackingRequired: v }))}
                label="Serial tracking required"
              />
              <Switch
                checked={form.batchTrackingRequired}
                onChange={(v) => setForm((f) => ({ ...f, batchTrackingRequired: v }))}
                label="Batch tracking required"
              />
            </div>
          ) : null}
        </div>
      </AccountDrawerShell>

      <AccountConfirmModal
        open={Boolean(readinessFor)}
        onClose={() => setReadinessFor(null)}
        title={`Readiness — ${readinessFor?.code ?? ''}`}
        confirmLabel="Close"
        onConfirm={() => setReadinessFor(null)}
      >
        {readinessLoading ? (
          <LoadingState variant="form" rows={4} />
        ) : readiness ? (
          <div className="mt-3 space-y-2 text-left text-[12.5px]">
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
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                <p className="font-semibold text-amber-900">Missing:</p>
                <ul className="ml-4 list-disc text-amber-900">
                  {readiness.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </AccountConfirmModal>
    </ManufacturingSetupShell>
  )
}
