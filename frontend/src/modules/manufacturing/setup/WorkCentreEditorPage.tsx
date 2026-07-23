import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Warehouse } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateWorkCentre,
  createWorkCentre,
  deactivateWorkCentre,
  deleteWorkCentre,
  getWorkCentre,
  updateWorkCentre,
} from '@/services/api/manufacturingApi'
import type { WorkCentre } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

interface FormState {
  code: string
  name: string
  plantCode: string
  description: string
}

const EMPTY: FormState = { code: '', name: '', plantCode: '', description: '' }
const LIST_PATH = '/manufacturing/work-centres'

export function WorkCentreEditorPage() {
  const { workCentreId } = useParams<{ workCentreId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()

  const isNew = !workCentreId || workCentreId === 'new'
  const isEditRoute = isNew || /\/edit\/?$/.test(location.pathname)
  const canManage = perms.canManageWorkCentre
  const canEdit = canManage && isEditRoute

  const [row, setRow] = useState<WorkCentre | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const viewPath = workCentreId ? `${LIST_PATH}/${workCentreId}` : LIST_PATH
  const editPath = workCentreId ? `${LIST_PATH}/${workCentreId}/edit` : LIST_PATH
  const title = isNew ? 'New Work Centre' : form.name.trim() || row?.name || 'Work Centre'

  const load = useCallback(async () => {
    if (!apiMode || isNew || !workCentreId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getWorkCentre(workCentreId)
      setRow(res.data)
      setForm({
        code: res.data.code,
        name: res.data.name,
        plantCode: res.data.plantCode ?? '',
        description: res.data.description ?? '',
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load work centre')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [apiMode, isNew, workCentreId])

  useEffect(() => {
    if (perms.canViewSetup || perms.canViewWorkCentre) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup, perms.canViewWorkCentre])

  useEffect(() => {
    if (!isNew && isEditRoute && !canManage && workCentreId) {
      navigate(viewPath, { replace: true })
    }
  }, [isNew, isEditRoute, canManage, workCentreId, viewPath, navigate])

  const canSave = useMemo(() => Boolean(form.code.trim() && form.name.trim()), [form.code, form.name])

  const save = async () => {
    if (!canSave || !canEdit) return
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        plantCode: form.plantCode.trim() || undefined,
        description: form.description.trim() || undefined,
      }
      if (isNew) {
        const created = await createWorkCentre(payload)
        notify.success('Work centre created.')
        navigate(`${LIST_PATH}/${created.data.id}`, { replace: true })
      } else if (workCentreId) {
        const updated = await updateWorkCentre(workCentreId, payload)
        setRow(updated.data)
        notify.success('Work centre saved.')
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
      const next = row.isActive ? await deactivateWorkCentre(row.id) : await activateWorkCentre(row.id)
      setRow(next.data)
      notify.success(next.data.isActive ? 'Work centre activated.' : 'Work centre deactivated.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!row || !canManage) return
    const ok = await appConfirm({
      title: 'Delete work centre?',
      description: `Delete ${row.code}? This soft-deletes the record.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteWorkCentre(row.id)
      notify.success('Work centre deleted.')
      navigate(LIST_PATH)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  if (!apiMode) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Work Centres' }} parentCrumb={{ label: 'Work Centres', to: LIST_PATH }}>
        <EmptyState icon={Warehouse} title="API mode required" description="Work centres require VITE_USE_API=true." />
      </ManufacturingSetupShell>
    )
  }

  if (!perms.canViewSetup && !perms.canViewWorkCentre) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Work Centres' }} parentCrumb={{ label: 'Work Centres', to: LIST_PATH }}>
        <EmptyState icon={Warehouse} title="Access denied" description="Missing work centre view permission." />
      </ManufacturingSetupShell>
    )
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title={title} backLink={{ to: LIST_PATH, label: 'Back to Work Centres' }} parentCrumb={{ label: 'Work Centres', to: LIST_PATH }}>
        <LoadingState variant="form" rows={6} />
      </ManufacturingSetupShell>
    )
  }

  if (!isNew && !row) {
    return (
      <ManufacturingSetupShell title="Not found" backLink={{ to: LIST_PATH, label: 'Back to Work Centres' }} parentCrumb={{ label: 'Work Centres', to: LIST_PATH }}>
        <EmptyState icon={Warehouse} title="Work centre not found" description="It may have been deleted." />
      </ManufacturingSetupShell>
    )
  }

  return (
    <ManufacturingSetupShell
      title={title}
      description={isNew ? 'Create a work centre.' : canEdit ? 'Edit work centre details.' : 'View work centre details.'}
      backLink={{ to: LIST_PATH, label: 'Back to Work Centres' }}
      parentCrumb={{ label: 'Work Centres', to: LIST_PATH }}
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
          <Input
            value={form.name}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus={!isNew && canEdit}
          />
        </FormField>
        <FormField label="Plant Code">
          <Input
            value={form.plantCode}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, plantCode: e.target.value }))}
          />
        </FormField>
        <FormField label="Description">
          <Textarea
            rows={4}
            value={form.description}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>
        {!isNew && row ? (
          <p className="text-[11px] text-erp-muted">Updated {row.updatedAt.slice(0, 10)}</p>
        ) : null}
      </section>
    </ManufacturingSetupShell>
  )
}
