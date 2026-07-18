import { useState, useMemo, useEffect } from 'react'
import type { FollowUp, FollowUpType, OpportunityPriority } from '../../types/crm'
import { useCrmStore } from '../../store/crmStore'
import { useSalesStore } from '../../store/salesStore'
import { resolveStoreAction } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { useOpportunityPriorityOptions, useFollowUpTypeOptions } from '../../hooks/useCrmMasters'
import { useActiveCustomers } from '../../hooks/useMasterLists'
import { resolveOpportunityPriorityOptions } from '../../utils/opportunityUtils'
import { getSessionUser } from '../../utils/permissions'
import {
  getDateInputMin,
  getTimeInputMin,
  suggestDefaultFollowUpSlot,
  validateFollowUpAt,
} from '../../utils/validation/crmDatePolicy'
import { handleInvalidSubmit } from '../../utils/formValidation'
import { CrmDrawerShell } from './CrmDrawerShell'
import { FormField } from '../forms/FormField'
import { Input, Select, Textarea } from '../forms/Inputs'
import { Button } from '../ui/Button'

const FALLBACK_FOLLOW_UP_TYPES: { id: FollowUpType; label: string }[] = [
  { id: 'call', label: 'Call' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'site_visit', label: 'Site Visit' },
  { id: 'demo', label: 'Demo' },
  { id: 'quotation_follow_up', label: 'Quotation Follow-up' },
  { id: 'payment_follow_up', label: 'Payment Follow-up' },
  { id: 'technical_discussion', label: 'Technical Discussion' },
]

const OUTCOMES = [
  'Customer interested',
  'Needs revised quotation',
  'Waiting for approval',
  'Price negotiation',
  'Technical clarification needed',
  'No response',
  'Lost to competitor',
  'Ready for order',
]

export interface QuickFollowUpContext {
  customerId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  quotationId?: string | null
  leadId?: string | null
  leadName?: string
  assignedTo?: string
  assignedToName?: string
}

interface QuickFollowUpDrawerProps {
  open: boolean
  onClose: () => void
  context?: QuickFollowUpContext
  onCreated?: () => void
  /** When set, drawer edits this follow-up instead of creating. */
  followUp?: FollowUp | null
}

export function QuickFollowUpDrawer({ open, onClose, context, onCreated, followUp }: QuickFollowUpDrawerProps) {
  const createFollowUp = useCrmStore((s) => s.createFollowUp)
  const updateFollowUp = useCrmStore((s) => s.updateFollowUp)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
  const leads = useSalesStore((s) => s.leads)
  const opportunities = useCrmStore((s) => s.opportunities)
  const customers = useActiveCustomers()
  const priorityOptions = useOpportunityPriorityOptions()
  const resolvedPriorities = useMemo(
    () => (priorityOptions.length > 0 ? priorityOptions : resolveOpportunityPriorityOptions().map((p) => ({ value: p.value, label: p.label }))),
    [priorityOptions],
  )
  const followUpTypeOptions = useFollowUpTypeOptions()
  const followUpTypes = useMemo(
    () => (followUpTypeOptions.length > 0
      ? followUpTypeOptions.map((t) => ({ id: t.value as FollowUpType, label: t.label }))
      : FALLBACK_FOLLOW_UP_TYPES),
    [followUpTypeOptions],
  )
  const defaultPriority = (resolvedPriorities.find((p) => p.value === 'medium')?.value ?? resolvedPriorities[0]?.value ?? 'medium') as OpportunityPriority
  const isEdit = Boolean(followUp)
  const contextLocksRelated = Boolean(
    context?.customerId || context?.leadId || context?.opportunityId,
  )
  const defaultSlot = suggestDefaultFollowUpSlot()
  const [customerId, setCustomerId] = useState(context?.customerId ?? '')
  const [leadId, setLeadId] = useState(context?.leadId ?? '')
  const [opportunityId, setOpportunityId] = useState(context?.opportunityId ?? '')
  const [followUpType, setFollowUpType] = useState<FollowUpType>('call')
  const [dueDate, setDueDate] = useState(defaultSlot.dueDate)
  const [dueTime, setDueTime] = useState(defaultSlot.dueTime)
  const [priority, setPriority] = useState<OpportunityPriority>(defaultPriority)
  const [notes, setNotes] = useState('')
  const [outcomeMode, setOutcomeMode] = useState(false)
  const [outcome, setOutcome] = useState(OUTCOMES[0])
  const [lastFollowUpId, setLastFollowUpId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const sessionUser = getSessionUser()

  const dateMin = getDateInputMin()
  const timeMin = getTimeInputMin(dueDate)

  const openLeads = useMemo(
    () => leads.filter((l) => l.lifecycleStatus !== 'converted' && l.lifecycleStatus !== 'closed').slice(0, 200),
    [leads],
  )
  const openOpps = useMemo(
    () => opportunities.filter((o) => o.stage !== 'lost' && o.status !== 'lost').slice(0, 200),
    [opportunities],
  )

  useEffect(() => {
    if (!open) return
    if (followUp) {
      setCustomerId(followUp.customerId ?? '')
      setLeadId(followUp.leadId ?? '')
      setOpportunityId(followUp.opportunityId ?? '')
      setFollowUpType(followUp.followUpType)
      setDueDate(followUp.dueDate.slice(0, 10))
      setDueTime(followUp.dueTime || '10:00')
      setPriority(followUp.priority)
      setNotes(followUp.notes ?? '')
      setOutcomeMode(false)
      setLastFollowUpId(null)
    } else {
      const slot = suggestDefaultFollowUpSlot()
      setCustomerId(context?.customerId ?? '')
      setLeadId(context?.leadId ?? '')
      setOpportunityId(context?.opportunityId ?? '')
      setFollowUpType('call')
      setDueDate(slot.dueDate)
      setDueTime(slot.dueTime)
      setPriority(defaultPriority)
      setNotes('')
      setOutcomeMode(false)
      setLastFollowUpId(null)
    }
    setError(null)
    setFieldErrors({})
    setSubmitting(false)
  }, [open, followUp, defaultPriority, context?.customerId, context?.leadId, context?.opportunityId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const resolvedCustomerId = (customerId || context?.customerId || '').trim() || undefined
    const resolvedLeadId = (leadId || context?.leadId || '').trim() || undefined
    const resolvedOpportunityId = (opportunityId || context?.opportunityId || '').trim() || undefined
    if (!isEdit && !resolvedCustomerId && !resolvedLeadId && !resolvedOpportunityId) {
      setError('Select a company, lead, or opportunity for this follow-up.')
      return
    }
    const dueError = validateFollowUpAt({ dueDate, dueTime })
    if (dueError) {
      handleInvalidSubmit({
        errors: { dueDate: dueError, dueTime: dueError },
        fieldOrder: ['dueDate', 'dueTime'],
        fieldLabels: { dueDate: 'Due date', dueTime: 'Time' },
        notifyMessage: dueError,
        root: e.currentTarget,
        onFieldErrors: setFieldErrors,
      })
      setError(dueError)
      return
    }
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    void (async () => {
      try {
        if (isEdit && followUp) {
          const result = await resolveStoreAction(updateFollowUp(followUp.id, {
            followUpType,
            dueDate,
            dueTime,
            priority,
            notes,
          }))
          if (!result.ok) {
            setError(result.error ?? formatApiError('Failed to update follow-up'))
            return
          }
          onClose()
          return
        }
        const result = await resolveStoreAction(createFollowUp({
          followUpType,
          customerId: resolvedCustomerId ?? context?.customerId,
          contactId: context?.contactId,
          opportunityId: resolvedOpportunityId ?? context?.opportunityId,
          quotationId: context?.quotationId,
          leadId: resolvedLeadId ?? context?.leadId,
          assignedTo: context?.assignedTo ?? sessionUser.id,
          assignedToName: context?.assignedToName ?? sessionUser.name,
          dueDate,
          dueTime,
          priority,
          notes,
          reminder: true,
        }))
        if (!result.ok) {
          setError(result.error ?? formatApiError('Failed to schedule follow-up'))
          return
        }
        if (result.followUpId) {
          setLastFollowUpId(result.followUpId)
          onCreated?.()
          if (!outcomeMode) onClose()
        }
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const handleComplete = () => {
    if (!lastFollowUpId) return
    void resolveStoreAction(completeFollowUp(lastFollowUpId, outcome)).then(() => onClose())
  }

  return (
    <CrmDrawerShell
      open={open}
      placement="modal"
      title={isEdit ? 'Edit Follow-up' : 'Quick Follow-up'}
      subtitle={context?.leadName ?? (isEdit ? 'Update this follow-up' : 'Schedule the next customer touchpoint')}
      onClose={onClose}
      footer={
        <div className="flex w-full gap-2">
          <Button type="submit" form="crm-quick-followup-form" className="flex-1" disabled={submitting}>
            {isEdit ? 'Save Follow-up' : 'Schedule Follow-up'}
          </Button>
          {!isEdit && outcomeMode && lastFollowUpId ? (
            <Button type="button" variant="secondary" onClick={handleComplete}>
              Mark Done
            </Button>
          ) : null}
        </div>
      }
    >
      <form id="crm-quick-followup-form" onSubmit={handleSubmit} className="crm-drawer-form">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!isEdit && !contextLocksRelated ? (
          <>
            <FormField label="Company">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select company…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customerName}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Lead (optional)">
              <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">None</option>
                {openLeads.map((l) => (
                  <option key={l.id} value={l.id}>{l.leadNo} — {l.prospectName || l.contactPerson || 'Lead'}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Opportunity (optional)">
              <Select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                <option value="">None</option>
                {openOpps.map((o) => (
                  <option key={o.id} value={o.id}>{o.opportunityNo} — {o.opportunityName}</option>
                ))}
              </Select>
            </FormField>
          </>
        ) : null}
        <FormField label="Type">
          <Select value={followUpType} onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}>
            {followUpTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Due date" error={fieldErrors.dueDate}>
            <Input
              type="date"
              data-field="dueDate"
              value={dueDate}
              min={dateMin}
              error={Boolean(fieldErrors.dueDate)}
              onChange={(e) => {
                setDueDate(e.target.value)
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.dueDate
                  delete next.dueTime
                  return next
                })
              }}
            />
          </FormField>
          <FormField label="Time" error={fieldErrors.dueTime}>
            <Input
              type="time"
              data-field="dueTime"
              value={dueTime}
              min={timeMin}
              error={Boolean(fieldErrors.dueTime)}
              onChange={(e) => {
                setDueTime(e.target.value)
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.dueDate
                  delete next.dueTime
                  return next
                })
              }}
            />
          </FormField>
        </div>
        <FormField label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as OpportunityPriority)}>
            {resolvedPriorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        </FormField>
        {!isEdit ? (
          <>
            <label className="flex items-center gap-2 text-[13px] text-erp-text">
              <input type="checkbox" checked={outcomeMode} onChange={(e) => setOutcomeMode(e.target.checked)} />
              Mark done with outcome after save
            </label>
            {outcomeMode ? (
              <FormField label="Outcome">
                <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              </FormField>
            ) : null}
          </>
        ) : null}
      </form>
    </CrmDrawerShell>
  )
}
