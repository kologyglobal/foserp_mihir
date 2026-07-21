import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LeadSource } from '../../../types/sales'
import { useSalesStore } from '../../../store/salesStore'
import { resolveStoreAction } from '../../../store/storeAction'
import { notify } from '../../../store/toastStore'
import { formatApiError } from '../../../services/api/apiErrors'
import { useCrmOwnerOptions, useLeadSourceOptions } from '../../../hooks/useCrmMasters'
import { getSessionUser } from '../../../utils/permissions'
import { CompanyProspectSelect } from '../CompanyProspectSelect'
import { CrmDrawerShell } from '../CrmDrawerShell'
import { FormField } from '../../forms/FormField'
import { Input, Select, MobileInput } from '../../forms/Inputs'
import { Button } from '../../ui/Button'
import { ErpButton, ErpButtonGroup } from '../../erp/ErpButton'
import { Calendar, Eye, Route } from 'lucide-react'
import { validateMobileForCountry } from '../../../utils/validation/mobilePhone'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { useMasterStore } from '../../../store/masterStore'
import { validateEmail, normalizeEmail } from '../../../utils/validation/email'
import { useInlineFormValidation } from '../../../hooks/useInlineFormValidation'

interface QuickLeadDrawerProps {
  open: boolean
  onClose: () => void
  onCreated?: (leadId: string) => void
}

export function QuickLeadDrawer({ open, onClose, onCreated }: QuickLeadDrawerProps) {
  const navigate = useNavigate()
  const createLead = useSalesStore((s) => s.createLead)
  const ownerOptions = useCrmOwnerOptions()
  const sourceOptions = useLeadSourceOptions()
  const session = getSessionUser()

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [prospectName, setProspectName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<LeadSource>('other')
  const [ownerId, setOwnerId] = useState(ownerOptions[0]?.value ?? session.id)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null)
  const [savedLeadNo, setSavedLeadNo] = useState<string | null>(null)

  const phoneCountry =
    (customerId ? useMasterStore.getState().getCustomer(customerId)?.country : null)
    ?? DEFAULT_CUSTOMER_COUNTRY

  const inline = useInlineFormValidation(
    { prospectName, mobile, email },
    {
      prospectName: { required: true, message: 'Enter a company or prospect name.' },
      mobile: {
        validate: (v) => {
          const digits = String(v ?? '').trim()
          const mail = email.trim()
          if (!digits && !mail) return 'Provide a mobile number or email.'
          return validateMobileForCountry(digits, phoneCountry)
        },
      },
      email: {
        validate: (v) => {
          const mail = String(v ?? '').trim()
          const digits = mobile.trim()
          if (!mail && !digits) return 'Provide a mobile number or email.'
          return validateEmail(mail)
        },
      },
    },
  )

  useEffect(() => {
    if (!open) return
    setCustomerId(null)
    setProspectName('')
    setMobile('')
    setEmail('')
    setSource((sourceOptions[0]?.value as LeadSource) || 'other')
    setOwnerId(ownerOptions[0]?.value ?? session.id)
    setSubmitting(false)
    setError(null)
    setSavedLeadId(null)
    setSavedLeadNo(null)
    inline.resetTouched()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerOptions, session.id, sourceOptions])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    inline.touchAll()
    const name = prospectName.trim()
    if (!name) {
      const msg = 'Enter a company or prospect name.'
      setError(msg)
      notify.warning(msg)
      return
    }
    if (!mobile.trim() && !email.trim()) {
      const msg = 'Provide a mobile number or email.'
      setError(msg)
      notify.warning(msg)
      return
    }
    const mobileError = validateMobileForCountry(mobile, phoneCountry)
    if (mobileError) {
      setError(mobileError)
      notify.warning(mobileError)
      return
    }
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      notify.warning(emailError)
      return
    }
    const owner = ownerOptions.find((o) => o.value === ownerId) ?? { value: session.id, label: session.name }
    setSubmitting(true)
    setError(null)
    void (async () => {
      try {
        const r = await resolveStoreAction(
          createLead({
            prospectName: name,
            customerId,
            contactPerson: name,
            mobile: mobile.trim() || null,
            email: email.trim() ? normalizeEmail(email) : null,
            source,
            leadOwnerId: owner.value,
            leadOwnerName: owner.label,
            priority: 'medium',
            expectedValue: 0,
            probability: 20,
            stage: 'new',
            productRequirement: '',
            remarks: 'Quick lead capture',
            createdDate: new Date().toISOString().slice(0, 10),
            activityStatus: 'active',
            lifecycleStatus: 'open',
          }),
        )
        if (!r.ok || !r.leadId) {
          const msg = r.error ?? formatApiError('Failed to create lead')
          setError(msg)
          notify.error(msg)
          return
        }
        const lead = useSalesStore.getState().getLead(r.leadId)
        setSavedLeadId(r.leadId)
        setSavedLeadNo(lead?.leadNo ?? null)
        notify.success('Lead created')
        onCreated?.(r.leadId)
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <CrmDrawerShell
      open={open}
      placement="modal"
      title="Quick Lead"
      subtitle="Minimum capture — add qualification details when the deal is serious"
      onClose={onClose}
      footer={
        savedLeadId ? null : (
          <Button type="submit" form="crm-quick-lead-form" className="w-full" disabled={submitting}>
            Save Lead
          </Button>
        )
      }
    >
      {savedLeadId ? (
        <div className="space-y-3">
          <p className="text-[14px] font-semibold text-emerald-900">
            Lead saved{savedLeadNo ? ` — ${savedLeadNo}` : ''}
          </p>
          <p className="text-[13px] text-erp-muted">What would you like to do next?</p>
          <ErpButtonGroup>
            <ErpButton type="button" variant="primary" icon={Eye} onClick={() => { onClose(); navigate(`/crm/leads/${savedLeadId}`) }}>
              View Lead
            </ErpButton>
            <ErpButton
              type="button"
              variant="secondary"
              icon={Route}
              onClick={() => { onClose(); navigate(`/crm/guided-deal?leadId=${savedLeadId}&step=qualify`) }}
            >
              Continue Guided
            </ErpButton>
            <ErpButton
              type="button"
              variant="secondary"
              icon={Calendar}
              onClick={() => { onClose(); navigate(`/crm/leads/${savedLeadId}`) }}
            >
              Done
            </ErpButton>
          </ErpButtonGroup>
        </div>
      ) : (
        <form id="crm-quick-lead-form" onSubmit={handleSubmit} className="crm-drawer-form crm-form-surface">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <FormField label="Company / prospect" required error={inline.fieldError('prospectName')}>
            <CompanyProspectSelect
              value={{ customerId, prospectName }}
              onChange={(v) => {
                setCustomerId(v.customerId)
                setProspectName(v.prospectName)
                inline.touch('prospectName')
              }}
              error={Boolean(inline.fieldError('prospectName'))}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mobile" error={inline.fieldError('mobile')}>
              <MobileInput
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onBlur={() => inline.touch('mobile')}
                error={Boolean(inline.fieldError('mobile'))}
              />
            </FormField>
            <FormField label="Email" error={inline.fieldError('email')}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => inline.touch('email')}
                error={Boolean(inline.fieldError('email'))}
              />
            </FormField>
          </div>
          <FormField label="Source" required>
            <Select value={source} onChange={(e) => setSource(e.target.value as LeadSource)}>
              {(sourceOptions.length
                ? sourceOptions
                : [
                    { value: 'website', label: 'Website' },
                    { value: 'referral', label: 'Referral' },
                    { value: 'other', label: 'Other' },
                  ]
              ).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Owner" required>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {ownerOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>
        </form>
      )}
    </CrmDrawerShell>
  )
}
