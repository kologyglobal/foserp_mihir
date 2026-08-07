import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarCheck, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import {
  createTicketFromPreventivePlan,
  deactivatePreventivePlan,
  getPreventivePlan,
  updatePreventivePlan,
  type PmFrequencyType,
  type PreventiveMaintenancePlan,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB } from '../maintenanceUi'

function dueTone(s: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (s === 'OVERDUE') return 'danger'
  if (s === 'DUE') return 'warning'
  return 'info'
}

export function PreventiveMaintenanceDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useMaintenancePermissions()
  const [plan, setPlan] = useState<PreventiveMaintenancePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequencyType, setFrequencyType] = useState<PmFrequencyType>('MONTHS')
  const [frequencyValue, setFrequencyValue] = useState(1)
  const [nextDueDate, setNextDueDate] = useState('')
  const [checklistText, setChecklistText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getPreventivePlan(id)
      setPlan(res.data)
      setName(res.data.name)
      setDescription(res.data.description ?? '')
      setFrequencyType(res.data.frequencyType)
      setFrequencyValue(res.data.frequencyValue)
      setNextDueDate(res.data.nextDueDate)
      setChecklistText(res.data.checklist.map((c) => c.text).join('\n'))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load plan')
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!plan || !perms.canUpdate) return
    setBusy(true)
    try {
      const res = await updatePreventivePlan(plan.id, {
        name: name.trim(),
        description: description.trim() || null,
        frequencyType,
        frequencyValue,
        nextDueDate,
        checklist: checklistText
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
          .map((text, i) => ({ text, sequence: i + 1 })),
      })
      setPlan(res.data)
      setEditing(false)
      notify.success('Plan updated')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const createTicket = async () => {
    if (!plan || !perms.canCreate) return
    setBusy(true)
    try {
      const res = await createTicketFromPreventivePlan(plan.id, {})
      notify.success(`Ticket ${res.data.ticketNumber} created`)
      navigate(`/maintenance/tickets/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not create ticket')
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async () => {
    if (!plan || !perms.canUpdate) return
    setBusy(true)
    try {
      const res = await deactivatePreventivePlan(plan.id)
      setPlan(res.data)
      notify.success('Plan deactivated')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Deactivate failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell title="PM Plan" breadcrumbs={[MAINTENANCE_BREADCRUMB]}>
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  if (!plan) {
    return (
      <OperationalPageShell title="PM Plan" breadcrumbs={[MAINTENANCE_BREADCRUMB]}>
        <EmptyState icon={CalendarCheck} title="Not found" description="Plan unavailable." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title={`${plan.planNumber} — ${plan.name}`}
      description={`${plan.machine?.code ?? ''} · ${plan.frequencyLabel}`}
      breadcrumbs={[
        MAINTENANCE_BREADCRUMB,
        { label: 'Preventive Maintenance', to: '/maintenance/preventive' },
        { label: plan.planNumber },
      ]}
      autoBreadcrumbs={false}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            plan.canCreateTicket && perms.canCreate
              ? {
                  id: 'create-ticket',
                  label: busy ? 'Working…' : 'Create Ticket',
                  onClick: () => void createTicket(),
                  disabled: busy,
                }
              : editing
                ? {
                    id: 'save',
                    label: busy ? 'Saving…' : 'Save',
                    onClick: () => void save(),
                    disabled: busy,
                  }
                : perms.canUpdate
                  ? {
                      id: 'edit',
                      label: 'Edit',
                      onClick: () => setEditing(true),
                    }
                  : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            ...(plan.isActive && perms.canUpdate && !editing
              ? [
                  {
                    id: 'deactivate',
                    label: 'Deactivate',
                    onClick: () => void deactivate(),
                  },
                ]
              : []),
            ...(editing
              ? [{ id: 'cancel-edit', label: 'Cancel', onClick: () => setEditing(false) }]
              : []),
            ...(plan.openTicket
              ? [
                  {
                    id: 'open-ticket',
                    label: plan.openTicket.ticketNumber,
                    onClick: () => navigate(`/maintenance/tickets/${plan.openTicket!.id}`),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <StatusDot label={plan.dueStatus} tone={dueTone(plan.dueStatus)} />
        <span className={plan.isActive ? 'text-emerald-700' : 'text-erp-muted'}>
          {plan.isActive ? 'Active' : 'Inactive'}
        </span>
        {plan.openTicket ? (
          <Link
            to={`/maintenance/tickets/${plan.openTicket.id}`}
            className="text-erp-primary hover:underline"
          >
            Open ticket {plan.openTicket.ticketNumber}
          </Link>
        ) : null}
      </div>

      {!editing ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Machine" value={`${plan.machine?.code ?? '-'} — ${plan.machine?.name ?? ''}`} />
          <Info label="Work Centre" value={plan.machine?.workCentre?.code ?? '-'} />
          <Info label="Last Service" value={plan.lastCompletedDate ?? '-'} />
          <Info label="Next Due" value={plan.nextDueDate} />
          <Info label="Frequency" value={plan.frequencyLabel} />
          <Info
            label="Assigned"
            value={plan.contractor?.name ?? (plan.assignedTechnicianId ? 'Internal tech' : '-')}
          />
          <Info
            label="Est. duration"
            value={plan.estimatedDurationMin != null ? `${plan.estimatedDurationMin} min` : '-'}
          />
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-3">
          <FormField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Description">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Frequency type">
              <Select
                value={frequencyType}
                onChange={(e) => setFrequencyType(e.target.value as PmFrequencyType)}
              >
                <option value="DAYS">Days</option>
                <option value="WEEKS">Weeks</option>
                <option value="MONTHS">Months</option>
              </Select>
            </FormField>
            <FormField label="Every">
              <Input
                type="number"
                min={1}
                value={frequencyValue}
                onChange={(e) => setFrequencyValue(Number(e.target.value) || 1)}
              />
            </FormField>
            <FormField label="Next due">
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Checklist">
            <Textarea rows={6} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} />
          </FormField>
        </div>
      )}

      {!editing && plan.checklist.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Checklist</h2>
          <ul className="space-y-1 rounded-lg border border-erp-border bg-white px-3 py-2 text-sm">
            {plan.checklist.map((c) => (
              <li key={c.id}>
                {c.sequence}. {c.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.description && !editing ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-erp-muted">{plan.description}</p>
      ) : null}
    </OperationalPageShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-erp-fg">{value}</div>
    </div>
  )
}
