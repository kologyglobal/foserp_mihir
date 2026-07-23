import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateMachine,
  createMachine,
  deactivateMachine,
  deleteMachine,
  getMachine,
  listWorkCentres,
  updateMachine,
} from '@/services/api/manufacturingApi'
import {
  MACHINE_STATUSES,
  MACHINE_STATUS_LABELS,
  type Machine,
  type MachineStatus,
  type WorkCentre,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

interface FormState {
  code: string
  name: string
  workCentreId: string
  status: MachineStatus
  manufacturer: string
  model: string
}

const EMPTY: FormState = {
  code: '',
  name: '',
  workCentreId: '',
  status: 'AVAILABLE',
  manufacturer: '',
  model: '',
}
const LIST_PATH = '/manufacturing/machines'

export function MachineEditorPage() {
  const { machineId } = useParams<{ machineId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()

  const isNew = !machineId || machineId === 'new'
  const isEditRoute = isNew || /\/edit\/?$/.test(location.pathname)
  const canManage = perms.canManageMachine
  const canEdit = canManage && isEditRoute

  const [row, setRow] = useState<Machine | null>(null)
  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([])
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const viewPath = machineId ? `${LIST_PATH}/${machineId}` : LIST_PATH
  const editPath = machineId ? `${LIST_PATH}/${machineId}/edit` : LIST_PATH
  const title = isNew ? 'New Machine' : form.name.trim() || row?.name || 'Machine'

  const workCentreLabel = useCallback(
    (id: string) => {
      const wc = workCentres.find((w) => w.id === id)
      return wc ? `${wc.code} — ${wc.name}` : '—'
    },
    [workCentres],
  )

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const wcRes = await listWorkCentres({ limit: 100 })
      setWorkCentres(wcRes.data)
      if (isNew) {
        setForm((f) => ({ ...f, workCentreId: f.workCentreId || wcRes.data[0]?.id || '' }))
        setLoading(false)
        return
      }
      if (!machineId) {
        setLoading(false)
        return
      }
      const res = await getMachine(machineId)
      setRow(res.data)
      setForm({
        code: res.data.code,
        name: res.data.name,
        workCentreId: res.data.workCentreId,
        status: res.data.status,
        manufacturer: res.data.manufacturer ?? '',
        model: res.data.model ?? '',
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load machine')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [apiMode, isNew, machineId])

  useEffect(() => {
    if (perms.canViewSetup || perms.canViewMachine) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup, perms.canViewMachine])

  useEffect(() => {
    if (!isNew && isEditRoute && !canManage && machineId) {
      navigate(viewPath, { replace: true })
    }
  }, [isNew, isEditRoute, canManage, machineId, viewPath, navigate])

  const canSave = useMemo(
    () => Boolean(form.code.trim() && form.name.trim() && form.workCentreId),
    [form.code, form.name, form.workCentreId],
  )

  const save = async () => {
    if (!canSave || !canEdit) return
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        workCentreId: form.workCentreId,
        status: form.status,
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
      }
      if (isNew) {
        const created = await createMachine(payload)
        notify.success('Machine created.')
        navigate(`${LIST_PATH}/${created.data.id}`, { replace: true })
      } else if (machineId) {
        const updated = await updateMachine(machineId, payload)
        setRow(updated.data)
        notify.success('Machine saved.')
        navigate(viewPath)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async () => {
    if (!row || !canManage) return
    setBusy(true)
    try {
      const next = row.isActive ? await deactivateMachine(row.id) : await activateMachine(row.id)
      setRow(next.data)
      notify.success(next.data.isActive ? 'Machine activated.' : 'Machine deactivated.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!row || !canManage) return
    const ok = await appConfirm({
      title: 'Delete machine?',
      description: `Delete ${row.code}? This soft-deletes the record.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteMachine(row.id)
      notify.success('Machine deleted.')
      navigate(LIST_PATH)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  if (!apiMode) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Machines' }} parentCrumb={{ label: 'Machines', to: LIST_PATH }}>
        <EmptyState icon={Wrench} title="API mode required" description="Machines require VITE_USE_API=true." />
      </ManufacturingSetupShell>
    )
  }

  if (!perms.canViewSetup && !perms.canViewMachine) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Machines' }} parentCrumb={{ label: 'Machines', to: LIST_PATH }}>
        <EmptyState icon={Wrench} title="Access denied" description="Missing machine view permission." />
      </ManufacturingSetupShell>
    )
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Machines' }} parentCrumb={{ label: 'Machines', to: LIST_PATH }}>
        <LoadingState variant="form" rows={6} />
      </ManufacturingSetupShell>
    )
  }

  if (!isNew && !row) {
    return (
      <ManufacturingSetupShell title="Not found" backLink={{ to: LIST_PATH, label: 'Back to Machines' }} parentCrumb={{ label: 'Machines', to: LIST_PATH }}>
        <EmptyState icon={Wrench} title="Machine not found" description="It may have been deleted." />
      </ManufacturingSetupShell>
    )
  }

  return (
    <ManufacturingSetupShell
      title={title}
      description={isNew ? 'Create a machine under a work centre.' : canEdit ? 'Edit machine details.' : 'View machine details.'}
      backLink={{ to: LIST_PATH, label: 'Back to Machines' }}
      parentCrumb={{ label: 'Machines', to: LIST_PATH }}
      breadcrumbLabel={isNew ? 'New' : canEdit ? `${form.code} · Edit` : form.code}
      actions={
        <div className="flex flex-wrap gap-2">
          {!isNew && row ? (
            <DynamicsStatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'success' : 'neutral'} />
          ) : null}
          {!isNew && canManage ? (
            <>
              <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void toggleActive()}>
                {row?.isActive ? 'Deactivate' : 'Activate'}
              </ErpButton>
              <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void remove()}>
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

      <section className="max-w-2xl space-y-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
        <FormField label="Code" required>
          <Input
            value={form.code}
            disabled={!canEdit || !isNew}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            autoFocus={isNew}
          />
        </FormField>
        <FormField label="Name" required>
          <Input value={form.name} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Work Centre" required>
          {canEdit ? (
            <Select value={form.workCentreId} onChange={(e) => setForm((f) => ({ ...f, workCentreId: e.target.value }))}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.code} — {wc.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={workCentreLabel(form.workCentreId)} disabled />
          )}
        </FormField>
        <FormField label="Status">
          <Select
            value={form.status}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MachineStatus }))}
          >
            {MACHINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MACHINE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Manufacturer">
          <Input
            value={form.manufacturer}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
          />
        </FormField>
        <FormField label="Model">
          <Input value={form.model} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
        </FormField>
        {!isNew && row ? (
          <p className="text-[11px] text-erp-muted">Updated {row.updatedAt.slice(0, 10)}</p>
        ) : null}
      </section>
    </ManufacturingSetupShell>
  )
}
