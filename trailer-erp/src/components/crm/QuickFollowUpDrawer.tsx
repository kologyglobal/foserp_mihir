import { useState, useMemo } from 'react'
import type { FollowUpType, OpportunityPriority } from '../../types/crm'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { useOpportunityPriorityOptions, useFollowUpTypeOptions } from '../../hooks/useCrmMasters'
import { resolveOpportunityPriorityOptions } from '../../utils/opportunityUtils'
import { getSessionUser } from '../../utils/permissions'
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
}

export function QuickFollowUpDrawer({ open, onClose, context, onCreated }: QuickFollowUpDrawerProps) {
  const createFollowUp = useCrmStore((s) => s.createFollowUp)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
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
  const [followUpType, setFollowUpType] = useState<FollowUpType>('call')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueTime, setDueTime] = useState('10:00')
  const [priority, setPriority] = useState<OpportunityPriority>(defaultPriority)
  const [notes, setNotes] = useState('')
  const [outcomeMode, setOutcomeMode] = useState(false)
  const [outcome, setOutcome] = useState(OUTCOMES[0])
  const [lastFollowUpId, setLastFollowUpId] = useState<string | null>(null)
  const sessionUser = getSessionUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void (async () => {
      const result = await resolveStoreAction(createFollowUp({
        followUpType,
        customerId: context?.customerId,
        contactId: context?.contactId,
        opportunityId: context?.opportunityId,
        quotationId: context?.quotationId,
        leadId: context?.leadId,
        assignedTo: context?.assignedTo ?? sessionUser.id,
        assignedToName: context?.assignedToName ?? sessionUser.name,
        dueDate,
        dueTime,
        priority,
        notes,
        reminder: true,
      }))
      if (result.ok && result.followUpId) {
        setLastFollowUpId(result.followUpId)
        onCreated?.()
        if (!outcomeMode) onClose()
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
      title="Quick Follow-up"
      subtitle={context?.leadName ?? 'Schedule the next customer touchpoint'}
      onClose={onClose}
      footer={
        <div className="flex w-full gap-2">
          <Button type="submit" form="crm-quick-followup-form" className="flex-1">
            Schedule Follow-up
          </Button>
          {outcomeMode && lastFollowUpId ? (
            <Button type="button" variant="secondary" onClick={handleComplete}>
              Mark Done
            </Button>
          ) : null}
        </div>
      }
    >
      <form id="crm-quick-followup-form" onSubmit={handleSubmit} className="crm-drawer-form">
        <FormField label="Type">
          <Select value={followUpType} onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}>
            {followUpTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FormField>
          <FormField label="Time">
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
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
      </form>
    </CrmDrawerShell>
  )
}
