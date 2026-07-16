import { useState, useMemo, useEffect } from 'react'
import { reserveCode, confirmCode } from '../../services/codeSeriesService'
import { useNavigate } from 'react-router-dom'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { useMasterStore } from '../../store/masterStore'
import { getSessionUser } from '../../utils/permissions'
import type { CrmActivity, CrmActivityType, OpportunityPriority, OpportunityStage } from '../../types/crm'
import { useCrmOwnerOptions, useOpportunityPriorityOptions, useActivityTypeOptions, useDesignationOptions, useDepartmentOptions } from '../../hooks/useCrmMasters'
import { resolveOpportunityPriorityOptions, buildHubSpotStyleOpportunityName } from '../../utils/opportunityUtils'
import { CrmDrawerShell } from './CrmDrawerShell'
import { FormField } from '../forms/FormField'
import { Input, Select, Textarea, MobileInput } from '../forms/Inputs'
import { Button } from '../ui/Button'

const FALLBACK_ACTIVITY_TYPES: { id: CrmActivityType; label: string }[] = [
  { id: 'call', label: 'Call' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'site_visit', label: 'Site Visit' },
  { id: 'note', label: 'Note' },
]

export function NewContactDrawer({
  open,
  onClose,
  defaultCustomerId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  defaultCustomerId?: string | null
  onCreated?: (contactId: string) => void
}) {
  const createContact = useCrmStore((s) => s.createContact)
  const customers = useMasterStore((s) => s.customers)
  const designationOptions = useDesignationOptions()
  const departmentOptions = useDepartmentOptions()
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '')
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('Purchase Head')
  const [department, setDepartment] = useState('Procurement')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const lockCustomer = Boolean(defaultCustomerId)

  useEffect(() => {
    if (!open) return
    setCustomerId(defaultCustomerId ?? '')
    setName('')
    setEmail('')
    setPhone('')
    setIsPrimary(false)
    setError(null)
  }, [open, defaultCustomerId])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    let contactCode = ''
    try {
      contactCode = reserveCode('contact')
    } catch {
      setError('Code Series is not configured for contacts')
      return
    }
    setSubmitting(true)
    void (async () => {
      try {
        const r = await resolveStoreAction(createContact({
          contactCode,
          customerId,
          name,
          designation,
          department,
          email,
          phone,
          isPrimary,
        }))
        if (!r.ok) {
          setError(r.error ?? 'Failed to create contact')
          return
        }
        confirmCode('contact', contactCode)
        if (r.contactId) onCreated?.(r.contactId)
        onClose()
        setName('')
        setEmail('')
        setPhone('')
        setError(null)
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <CrmDrawerShell
      open={open}
      title="New Contact"
      subtitle="Add a contact to a company record"
      onClose={onClose}
      footer={
        <Button type="submit" form="crm-new-contact-form" className="w-full" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Contact'}
        </Button>
      }
    >
      <form id="crm-new-contact-form" onSubmit={submit} className="crm-drawer-form">
        <FormField label="Customer" required>
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            disabled={lockCustomer}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customerName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField label="Designation">
          <Select value={designation} onChange={(e) => setDesignation(e.target.value)}>
            <option value="">— Select —</option>
            {designationOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Department">
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">— Select —</option>
            {departmentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Phone">
          <MobileInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
        </FormField>
        <label className="flex items-center gap-2 text-[13px] text-erp-text">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary contact for customer
        </label>
        {error ? <p className="text-[12px] font-medium text-erp-danger-fg">{error}</p> : null}
      </form>
    </CrmDrawerShell>
  )
}

export function NewOpportunityDrawer({
  open,
  onClose,
  defaultCustomerId,
  onCreated,
  navigateOnCreate = true,
}: {
  open: boolean
  onClose: () => void
  defaultCustomerId?: string | null
  onCreated?: (opportunityId: string) => void
  /** When false, skips navigation after create (e.g. Guided Deal host). */
  navigateOnCreate?: boolean
}) {
  const navigate = useNavigate()
  const createOpportunity = useCrmStore((s) => s.createOpportunity)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const contacts = useCrmStore((s) => s.contacts)
  const user = getSessionUser()
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '')
  const [contactId, setContactId] = useState('')
  const [productId, setProductId] = useState('')
  const [opportunityName, setOpportunityName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [productRequirement, setProductRequirement] = useState('')
  const [value, setValue] = useState('0')
  const [probability, setProbability] = useState('20')
  const [showMore, setShowMore] = useState(false)
  const [expectedCloseDate, setExpectedCloseDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const ownerOptions = useCrmOwnerOptions()
  const priorityOptions = useOpportunityPriorityOptions()
  const resolvedPriorities = useMemo(
    () => (priorityOptions.length > 0 ? priorityOptions : resolveOpportunityPriorityOptions().map((p) => ({ value: p.value, label: p.label }))),
    [priorityOptions],
  )
  const defaultPriority = (resolvedPriorities[0]?.value ?? 'medium') as OpportunityPriority

  const [ownerId, setOwnerId] = useState(ownerOptions[0]?.value ?? user.id)
  const [priority, setPriority] = useState<OpportunityPriority>(defaultPriority)
  const [error, setError] = useState<string | null>(null)

  const customerContacts = contacts.filter((c) => c.customerId === customerId)
  const owner = ownerOptions.find((o) => o.value === ownerId) ?? { value: user.id, label: user.name }
  const customer = customers.find((c) => c.id === customerId)
  const productName = products.find((p) => p.id === productId)?.productName
  const contactName = customerContacts.find((c) => c.id === contactId)?.name

  useEffect(() => {
    if (!open) return
    setCustomerId(defaultCustomerId ?? '')
    setContactId('')
    setProductId('')
    setOpportunityName('')
    setNameManuallyEdited(false)
    setProductRequirement('')
    setValue('0')
    setProbability('20')
    setShowMore(false)
    setError(null)
    setOwnerId(ownerOptions[0]?.value ?? user.id)
    setPriority(defaultPriority)
  }, [open, defaultCustomerId, defaultPriority, ownerOptions, user.id])

  useEffect(() => {
    if (nameManuallyEdited) return
    const next = buildHubSpotStyleOpportunityName({
      companyName: customer?.customerName,
      productName,
      contactName,
    })
    if (!next) return
    setOpportunityName((prev) => (prev === next ? prev : next))
  }, [customer?.customerName, productName, contactName, nameManuallyEdited])

  function handleOpportunityNameChange(value: string) {
    setOpportunityName(value)
    if (!value.trim()) {
      setNameManuallyEdited(false)
      return
    }
    const nextAuto = buildHubSpotStyleOpportunityName({
      companyName: customer?.customerName,
      productName,
      contactName,
    })
    setNameManuallyEdited(value.trim() !== nextAuto)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void (async () => {
      const r = await resolveStoreAction(
        createOpportunity({
          customerId,
          contactId: contactId || null,
          productId: productId || null,
          opportunityName,
          productRequirement: productRequirement || opportunityName,
          stage: 'new_lead' as OpportunityStage,
          value: Number(value) || 0,
          probability: Number(probability) || 0,
          expectedCloseDate,
          ownerId: owner.value,
          ownerName: owner.label,
          priority,
          status: 'open',
          lostReason: null,
          inquiryId: null,
          quotationId: null,
          salesOrderId: null,
          leadId: null,
          nextFollowUpDate: null,
          lines: [],
        }),
      )
      if (!r.ok) {
        setError(r.error ?? 'Failed to create opportunity')
        return
      }
      if (r.opportunityId) {
        onCreated?.(r.opportunityId)
        if (navigateOnCreate) navigate(`/crm/opportunities/${r.opportunityId}`)
      }
      onClose()
      setError(null)
    })()
  }

  return (
    <CrmDrawerShell
      open={open}
      title="Quick Opportunity"
      subtitle="Company + name first — products and value when the deal is serious"
      onClose={onClose}
      width="lg"
      footer={
        <Button type="submit" form="crm-new-opp-form" className="w-full">
          Create Opportunity
        </Button>
      }
    >
      <form id="crm-new-opp-form" onSubmit={submit} className="crm-drawer-form">
        <FormField label="Customer" required>
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setContactId('')
            }}
            required
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customerName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Contact">
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">—</option>
            {customerContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Opportunity name"
          required
          hint={nameManuallyEdited ? 'Custom name — clear to resume auto-naming' : 'Auto-filled from company / product'}
        >
          <Input
            value={opportunityName}
            onChange={(e) => handleOpportunityNameChange(e.target.value)}
            placeholder="Select a company to auto-name"
            required
          />
        </FormField>
        <FormField label="Owner" required>
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {ownerOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>
        <button
          type="button"
          className="text-left text-[12px] font-semibold text-erp-primary hover:underline"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? 'Hide additional details' : 'Add more details (optional)'}
        </button>
        {showMore ? (
          <>
            <FormField label="Product requirement">
              <Textarea value={productRequirement} onChange={(e) => setProductRequirement(e.target.value)} rows={3} />
            </FormField>
            <FormField label="Product">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">—</option>
                {products.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>{p.productName}</option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Value (₹)">
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              </FormField>
              <FormField label="Probability %">
                <Input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Expected close date">
              <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
            </FormField>
            <FormField label="Priority">
              <Select value={priority} onChange={(e) => setPriority(e.target.value as OpportunityPriority)}>
                {resolvedPriorities.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </FormField>
          </>
        ) : null}
        {error ? <p className="text-[12px] font-medium text-erp-danger-fg">{error}</p> : null}
      </form>
    </CrmDrawerShell>
  )
}

export function LogActivityDrawer({
  open,
  onClose,
  context,
  activity,
}: {
  open: boolean
  onClose: () => void
  context?: {
    customerId?: string | null
    contactId?: string | null
    opportunityId?: string | null
    leadId?: string | null
    leadName?: string
    lockLead?: boolean
  }
  /** When set, drawer edits this activity instead of creating. */
  activity?: CrmActivity | null
}) {
  const createActivity = useCrmStore((s) => s.createActivity)
  const updateActivity = useCrmStore((s) => s.updateActivity)
  const customers = useMasterStore((s) => s.customers)
  const opportunities = useCrmStore((s) => s.opportunities)
  const user = getSessionUser()
  const activityTypeOptions = useActivityTypeOptions()
  const activityTypes = useMemo(
    () => (activityTypeOptions.length > 0
      ? activityTypeOptions.map((t) => ({ id: t.value as CrmActivityType, label: t.label }))
      : FALLBACK_ACTIVITY_TYPES),
    [activityTypeOptions],
  )
  const isEdit = Boolean(activity)
  const [type, setType] = useState<CrmActivityType>('call')
  const [customerId, setCustomerId] = useState(context?.customerId ?? '')
  const [opportunityId, setOpportunityId] = useState(context?.opportunityId ?? '')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [outcome, setOutcome] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLeadContext = Boolean(context?.leadId || activity?.leadId)

  useEffect(() => {
    if (!open) return
    if (activity) {
      setType(activity.type)
      setCustomerId(activity.customerId ?? context?.customerId ?? '')
      setOpportunityId(activity.opportunityId ?? context?.opportunityId ?? '')
      setSubject(activity.subject)
      setDescription(activity.description ?? '')
      setOutcome(activity.outcome ?? '')
    } else {
      setType('call')
      setCustomerId(context?.customerId ?? '')
      setOpportunityId(context?.opportunityId ?? '')
      setSubject('')
      setDescription('')
      setOutcome('')
    }
    setError(null)
    setSubmitting(false)
  }, [open, activity, context?.customerId, context?.opportunityId])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    void (async () => {
      try {
        const r = await resolveStoreAction(
          isEdit && activity
            ? updateActivity(activity.id, {
                type,
                subject: subject || `${type.replace(/_/g, ' ')} logged`,
                description: description || subject,
                outcome: outcome || null,
              })
            : createActivity({
                type,
                subject: subject || `${type.replace(/_/g, ' ')} logged`,
                description: description || subject,
                customerId: customerId || null,
                contactId: context?.contactId ?? null,
                opportunityId: isLeadContext ? null : opportunityId || null,
                leadId: context?.leadId ?? null,
                ownerId: user.id,
                ownerName: user.name,
                outcome: outcome || null,
              }),
        )
        if (!r.ok) {
          setError(r.error ?? formatApiError(isEdit ? 'Failed to update activity' : 'Failed to log activity'))
          return
        }
        onClose()
        if (!isEdit) {
          setSubject('')
          setDescription('')
          setOutcome('')
        }
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <CrmDrawerShell
      open={open}
      placement="modal"
      title={isEdit ? 'Edit Activity' : 'Log Activity'}
      subtitle={context?.leadName ?? (isEdit ? 'Update this logged activity' : 'Record a call, meeting, or note')}
      onClose={onClose}
      footer={
        <Button type="submit" form="crm-log-activity-form" className="w-full" disabled={submitting}>
          {isEdit ? 'Save Activity' : 'Log Activity'}
        </Button>
      }
    >
      <form id="crm-log-activity-form" onSubmit={submit} className="crm-drawer-form">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <FormField label="Activity type">
          <Select value={type} onChange={(e) => setType(e.target.value as CrmActivityType)}>
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </FormField>
        {!isLeadContext && !isEdit ? (
          <>
            <FormField label="Customer">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customerName}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Opportunity">
              <Select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                <option value="">—</option>
                {opportunities
                  .filter((o) => !customerId || o.customerId === customerId)
                  .slice(0, 50)
                  .map((o) => (
                    <option key={o.id} value={o.id}>{o.opportunityName}</option>
                  ))}
              </Select>
            </FormField>
          </>
        ) : null}
        <FormField label="Subject" required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" required />
        </FormField>
        <FormField label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What was discussed?"
          />
        </FormField>
        <FormField label="Outcome" hint="Optional result of this activity">
          <Input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Customer interested"
          />
        </FormField>
      </form>
    </CrmDrawerShell>
  )
}
