import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { EmptyState } from '@/components/ui/EmptyState'
import { GitBranch } from 'lucide-react'
import { createRouting, createRoutingVersion } from '@/services/api/manufacturingApi'
import {
  ROUTING_FLOW_TYPE_LABELS,
  ROUTING_FLOW_TYPE_VALUES,
  type RoutingFlowType,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'

interface RoutingFormState {
  name: string
  productionFlowType: RoutingFlowType
  description: string
}

const EMPTY_FORM: RoutingFormState = {
  name: '',
  productionFlowType: 'SERIAL',
  description: '',
}

export function RoutingCreatePage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [form, setForm] = useState<RoutingFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const listPath = '/manufacturing/setup/routings'

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const routing = await createRouting({
        name: form.name.trim(),
        productionFlowType: form.productionFlowType,
        description: form.description.trim() || undefined,
      })
      await createRoutingVersion(routing.data.id, {
        revisionCode: 'A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
      })
      notify.success('Route created with first draft version.')
      navigate(`/manufacturing/setup/routings/${routing.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ManufacturingSetupShell
      title="New Route"
      description="Define the route header, then add operations on the next screen."
      backLink={{ to: listPath, label: 'Back to Routings' }}
      parentCrumb={{ label: 'Routings', to: listPath }}
      actions={
        apiMode && perms.canManageRouting ? (
          <div className="flex flex-wrap gap-2">
            <ErpButton size="sm" variant="outline" onClick={() => navigate(listPath)}>
              Cancel
            </ErpButton>
            <ErpButton size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void save()}>
              Create
            </ErpButton>
          </div>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canManageRouting ? (
        <EmptyState icon={GitBranch} title="Access denied" description="Missing routing manage permission." />
      ) : (
        <section className="max-w-2xl space-y-4 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
          <FormField label="Route Code" hint="Code assigned on save (RT-######).">
            <Input value="" disabled placeholder="RT-######" />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 48M3 Trailer MS Route"
              autoFocus
            />
          </FormField>
          <FormField label="Production Type" required>
            <Select
              value={form.productionFlowType}
              onChange={(e) => setForm((f) => ({ ...f, productionFlowType: e.target.value as RoutingFlowType }))}
            >
              {ROUTING_FLOW_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {ROUTING_FLOW_TYPE_LABELS[v]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description">
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional route notes"
            />
          </FormField>
          <p className="text-[12px] text-erp-muted">
            Routes are not tied to an item. Link a certified route on the Manufacturing Profile for the finished item.
          </p>
          <div className="flex justify-end gap-2 border-t border-erp-border pt-3">
            <ErpButton variant="outline" onClick={() => navigate(listPath)}>
              Cancel
            </ErpButton>
            <ErpButton loading={saving} disabled={!form.name.trim()} onClick={() => void save()}>
              Create
            </ErpButton>
          </div>
        </section>
      )}
    </ManufacturingSetupShell>
  )
}
