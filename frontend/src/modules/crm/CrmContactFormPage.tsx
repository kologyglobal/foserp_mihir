import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Building2,
  Mail,
  Paperclip,
  Phone,
  Save,
  User,
  UserCircle,
} from 'lucide-react'
import { Input, Checkbox, Select, MobileInput } from '../../components/forms/Inputs'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar, ErpQuickEntrySection, ErpAdditionalInfoToggle, ErpAdditionalInfoPanel, useErpAdditionalInfo } from '../../components/erp/card-form'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { useMasterStore } from '../../store/masterStore'
import { useDesignationOptions, useDepartmentOptions } from '../../hooks/useCrmMasters'
import { contactEditBreadcrumbs, contactNewBreadcrumbs } from '../../utils/crmContactNavigation'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { formatDate } from '../../utils/dates/format'
import { TableLink } from '../../components/ui/AppLink'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { MasterCodeField } from '../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../hooks/useMasterCodeSeries'
import { useContactAttachmentStore } from '../../store/contactAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import {
  buildContactAiInsight,
  buildContactKeyDetails,
  buildContactSmartSignals,
  computeContactCompleteness,
  contactOverviewChips,
  contactOverviewTitle,
  resolveContactNextBestAction,
} from '../../utils/contactSmartOverview'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../config/countries'
import { normalizeEmail } from '../../utils/validation/email'
import {
  buildContactSchema,
  CONTACT_FIELD_ORDER,
  CONTACT_SECTION_BY_FIELD,
  type ContactFormData,
} from '../../utils/validation/crmSchemas/contactSchema'
import {
  handleInvalidSubmit,
  rhfErrorsToFieldMap,
  crmShowCompletenessHints,
} from '../../utils/formValidation'

type FormData = ContactFormData

export function CrmContactFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillCustomerId = searchParams.get('customerId') ?? ''
  const duplicateFromId = searchParams.get('duplicateFrom') ?? ''

  const existing = useCrmStore((s) => (id ? s.getContact(id) : undefined))
  const duplicateSource = useCrmStore((s) => (duplicateFromId ? s.getContact(duplicateFromId) : undefined))
  const contacts = useCrmStore((s) => s.contacts)
  const createContact = useCrmStore((s) => s.createContact)
  const updateContact = useCrmStore((s) => s.updateContact)
  const customers = useMasterStore((s) => s.customers)
  const designationOptions = useDesignationOptions()
  const departmentOptions = useDepartmentOptions()
  const isEdit = Boolean(id && existing)
  const prefill = existing ?? duplicateSource
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)
  const formRootRef = useRef<HTMLDivElement | null>(null)
  const [sectionForceOpenKey, setSectionForceOpenKey] = useState(0)
  const phoneCountryRef = useRef<string>(DEFAULT_CUSTOMER_COUNTRY)

  const [activeSection, setActiveSection] = useState('quick')

  const attachmentScopeId = id ?? 'draft:new-contact'
  const setContactAttachments = useContactAttachmentStore((s) => s.setForContact)
  const bindDraftAttachments = useContactAttachmentStore((s) => s.bindDraftToContact)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useContactAttachmentStore.getState().getForContact(attachmentScopeId),
  )

  useEffect(() => {
    setAttachmentsState(useContactAttachmentStore.getState().getForContact(attachmentScopeId))
  }, [attachmentScopeId])

  function setAttachments(next: CrmTypedAttachment[]) {
    setAttachmentsState(next)
    setContactAttachments(attachmentScopeId, next)
  }

  const contactSchema = useMemo(
    () => buildContactSchema(() => phoneCountryRef.current),
    [],
  )

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting, isDirty, isSubmitted } } = useForm<FormData>({
    resolver: zodResolver(contactSchema) as Resolver<FormData>,
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: prefill
      ? {
          contactCode: duplicateSource && !existing ? '' : (prefill.contactCode ?? ''),
          customerId: prefill.customerId,
          name: duplicateSource && !existing ? `${prefill.name} (Copy)` : prefill.name,
          designation: prefill.designation ?? '',
          department: prefill.department ?? '',
          email: duplicateSource && !existing ? '' : (prefill.email ?? ''),
          phone: duplicateSource && !existing ? '' : (prefill.phone ?? ''),
          isPrimary: duplicateSource && !existing ? false : prefill.isPrimary,
          isActive: prefill.isActive ?? true,
        }
      : {
          contactCode: '',
          customerId: prefillCustomerId,
          name: '',
          designation: '',
          department: '',
          email: '',
          phone: '',
          isPrimary: false,
          isActive: true,
        },
  })
  const [formInstanceKey, setFormInstanceKey] = useState(0)

  const watched = useWatch({ control })

  const customer = useMemo(
    () => customers.find((c) => c.id === watched.customerId),
    [customers, watched.customerId],
  )
  phoneCountryRef.current = customer?.country?.trim() || DEFAULT_CUSTOMER_COUNTRY

  const companyOptions = useMemo(
    () => customers
      .filter((c) => c.isActive)
      .map((c) => ({
        value: c.id,
        label: `${c.customerName} · ${c.customerCode}`,
        searchText: `${c.customerName} ${c.customerCode} ${c.city} ${c.salesTerritory}`.toLowerCase(),
      })),
    [customers],
  )

  const profileDone = Boolean(watched.name?.trim())
  const companyDone = Boolean(watched.customerId?.trim())
  const communicationDone = Boolean(watched.phone?.trim() || watched.email?.trim())

  const completionItems = useMemo(() => [
    { id: 'profile', label: 'Profile', done: profileDone },
    { id: 'company', label: 'Company', done: companyDone },
    { id: 'communication', label: 'Communication', done: communicationDone },
    { id: 'documents', label: 'Attachments', done: attachments.length > 0 },
  ], [profileDone, companyDone, communicationDone, attachments.length])

  const requiredComplete = [profileDone, companyDone].filter(Boolean).length
  const completionPercent = Math.round((requiredComplete / 2) * 100)

  const hasOptionalContactData = Boolean(
    watched.contactCode?.trim()
    || watched.department?.trim()
    || attachments.length > 0
    || watched.isActive === false,
  )
  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    preferOpen: isEdit && hasOptionalContactData,
  })
  const additionalSectionCount = 2
  const additionalAttentionCount = [
    !(watched.contactCode?.trim() || watched.department?.trim()),
    attachments.length === 0,
  ].filter(Boolean).length

  const sectionNavItems = useMemo(() => {
    const quick = { id: 'quick', label: 'Quick', icon: UserCircle, done: Boolean(profileDone && companyDone) }
    if (!showAdditionalDetails) return [quick]
    return [
      quick,
      { id: 'details', label: 'Details', icon: Building2, done: Boolean(watched.contactCode?.trim()) },
      { id: 'documents', label: 'Attachments', icon: Paperclip, done: completionItems.find((i) => i.id === 'documents')?.done },
    ]
  }, [profileDone, companyDone, showAdditionalDetails, watched.contactCode, completionItems])

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${requiredComplete} of 2 required sections` },
    { label: 'Company', value: customer?.customerName?.slice(0, 18) || 'Pending', accent: customer ? ('green' as const) : ('amber' as const), hint: customer?.customerCode ?? 'Link to a company' },
    { label: 'Primary', value: watched.isPrimary ? 'Yes' : 'No', accent: watched.isPrimary ? ('violet' as const) : ('amber' as const), hint: watched.isPrimary ? 'Default on company card' : 'Secondary contact' },
    { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive', accent: watched.isActive ? ('green' as const) : ('amber' as const), hint: watched.designation?.trim() || 'No designation' },
  ], [completionPercent, requiredComplete, customer, watched.isPrimary, watched.isActive, watched.designation])

  const documentStrip = [
    { label: 'Contact', value: watched.name?.trim() || 'New', highlight: Boolean(watched.name?.trim()) },
    { label: 'Code', value: watched.contactCode?.trim() || '—', highlight: Boolean(watched.contactCode?.trim()) },
    { label: 'Company', value: customer?.customerName || '—', highlight: Boolean(customer) },
    { label: 'Company Code', value: customer?.customerCode || '—' },
    { label: 'Territory', value: customer?.salesTerritory || '—' },
    { label: 'Designation', value: watched.designation?.trim() || '—' },
    { label: 'Department', value: watched.department?.trim() || '—' },
    { label: 'Phone', value: watched.phone?.trim() || '—' },
    { label: 'Email', value: watched.email?.trim() || '—' },
  ]

  function scrollToSection(sectionId: string) {
    const additionalIds = new Set(['details', 'documents'])
    const needsExpand = additionalIds.has(sectionId) && !showAdditionalDetails
    if (needsExpand) setShowAdditionalDetails(true)
    setActiveSection(sectionId)
    window.setTimeout(() => {
      document.getElementById(`contact-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, needsExpand ? 300 : 0)
  }

  function showToast(message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') {
    if (variant === 'success') notify.success(message)
    else if (variant === 'error') notify.failed(message)
    else if (variant === 'warning') notify.warning(message)
    else notify.info(message)
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/crm/contacts')
  }

  function onContactInvalid(rhfErrors: Record<string, unknown>) {
    handleInvalidSubmit({
      errors: rhfErrorsToFieldMap(rhfErrors),
      fieldOrder: [...CONTACT_FIELD_ORDER],
      sectionByField: CONTACT_SECTION_BY_FIELD,
      root: formRootRef.current,
      expandSection: (sectionId) => {
        if (sectionId === 'contact-section-details' && !showAdditionalDetails) {
          setShowAdditionalDetails(true)
        }
        setActiveSection(sectionId === 'contact-section-details' ? 'details' : 'quick')
        setSectionForceOpenKey((k) => k + 1)
      },
    })
  }

  const submit = handleSubmit(async (data) => {
    await saveContact('default', data)
  }, onContactInvalid)

  async function saveContact(
    mode: 'default' | 'new' | 'close',
    data?: Parameters<Parameters<typeof handleSubmit>[0]>[0],
  ) {
    const run = async (formData: NonNullable<typeof data>) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(formData.contactCode, {
        checkDuplicate: (c) => contacts.some((x) => x.contactCode === c && x.id !== id),
      })
      if (validation && !validation.ok) {
        showToast(validation.message ?? 'Invalid contact code', 'warning')
        return
      }

      const payload = {
        contactCode: formData.contactCode.trim(),
        customerId: formData.customerId,
        name: formData.name.trim(),
        designation: formData.designation?.trim() ?? '',
        department: formData.department?.trim() ?? '',
        email: formData.email?.trim() ? normalizeEmail(formData.email) : '',
        phone: formData.phone?.trim() ?? '',
        isPrimary: formData.isPrimary ?? false,
        isActive: formData.isActive ?? true,
      }

      if (isEdit && id) {
        const result = await resolveStoreAction(updateContact(id, payload))
        if (!result.ok) {
          showToast(result.error ?? 'Could not save contact', 'error')
          return
        }
        setContactAttachments(id, attachments)
        showToast('Contact updated', 'success')
        if (mode === 'close') navigate('/crm/contacts')
        else navigate(`/crm/contacts/${id}`)
        return
      }

      const result = await resolveStoreAction(createContact(payload))
      if (!result.ok) {
        showToast(result.error ?? 'Could not create contact', 'error')
        return
      }
      if (result.contactId) {
        bindDraftAttachments(attachmentScopeId, result.contactId)
        setContactAttachments(result.contactId, attachments.map((a) => ({ ...a, contactId: result.contactId })))
      }
      codeSeriesRef.current?.confirmSaved(formData.contactCode)

      if (mode === 'new') {
        setAttachments([])
        reset({
          contactCode: '',
          customerId: prefillCustomerId,
          name: '',
          designation: '',
          department: '',
          email: '',
          phone: '',
          isPrimary: false,
          isActive: true,
        })
        setFormInstanceKey((k) => k + 1)
        setActiveSection('profile')
        showToast('Contact created — form cleared for next entry', 'success')
        navigate('/crm/contacts/new', { replace: true })
        return
      }

      showToast('Contact created', 'success')
      if (mode === 'close') {
        navigate('/crm/contacts')
        return
      }
      if (result.contactId) navigate(`/crm/contacts/${result.contactId}`)
      else navigate('/crm/contacts')
    }

    if (data) {
      await run(data)
      return
    }
    await handleSubmit((formData) => run(formData), onContactInvalid)()
  }

  const recordTitle = watched.name?.trim() || (isEdit ? 'Edit Contact' : 'New Contact')

  const commandBarMoreActions = [
    ...(isEdit && id
      ? [{ id: '360', label: 'View 360', icon: User, onClick: () => navigate(`/crm/contacts/${id}`) }]
      : []),
    ...(customer
      ? [{ id: 'company', label: 'Company 360', icon: Building2, onClick: () => navigate(entity360CustomerPath(customer.id)) }]
      : []),
  ]
  const smartOverviewInput = useMemo(() => ({
    name: watched.name ?? '',
    customerId: watched.customerId?.trim() || null,
    customerName: customer?.customerName ?? '',
    designation: watched.designation ?? '',
    department: watched.department ?? '',
    phone: watched.phone ?? '',
    email: watched.email ?? '',
    isPrimary: Boolean(watched.isPrimary),
    isActive: watched.isActive ?? true,
    attachmentCount: attachments.length,
  }), [
    watched.name,
    watched.customerId,
    customer?.customerName,
    watched.designation,
    watched.department,
    watched.phone,
    watched.email,
    watched.isPrimary,
    watched.isActive,
    attachments.length,
  ])

  const nextAction = resolveContactNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart contact overview"
      title={contactOverviewTitle(smartOverviewInput)}
      chips={contactOverviewChips(smartOverviewInput)}
      meta={[
        customer?.customerName ? `Company: ${customer.customerName}` : 'No company linked',
        watched.designation?.trim() || 'No designation',
      ]}
      progressLabel="Contact readiness"
      progressPercent={computeContactCompleteness(smartOverviewInput)}
      signals={buildContactSmartSignals(smartOverviewInput)}
      showGapSignals={crmShowCompletenessHints({
        isEdit,
        dirty: isDirty,
        saveAttempted: isSubmitted,
      })}
      nextAction={nextAction}
      onNextAction={() => {
        scrollToSection(nextAction.sectionId ?? 'quick')
      }}
      quickActions={[
        {
          id: 'save',
          label: 'Save',
          icon: Save,
          onClick: () => void submit(),
          disabled: isSubmitting,
        },
        {
          id: 'list',
          label: 'Contacts list',
          icon: User,
          onClick: () => navigate('/crm/contacts'),
        },
        {
          id: 'company',
          label: 'Company 360',
          icon: Building2,
          onClick: () => {
            if (customer) navigate(entity360CustomerPath(customer.id))
          },
          disabled: !customer,
        },
      ]}
      keyDetails={buildContactKeyDetails(smartOverviewInput)}
      aiInsight={buildContactAiInsight(smartOverviewInput)}
    />
  )

  if (isEdit && !existing) {
    return (
      <CrmCardFormShell
        title="Contact not found"
        breadcrumbs={contactEditBreadcrumbs()}
        footer={null}
      >
        <p className="text-sm text-erp-muted">This contact could not be loaded.</p>
      </CrmCardFormShell>
    )
  }

  return (
    <>
      <CrmCardFormShell
        title={isEdit ? 'Edit Contact' : 'New Contact'}
        className={`${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`}
        recordNo={isEdit ? existing?.id.slice(-8).toUpperCase() : 'New'}
        recordTitle={recordTitle}
        status={watched.isActive ? 'Active' : 'Inactive'}
        statusTone={watched.isActive ? 'success' : 'warning'}
        stage={watched.isPrimary ? 'Primary' : 'Secondary'}
        createdDate={formatDate(existing?.createdAt ?? new Date().toISOString())}
        company={customer?.customerName}
        favoritePath={isEdit ? `/crm/contacts/${id}/edit` : '/crm/contacts/new'}
        breadcrumbs={isEdit ? contactEditBreadcrumbs(existing?.name) : contactNewBreadcrumbs()}
        formSaveActions={{
          isSubmitting,
          saveLabel: isEdit ? 'Save' : 'Save',
          onSave: () => void saveContact('default'),
          onSaveAndNew: isEdit ? undefined : () => void saveContact('new'),
          onSaveAndClose: () => void saveContact('close'),
          onCancel: cancelForm,
          moreActions: commandBarMoreActions.length ? commandBarMoreActions : undefined,
        }}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Smart Context"
        onSubmit={submit}
        onSaveShortcut={() => void saveContact('default')}
        onSaveCloseShortcut={() => void saveContact('close')}
        onSaveAndNewShortcut={isEdit ? undefined : () => void saveContact('new')}
        formId="crm-contact-form"
        stickyFooter
        footer={(
          <ErpStickySaveBar
            sticky
            isSubmitting={isSubmitting}
            submitLabel="Save"
            onCancel={cancelForm}
            onSave={() => void saveContact('default')}
            onSaveAndNew={isEdit ? undefined : () => void saveContact('new')}
            onSaveAndClose={() => void saveContact('close')}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete · {requiredComplete}/2 required sections
                {Object.keys(errors).length > 0 ? ' · Fix highlighted fields' : ''}
                {' · Ctrl+S Save · Ctrl+Shift+S Save & Close'}
                {!isEdit ? ' · Alt+N Save & New' : ''}
              </span>
            )}
          />
        )}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        <div ref={formRootRef} className="erp-form-body">
        <ErpQuickEntrySection
          id="contact-section-quick"
          title="Quick Entry"
          subtitle="Name, company, and reach — enough to create the contact."
        >
          <div data-field="contactCode">
            <MasterCodeField
              key={`contact-code-${formInstanceKey}`}
              entityType="contact"
              isEdit={isEdit}
              existingCode={existing?.contactCode}
              value={watched.contactCode ?? ''}
              onChange={(v) => setValue('contactCode', v, { shouldValidate: true, shouldDirty: true })}
              onSeriesReady={(h) => { codeSeriesRef.current = h }}
              label="Contact Code"
              error={errors.contactCode?.message}
              required
            />
          </div>
          <ErpFieldRow
            label="Full Name"
            required
            dataField="name"
            fieldState={errors.name ? 'error' : 'idle'}
            fieldError={errors.name?.message}
          >
            <Input {...register('name')} error={!!errors.name} placeholder="e.g. Rajesh Kumar" className="erp-input" />
          </ErpFieldRow>
          <ErpFieldRow
            label={COMPANY_TERMINOLOGY.singular}
            required
            dataField="customerId"
            fieldState={errors.customerId ? 'error' : 'idle'}
            fieldError={errors.customerId?.message}
          >
            <ErpSmartSelect
              options={companyOptions}
              value={watched.customerId ?? ''}
              onChange={(v) => setValue('customerId', v, { shouldDirty: true, shouldValidate: true })}
              placeholder={`Search ${COMPANY_TERMINOLOGY.plural.toLowerCase()}…`}
              allowEmpty
              emptyMessage={`No ${COMPANY_TERMINOLOGY.plural.toLowerCase()} found`}
            />
          </ErpFieldRow>
          <ErpFieldRow
            label="Mobile / Phone"
            dataField="phone"
            fieldState={errors.phone ? 'error' : 'idle'}
            fieldError={errors.phone?.message}
          >
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
              <MobileInput {...register('phone')} className="erp-input pl-9" placeholder="10-digit mobile" />
            </div>
          </ErpFieldRow>
          <ErpFieldRow
            label="Email"
            dataField="email"
            fieldState={errors.email ? 'error' : 'idle'}
            fieldError={errors.email?.message}
          >
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
              <Input type="email" {...register('email')} className="erp-input pl-9" placeholder="name@company.com" />
            </div>
          </ErpFieldRow>
          <ErpFieldRow
            label="Designation"
            dataField="designation"
            fieldState={errors.designation ? 'error' : 'idle'}
            fieldError={errors.designation?.message}
          >
            <Select {...register('designation')} className="erp-input">
              <option value="">— Select designation —</option>
              {designationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {watched.designation && !designationOptions.some((o) => o.value === watched.designation) ? (
                <option value={watched.designation}>{watched.designation}</option>
              ) : null}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Primary Contact">
            <Checkbox
              label="Primary for this company"
              checked={watched.isPrimary ?? false}
              onChange={(e) => setValue('isPrimary', e.target.checked, { shouldDirty: true })}
            />
          </ErpFieldRow>
        </ErpQuickEntrySection>

        <ErpAdditionalInfoToggle
          open={showAdditionalDetails}
          onToggle={() => {
            if (showAdditionalDetails) setActiveSection('quick')
            toggleAdditionalDetails()
          }}
          panelId={additionalPanelId}
          sectionCount={additionalSectionCount}
          attentionCount={additionalAttentionCount}
        />

        <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
        <ErpCardSection
          id="contact-section-details"
          title="Additional details"
          subtitle="Department, status, and company snapshot."
          icon={Building2}
          accent="teal"
          columns={3}
          collapsible
          defaultOpen
          forceOpenKey={sectionForceOpenKey}
        >
          <ErpFieldRow
            label="Department"
            dataField="department"
            fieldState={errors.department ? 'error' : 'idle'}
            fieldError={errors.department?.message}
          >
            <Select {...register('department')} className="erp-input">
              <option value="">— Select department —</option>
              {departmentOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {watched.department && !departmentOptions.some((o) => o.value === watched.department) ? (
                <option value={watched.department}>{watched.department}</option>
              ) : null}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Status">
            <Checkbox
              label="Active for opportunities & follow-ups"
              checked={watched.isActive ?? true}
              onChange={(e) => setValue('isActive', e.target.checked, { shouldDirty: true })}
            />
          </ErpFieldRow>
          {customer ? (
            <div className="erp-field-row--wide rounded-lg border border-erp-border bg-erp-surface-alt/60 px-4 py-3 text-[12px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-erp-text">{customer.customerName}</p>
                  <p className="mt-0.5 text-erp-muted">{customer.customerCode} · {customer.city}, {customer.state}</p>
                  <p className="mt-0.5 text-erp-muted">{customer.salesTerritory} territory · {customer.customerType}</p>
                </div>
                <TableLink to={entity360CustomerPath(customer.id)} className="text-[12px] font-semibold">
                  Open {COMPANY_TERMINOLOGY.hub360}
                </TableLink>
              </div>
            </div>
          ) : null}
        </ErpCardSection>

        <ErpCardSection
          id="contact-section-documents"
          title="Attachments"
          subtitle="Business cards, KYC, and supporting documents."
          icon={Paperclip}
          accent="slate"
          columns={1}
          collapsible
          defaultOpen={attachments.length > 0}
        >
          <CrmTypedDocumentUpload
            attachments={attachments}
            onChange={setAttachments}
          />
        </ErpCardSection>
        </ErpAdditionalInfoPanel>
        </div>
      </CrmCardFormShell>
    </>
  )
}
