import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LeadSource } from '../../../types/sales'
import { useSalesStore } from '../../../store/salesStore'
import { resolveStoreAction } from '../../../store/storeAction'
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
  }, [open, ownerOptions, session.id, sourceOptions])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const name = prospectName.trim()
    if (!name) {
      setError('Enter a company or prospect name.')
      return
    }
    if (!mobile.trim() && !email.trim()) {
      setError('Provide a mobile number or email.')
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
            mobile: mobile.trim() || null,
            email: email.trim() || null,
            source,
            leadOwnerId: owner.value,
            leadOwnerName: owner.label,
            priority: 'medium',
            expectedValue: 0,
            probability: 20,
            stage: 'new',
            productRequirement: '',
            createdDate: new Date().toISOString().slice(0, 10),
            activityStatus: 'active',
            lifecycleStatus: 'open',
          }),
        )
        if (!r.ok || !r.leadId) {
          setError(r.error ?? formatApiError('Failed to create lead'))
          return
        }
        const lead = useSalesStore.getState().getLead(r.leadId)
        setSavedLeadId(r.leadId)
        setSavedLeadNo(lead?.leadNo ?? null)
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
        <form id="crm-quick-lead-form" onSubmit={handleSubmit} className="crm-drawer-form">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <FormField label="Company / prospect" required hint="Search master or type a new prospect name">
            <CompanyProspectSelect
              value={{ customerId, prospectName }}
              onChange={(v) => {
                setCustomerId(v.customerId)
                setProspectName(v.prospectName)
              }}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mobile">
              <MobileInput value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
