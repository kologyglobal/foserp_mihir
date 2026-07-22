import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  Calendar,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Handshake,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Zap,
} from 'lucide-react'
import { Input, MobileInput, Select, Textarea } from '../../components/forms/Inputs'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { ErpLineItemsGrid } from '../../components/erp/ErpLineItemsGrid'
import { LeadSaveNextActionsPanel } from '../../components/crm/LeadSaveNextActionsPanel'
import { CrmLeadPriorityChips } from '../../components/crm/CrmLeadPriorityChips'
import { CrmTypedDocumentUpload } from '../../components/crm/CrmTypedDocumentUpload'
import { CompanyProspectSelect } from '../../components/crm/CompanyProspectSelect'
import { LeadContactSelect } from '../../components/crm/LeadContactSelect'
import { LeadSmartOverviewPanel } from '../../components/crm/LeadSmartOverviewPanel'
import { QuickFollowUpDrawer } from '../../components/crm/QuickFollowUpDrawer'
import { LogActivityDrawer } from '../../components/crm/CrmQuickCreateDrawers'
import type { CompanyProspectMatch } from '../../utils/companyProspectSearch'
import type { CrmContact } from '../../types/crm'
import { leadEngagementContext, primaryLinkedOpportunityIdForLead } from '../../utils/leadEngagement'
import { useLead } from '../../hooks/useStableStoreData'
import { useLeadRoutes } from '../../hooks/useLeadRoutes'
import { leadEditBreadcrumbs, leadNewBreadcrumbs } from '../../utils/crmLeadNavigation'
import { useSalesStore } from '../../store/salesStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { useMasterStore } from '../../store/masterStore'
import { useCrmStore } from '../../store/crmStore'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import { isApiMode } from '../../config/apiConfig'
import { getSessionUser } from '../../utils/permissions'
import { sanitizePhoneDigits } from '../../utils/phoneValidation'
import { normalizeEmail, validateEmail } from '../../utils/validation/email'
import { validateMobileForCountry } from '../../utils/validation/mobilePhone'
import {
  getCrmDateInputMax,
  getCrmDateInputMin,
  getDateInputMin,
  suggestFollowUpDueTime,
  validateCrmCalendarDate,
  validateFollowUpAt,
} from '../../utils/validation/crmDatePolicy'
import { validateLeadForm } from '../../utils/validation/crmSchemas/leadSchema'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../config/countries'
import { getActiveLeadUsers } from '../../data/crm/leadUsers'
import {
  leadStageLabel,
  leadPriorityLabel,
  resolveLeadPriorityOptions,
  applyLeadStageDefaults,
  buildLeadStageSmartSelectOptions,
  resolveLeadConvertToOpportunityGate,
} from '../../utils/leadUtils'
import {
  isLeadFieldLocked,
  resolveLeadEditPolicy,
} from '../../utils/leadEditPolicy'
import {
  useLeadReasonOptions,
  useFollowUpTypeOptions,
  useLeadSourceOptions,
} from '../../hooks/useCrmMasters'
import type {
  LeadActivityStatus,
  LeadLifecycleStatus,
  LeadPriority,
  LeadSource,
  LeadStage,
} from '../../types/sales'
import type { OpportunityLine } from '../../types/crm'
import { formatStatus } from '../../components/ui/Badge'
import { formatDate } from '../../utils/dates/format'
import { ErpCardSection, ErpFieldRow, ErpQuickEntrySection, ErpFieldGroup, ErpAdditionalInfoToggle, ErpAdditionalInfoPanel, ErpAdditionalSectionNav, useErpAdditionalInfo, ErpCardCommandBar } from '../../components/erp/card-form'
import { FormActionBar } from '../../components/erp/FormActionBar'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { EnterpriseFormSectionNav } from '../../design-system/workspace'
import { useFormDraftAutosave } from '../../hooks/useFormDraftAutosave'
import { useInlineFormValidation } from '../../hooks/useInlineFormValidation'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import {
  handleInvalidSubmit,
  crmShowCompletenessHints,
  type FieldErrorMap,
} from '../../utils/formValidation'
import { useLeadAttachmentStore } from '../../store/leadAttachmentStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { useProductMasterOptionMap } from '../../utils/opportunityProductOptions'
import {
  calcOpportunityLinesSummary,
  createEmptyOpportunityLine,
  syncOpportunityLines,
} from '../../utils/opportunityLineCalc'
import {
  decodeLeadRequirementLines,
  encodeLeadRequirementLines,
  hasLeadRequirementLines,
  summarizeLeadRequirementLines,
} from '../../utils/leadRequirementLines'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Field order for invalid-submit focus (Lead create/edit reference). */
const LEAD_FIELD_ORDER = [
  'prospectName',
  'contactPerson',
  'leadOwnerId',
  'priority',
  'createdDate',
  'mobile',
  'email',
  'remarks',
  'productRequirement',
  'expectedCloseDate',
  'nextFollowUpDate',
  'inactiveReason',
  'notQualifiedReason',
  'closedDate',
  'closedReason',
] as const

const LEAD_SECTION_BY_FIELD: Record<string, string> = {
  prospectName: 'lead-section-quick',
  contactPerson: 'lead-section-quick',
  leadOwnerId: 'lead-section-quick',
  priority: 'lead-section-quick',
  createdDate: 'lead-section-quick',
  mobile: 'lead-section-quick',
  email: 'lead-section-quick',
  remarks: 'lead-section-enquiry-notes',
  productRequirement: 'lead-section-requirement',
  expectedCloseDate: 'lead-section-commercial',
  nextFollowUpDate: 'lead-section-followup',
  inactiveReason: 'lead-section-status',
  notQualifiedReason: 'lead-section-status',
  closedDate: 'lead-section-status',
  closedReason: 'lead-section-status',
}

export function CrmLeadFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const duplicateFromId = searchParams.get('duplicateFrom') ?? ''
  const navigate = useNavigate()
  const routes = useLeadRoutes()
  const session = getSessionUser()
  const existing = useLead(id)
  const duplicateSource = useSalesStore((s) => (duplicateFromId && !id ? s.getLead(duplicateFromId) : undefined))
  const createLead = useSalesStore((s) => s.createLead)
  const updateLead = useSalesStore((s) => s.updateLead)
  const advanceLeadStage = useSalesStore((s) => s.advanceLeadStage)
  const createFollowUp = useCrmStore((s) => s.createFollowUp)
  const createActivity = useCrmStore((s) => s.createActivity)
  const opportunities = useCrmStore((s) => s.opportunities)
  const isEdit = Boolean(id && existing)
  const editPolicy = useMemo(
    () => (existing ? resolveLeadEditPolicy(existing) : resolveLeadEditPolicy(null)),
    [existing],
  )
  const formPolicy = isEdit
    ? editPolicy
    : { mode: 'full' as const, lockedFields: [] as string[], canSave: true, canChangeStage: true }
  const fieldLocked = (field: string) => isEdit && isLeadFieldLocked(formPolicy, field)

  const [validationErrors, setValidationErrors] = useState<FieldErrorMap>({})
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [sectionForceOpenKey, setSectionForceOpenKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null)
  const [savedLeadNo, setSavedLeadNo] = useState<string | null>(null)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const companyCreateContactSnapshotRef = useRef<{
    companyInfo: CompanyProspectMatch | null
    contactId: string
    contactPerson: string
    mobile: string
    email: string
    industry: string
    source: LeadSource
  } | null>(null)

  const [company, setCompany] = useState({
    customerId: existing?.customerId ?? null,
    prospectName: existing?.prospectName ?? '',
  })
  const [companyInfo, setCompanyInfo] = useState<CompanyProspectMatch | null>(null)
  const [contactId, setContactId] = useState(existing?.contactId ?? '')
  const [contactPerson, setContactPerson] = useState(existing?.contactPerson ?? '')
  const [mobile, setMobile] = useState(() => sanitizePhoneDigits(existing?.mobile ?? ''))
  const [email, setEmail] = useState(existing?.email ?? '')
  const [leadOwnerId, setLeadOwnerId] = useState(existing?.leadOwnerId ?? session.id)
  const [priority, setPriority] = useState<LeadPriority>(existing?.priority ?? 'medium')
  const [createdDate, setCreatedDate] = useState(existing?.createdDate ?? todayIso())
  const [source, setSource] = useState<LeadSource>(existing?.source ?? 'other')
  const [industry, setIndustry] = useState(existing?.industry ?? '')
  const [requirementLines, setRequirementLines] = useState<OpportunityLine[]>(() =>
    decodeLeadRequirementLines(
      existing?.productRequirement ?? '',
      existing?.expectedQty ?? null,
      existing?.remarks,
    ).lines,
  )
  const [expectedValue, setExpectedValue] = useState(existing?.expectedValue ?? 0)
  const [probability, setProbability] = useState(existing?.probability ?? 30)
  const [expectedCloseDate, setExpectedCloseDate] = useState(existing?.expectedCloseDate ?? '')
  const [remarks, setRemarks] = useState(existing?.remarks ?? '')
  const [internalNotes, setInternalNotes] = useState('')
  const [reference, setReference] = useState('')
  const [leadStage, setLeadStage] = useState<LeadStage>(existing?.stage ?? 'new')
  const [notQualifiedReason, setNotQualifiedReason] = useState(existing?.notQualifiedReason ?? '')
  const [activityStatus, setActivityStatus] = useState<LeadActivityStatus>(existing?.activityStatus ?? 'active')
  const [inactiveReason, setInactiveReason] = useState(existing?.inactiveReason ?? '')
  const [lifecycleStatus, setLifecycleStatus] = useState<LeadLifecycleStatus>(existing?.lifecycleStatus ?? 'open')
  const [closedDate, setClosedDate] = useState(existing?.closedDate ?? '')
  const [closedReason, setClosedReason] = useState(existing?.closedReason ?? '')
  const [nextFollowUpDate, setNextFollowUpDate] = useState(existing?.nextFollowUpDate ?? '')
  const [followUpType, setFollowUpType] = useState(existing?.followUpType ?? 'call')
  const [followUpNotes, setFollowUpNotes] = useState(existing?.followUpNotes ?? '')
  const [activeSection, setActiveSection] = useState('quick')
  const [activeAdditionalSection, setActiveAdditionalSection] = useState('requirement')
  const formRootRef = useRef<HTMLDivElement>(null)
  const { locationId, setLocationId, defaultLocationId } = useDocumentLocation('sales', existing?.locationId)

  const attachmentScopeId = id ?? 'draft:new'
  const setLeadAttachments = useLeadAttachmentStore((s) => s.setForLead)
  const bindDraftAttachments = useLeadAttachmentStore((s) => s.bindDraftToLead)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useLeadAttachmentStore.getState().getForLead(attachmentScopeId),
  )

  useEffect(() => {
    setAttachmentsState(useLeadAttachmentStore.getState().getForLead(attachmentScopeId))
  }, [attachmentScopeId])

  function setAttachments(next: CrmTypedAttachment[]) {
    setAttachmentsState(next)
    setLeadAttachments(attachmentScopeId, next)
  }

  const needsAdditionalForStage =
    leadStage === 'requirement_collected'
    || leadStage === 'qualified'
    || leadStage === 'not_qualified'
    || leadStage === 'closed'
    || activityStatus === 'inactive'

  const hasOptionalDetailData = Boolean(
    email.trim()
    || source !== 'other'
    || (locationId && locationId !== defaultLocationId)
    || hasLeadRequirementLines(requirementLines)
    || industry.trim()
    || expectedValue > 0
    || expectedCloseDate
    || nextFollowUpDate
    || followUpNotes.trim()
    || attachments.length > 0
    || internalNotes.trim()
    || reference.trim()
    || inactiveReason
    || notQualifiedReason
    || closedReason
    || closedDate,
  )

  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    forceOpen: needsAdditionalForStage,
    preferOpen: isEdit && hasOptionalDetailData,
  })

  useEffect(() => {
    if (!duplicateSource || id) return
    setCompany({
      customerId: duplicateSource.customerId,
      prospectName: `${duplicateSource.prospectName} (Copy)`,
    })
    setContactId(duplicateSource.contactId ?? '')
    setContactPerson(duplicateSource.contactPerson ?? '')
    setMobile(sanitizePhoneDigits(duplicateSource.mobile ?? ''))
    setEmail(duplicateSource.email ?? '')
    setLeadOwnerId(duplicateSource.leadOwnerId)
    setPriority(duplicateSource.priority)
    setCreatedDate(todayIso())
    setSource(duplicateSource.source)
    setIndustry(duplicateSource.industry ?? '')
    setRequirementLines(
      decodeLeadRequirementLines(
        duplicateSource.productRequirement ?? '',
        duplicateSource.expectedQty ?? null,
        duplicateSource.remarks,
      ).lines,
    )
    setExpectedValue(duplicateSource.expectedValue ?? 0)
    setProbability(duplicateSource.probability ?? 30)
    setExpectedCloseDate(duplicateSource.expectedCloseDate ?? '')
    setRemarks(duplicateSource.remarks ?? '')
    setLeadStage('new')
    setNotQualifiedReason('')
    setActivityStatus('active')
    setInactiveReason('')
    setLifecycleStatus('open')
    setClosedDate('')
    setClosedReason('')
    setNextFollowUpDate('')
    setFollowUpType(duplicateSource.followUpType ?? 'call')
    setFollowUpNotes('')
    if (duplicateSource.locationId) setLocationId(duplicateSource.locationId)
  }, [duplicateSource?.id, id, setLocationId])

  useEffect(() => {
    if (!existing || !id) return
    setCompany({ customerId: existing.customerId, prospectName: existing.prospectName })
    setContactId(existing.contactId ?? '')
    setContactPerson(existing.contactPerson ?? '')
    setMobile(sanitizePhoneDigits(existing.mobile ?? ''))
    setEmail(existing.email ?? '')
    setLeadOwnerId(existing.leadOwnerId)
    setPriority(existing.priority)
    setCreatedDate(existing.createdDate)
    setSource(existing.source)
    setIndustry(existing.industry ?? '')
    setRequirementLines(
      decodeLeadRequirementLines(
        existing.productRequirement ?? '',
        existing.expectedQty ?? null,
        existing.remarks,
      ).lines,
    )
    setExpectedValue(existing.expectedValue ?? 0)
    setProbability(existing.probability ?? 30)
    setExpectedCloseDate(existing.expectedCloseDate ?? '')
    setRemarks(existing.remarks ?? '')
    setLeadStage(existing.stage)
    setNotQualifiedReason(existing.notQualifiedReason ?? '')
    setActivityStatus(existing.activityStatus)
    setInactiveReason(existing.inactiveReason ?? '')
    setLifecycleStatus(existing.lifecycleStatus)
    setClosedDate(existing.closedDate ?? '')
    setClosedReason(existing.closedReason ?? '')
    setNextFollowUpDate(existing.nextFollowUpDate ?? '')
    setFollowUpType(existing.followUpType ?? 'call')
    setFollowUpNotes(existing.followUpNotes ?? '')
    if (existing.locationId) setLocationId(existing.locationId)
  }, [existing?.id, id])

  function showToast(message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') {
    if (variant === 'success') notify.success(message)
    else if (variant === 'error') notify.failed(message)
    else if (variant === 'warning') notify.warning(message)
    else notify.info(message)
  }

  const crmMasterEntries = useCrmMasterStore((s) => s.entries)
  const leadUsers = useMemo(() => getActiveLeadUsers(), [crmMasterEntries, session.id])
  const leadStageSelectOptions = useMemo(() => buildLeadStageSmartSelectOptions(), [])
  const leadPriorityOptions = useMemo(() => resolveLeadPriorityOptions(), [])
  const inactiveReasons = useLeadReasonOptions('inactive')
  const closedReasons = useLeadReasonOptions('closed')
  const notQualifiedReasons = useLeadReasonOptions('not_qualified')
  const followUpTypeOptions = useFollowUpTypeOptions()
  const leadSourceOptions = useLeadSourceOptions()
  const selectedOwner = leadUsers.find((u) => u.id === leadOwnerId) ?? leadUsers[0]

  /** Keep owner on a real API user — never leave Demo User selected in API mode. */
  useEffect(() => {
    if (!isApiMode()) return
    const valid = leadUsers.some((u) => u.id === leadOwnerId)
    if (!valid && session.id) setLeadOwnerId(session.id)
  }, [leadOwnerId, leadUsers, session.id])

  const ownerSelectOptions = useMemo(
    () => leadUsers.map((u) => ({
      value: u.id,
      label: u.name,
      searchText: `${u.name} ${u.role}`.toLowerCase(),
    })),
    [leadUsers],
  )

  const followUpSelectOptions = useMemo(
    () => followUpTypeOptions.map((t) => ({
      value: t.value,
      label: t.label,
      searchText: t.label.toLowerCase(),
    })),
    [followUpTypeOptions],
  )

  const sourceSelectOptions = useMemo(
    () => leadSourceOptions.map((s) => ({
      value: s.value as LeadSource,
      label: s.label,
      searchText: s.label.toLowerCase(),
    })),
    [leadSourceOptions],
  )

  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const { options: productOptions, pickMap } = useProductMasterOptionMap(
    products,
    items,
    uoms,
    undefined,
    requirementLines.map((l) => l.productId),
  )

  const requirementText = useMemo(
    () => summarizeLeadRequirementLines(requirementLines),
    [requirementLines],
  )
  const requirementLineSummary = useMemo(
    () => calcOpportunityLinesSummary(requirementLines),
    [requirementLines],
  )

  function handleRequirementLinesChange(next: OpportunityLine[]) {
    const synced = syncOpportunityLines(next)
    setRequirementLines(synced)
    const summary = calcOpportunityLinesSummary(synced)
    if (summary.grandTotal > 0) setExpectedValue(summary.grandTotal)
  }

  const customer = company.customerId ? useMasterStore.getState().getCustomer(company.customerId) : undefined
  const territory = customer?.salesTerritory ?? companyInfo?.salesTerritory ?? '—'

  // New Lead policy: the form always opens blank — drafts are never persisted or restored.
  // clearDraft stays wired so any legacy stale draft key is purged on mount / cancel / save.
  const draftKey = `erp-lead-draft-${id ?? 'new'}`
  const { statusLabel: autosaveLabel, clearDraft } = useFormDraftAutosave({
    key: draftKey,
    data: null,
    enabled: false,
  })

  /** After a successful create, clear every field for the next entry. */
  function resetBlankNewLeadForm() {
    clearDraft()
    setCompany({ customerId: null, prospectName: '' })
    setCompanyInfo(null)
    setContactId('')
    setContactPerson('')
    setMobile('')
    setEmail('')
    setLeadOwnerId(session.id)
    setPriority('medium')
    setCreatedDate(todayIso())
    setSource('other')
    setIndustry('')
    setRequirementLines([createEmptyOpportunityLine(1)])
    setExpectedValue(0)
    setProbability(30)
    setExpectedCloseDate('')
    setRemarks('')
    setInternalNotes('')
    setReference('')
    setLeadStage('new')
    setNotQualifiedReason('')
    setActivityStatus('active')
    setInactiveReason('')
    setLifecycleStatus('open')
    setClosedDate('')
    setClosedReason('')
    setNextFollowUpDate('')
    setFollowUpType('call')
    setFollowUpNotes('')
    setLocationId(defaultLocationId)
    setAttachments([])
    setSavedLeadId(null)
    setSavedLeadNo(null)
    setValidationErrors({})
    setShowAdditionalDetails(false)
    setActiveSection('quick')
    if (searchParams.toString()) {
      navigate(routes.new, { replace: true })
    }
    captureDirtyBaseline()
  }

  // Create mode must start completely blank: purge any stale draft (from older builds or
  // abandoned sessions) and any leftover draft:new attachments from a previous lead entry.
  useEffect(() => {
    if (id) return
    clearDraft()
    setLeadAttachments('draft:new', [])
    setAttachmentsState([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resolveLeadMobileCountry(): string {
    if (company.customerId) {
      const linked = useMasterStore.getState().getCustomer(company.customerId)
      if (linked?.country?.trim()) return linked.country.trim()
    }
    return DEFAULT_CUSTOMER_COUNTRY
  }

  const inlineValidation = useInlineFormValidation(
    {
      prospectName: company.prospectName.trim() || company.customerId || '',
      leadOwnerId,
      priority,
      createdDate,
      mobile,
      email,
      remarks,
      expectedValue,
    },
    {
      prospectName: { required: true, message: 'Company / Prospect is required' },
      leadOwnerId: { required: true, message: 'Lead Owner is required' },
      priority: { required: true, message: 'Priority is required' },
      createdDate: {
        required: true,
        message: 'Created Date is required',
        validate: (v) =>
          validateCrmCalendarDate(String(v ?? ''), {
            label: 'Created Date',
            required: true,
            notAfter: getDateInputMin(),
            notAfterMessage: 'Created Date cannot be in the future',
          }),
      },
      mobile: {
        validate: (v) => validateMobileForCountry(String(v ?? ''), resolveLeadMobileCountry()),
      },
      email: {
        validate: (v) => validateEmail(String(v ?? '')),
      },
      remarks: {
        required: true,
        message: 'Notes are required',
      },
    },
  )

  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(true)
  const dirtyBaselineReady = useRef(false)
  const dirtyBaseline = useRef('')
  const dirtySnapshot = useMemo(
    () =>
      JSON.stringify({
        company,
        contactId,
        contactPerson,
        mobile,
        email,
        leadOwnerId,
        priority,
        createdDate,
        source,
        industry,
        requirementLines,
        expectedValue,
        probability,
        expectedCloseDate,
        remarks,
        internalNotes,
        reference,
        leadStage,
        notQualifiedReason,
        activityStatus,
        inactiveReason,
        lifecycleStatus,
        closedDate,
        closedReason,
        nextFollowUpDate,
        followUpType,
        followUpNotes,
        locationId,
        attachmentIds: attachments.map((a) => a.id),
      }),
    [
      company,
      contactId,
      contactPerson,
      mobile,
      email,
      leadOwnerId,
      priority,
      createdDate,
      source,
      industry,
      requirementLines,
      expectedValue,
      probability,
      expectedCloseDate,
      remarks,
      internalNotes,
      reference,
      leadStage,
      notQualifiedReason,
      activityStatus,
      inactiveReason,
      lifecycleStatus,
      closedDate,
      closedReason,
      nextFollowUpDate,
      followUpType,
      followUpNotes,
      locationId,
      attachments,
    ],
  )
  const dirtySnapshotRef = useRef(dirtySnapshot)
  dirtySnapshotRef.current = dirtySnapshot

  const captureDirtyBaseline = useMemo(
    () => () => {
      dirtyBaselineReady.current = false
      window.setTimeout(() => {
        dirtyBaseline.current = dirtySnapshotRef.current
        dirtyBaselineReady.current = true
        resetDirty()
      }, 40)
    },
    [resetDirty],
  )

  useEffect(() => {
    if (id && !existing) return
    captureDirtyBaseline()
  }, [id, existing?.id, existing?.modifiedAt, duplicateSource?.id, captureDirtyBaseline])

  useEffect(() => {
    if (!dirtyBaselineReady.current) return
    if (dirtySnapshot !== dirtyBaseline.current) markDirty()
    else resetDirty()
  }, [dirtySnapshot, markDirty, resetDirty])

  const completionItems = useMemo(() => [
    { id: 'quick', label: 'Quick entry', done: Boolean((company.prospectName.trim() || company.customerId) && leadOwnerId && (requirementText || remarks.trim())) },
    { id: 'communication', label: 'Communication', done: Boolean(email.trim() || mobile.trim()) },
    { id: 'requirement', label: 'Requirement', done: hasLeadRequirementLines(requirementLines) || Boolean(remarks.trim()) },
    { id: 'commercial', label: 'Commercial', done: expectedValue > 0 && Boolean(expectedCloseDate) },
    { id: 'followup', label: 'Follow-up', done: Boolean(nextFollowUpDate) },
    { id: 'documents', label: 'Documents', done: attachments.length > 0 },
    { id: 'status', label: 'Status', done: activityStatus === 'active' || Boolean(inactiveReason) },
  ], [company.prospectName, company.customerId, leadOwnerId, requirementText, requirementLines, remarks, email, mobile, expectedValue, expectedCloseDate, nextFollowUpDate, attachments.length, activityStatus, inactiveReason])

  const completionPercent = useMemo(() => {
    const visible = showAdditionalDetails
      ? completionItems
      : completionItems.filter((i) => i.id === 'quick')
    if (visible.length === 0) return 0
    return Math.round((visible.filter((i) => i.done).length / visible.length) * 100)
  }, [completionItems, showAdditionalDetails])

  const productLineCount = useMemo(
    () => requirementLines.filter((l) => l.productOrItem?.trim()).length,
    [requirementLines],
  )

  const additionalSectionItems = useMemo(() => {
    const commercialDone = expectedValue > 0 && Boolean(expectedCloseDate)
    const notesFilled = Boolean(internalNotes.trim() || reference.trim())
    return [
      {
        id: 'requirement',
        label: 'Products',
        status: productLineCount > 0
          ? `${productLineCount} item${productLineCount === 1 ? '' : 's'}`
          : 'Needs input',
        tone: productLineCount > 0 ? 'ok' as const : 'missing' as const,
        icon: ClipboardList,
      },
      {
        id: 'commercial',
        label: 'Commercial',
        status: commercialDone ? 'Complete' : 'Needs input',
        tone: commercialDone ? 'ok' as const : 'missing' as const,
        icon: Banknote,
      },
      {
        id: 'followup',
        label: 'Follow-up',
        status: nextFollowUpDate ? 'Scheduled' : 'Needs input',
        tone: nextFollowUpDate ? 'ok' as const : 'missing' as const,
        icon: Calendar,
      },
      {
        id: 'notes',
        label: 'Notes',
        status: notesFilled ? 'Added' : 'None',
        tone: 'neutral' as const,
        icon: FileText,
      },
      {
        id: 'documents',
        label: 'Attachments',
        status: attachments.length > 0
          ? `${attachments.length} file${attachments.length === 1 ? '' : 's'}`
          : 'No files',
        tone: 'neutral' as const,
        icon: Paperclip,
      },
      {
        id: 'status',
        label: 'Status',
        status: formatStatus(activityStatus),
        tone: activityStatus === 'active' ? 'ok' as const : 'neutral' as const,
        icon: Building2,
      },
    ]
  }, [
    productLineCount, expectedValue, expectedCloseDate, nextFollowUpDate,
    internalNotes, reference, attachments.length, activityStatus,
  ])

  const sectionNavItems = useMemo(() => {
    const quick = { id: 'quick', label: 'Quick', icon: Zap, done: completionItems.find((i) => i.id === 'quick')?.done }
    if (!showAdditionalDetails) return [quick]
    const active = additionalSectionItems.find((s) => s.id === activeAdditionalSection)
    return [
      quick,
      {
        id: activeAdditionalSection,
        label: active?.label ?? 'More',
        icon: active?.icon ?? ClipboardList,
        done: completionItems.find((i) => i.id === activeAdditionalSection)?.done
          ?? (activeAdditionalSection === 'notes' ? Boolean(internalNotes.trim() || reference.trim()) : undefined),
      },
    ]
  }, [completionItems, showAdditionalDetails, activeAdditionalSection, additionalSectionItems, internalNotes, reference])

  function selectAdditionalSection(sectionId: string) {
    setActiveAdditionalSection(sectionId)
    setActiveSection(sectionId)
    window.setTimeout(() => {
      document.getElementById(`lead-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 40)
  }

  function scrollToSection(sectionId: string) {
    const mapped = sectionId === 'communication' ? 'status' : sectionId
    const additionalIds = new Set(additionalSectionItems.map((s) => s.id))
    if (mapped === 'quick') {
      setActiveSection('quick')
      document.getElementById('lead-section-quick')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (mapped === 'notes' || mapped === 'enquiry-notes') {
      setActiveSection('enquiry-notes')
      document.getElementById('lead-section-enquiry-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (additionalIds.has(mapped)) {
      if (!showAdditionalDetails) setShowAdditionalDetails(true)
      selectAdditionalSection(mapped)
      return
    }
    setActiveSection(mapped)
  }

  const quoteOpportunityId = useMemo(
    () => (existing ? primaryLinkedOpportunityIdForLead(existing, opportunities) : null),
    [existing, opportunities],
  )

  const smartOverviewInput = useMemo(() => ({
    prospectName: company.prospectName,
    customerId: company.customerId,
    contactPerson,
    mobile,
    email,
    productRequirement: requirementText,
    remarks,
    expectedValue,
    expectedCloseDate,
    nextFollowUpDate,
    leadStage,
    lifecycleStatus,
    priority,
    ownerName: selectedOwner?.name ?? session.name,
    lastSavedLabel: isEdit && existing?.modifiedAt
      ? `Last updated ${formatDate(existing.modifiedAt)}`
      : autosaveLabel,
    hasLinkedOpportunity: Boolean(quoteOpportunityId),
  }), [
    company.prospectName, company.customerId, contactPerson, mobile, email,
    requirementText, remarks, expectedValue, expectedCloseDate, nextFollowUpDate,
    leadStage, lifecycleStatus, priority, selectedOwner?.name, session.name,
    isEdit, existing?.modifiedAt, autosaveLabel, quoteOpportunityId,
  ])

  function applyContactToLead(contact: CrmContact | null) {
    if (!contact) {
      setContactId('')
      return
    }
    setContactId(contact.id)
    setContactPerson(contact.name)
    setMobile(sanitizePhoneDigits(contact.phone ?? ''))
    setEmail(contact.email ?? '')
  }

  function onCompanyCreateTyping() {
    if (!companyCreateContactSnapshotRef.current) {
      companyCreateContactSnapshotRef.current = {
        companyInfo,
        contactId,
        contactPerson,
        mobile,
        email,
        industry,
        source,
      }
    }
    setCompanyInfo(null)
    setContactId('')
    setContactPerson('')
    setMobile('')
    setEmail('')
    setIndustry('')
  }

  function onCompanyCreateCancel() {
    const snap = companyCreateContactSnapshotRef.current
    companyCreateContactSnapshotRef.current = null
    if (!snap) return
    setCompanyInfo(snap.companyInfo)
    setContactId(snap.contactId)
    setContactPerson(snap.contactPerson)
    setMobile(snap.mobile)
    setEmail(snap.email)
    setIndustry(snap.industry)
    setSource(snap.source)
  }

  function onCompanyLinked(match: CompanyProspectMatch) {
    companyCreateContactSnapshotRef.current = null
    setCompanyInfo(match)
    setCompany({
      customerId: match.customerId,
      prospectName: match.customerName || match.customerId,
    })
    const companyContacts = useCrmStore.getState().contacts.filter(
      (c) => c.customerId === match.customerId && (c.isActive ?? true),
    )
    const matched =
      companyContacts.find((c) => c.isPrimary)
      ?? companyContacts.find((c) =>
        match.contactPerson
        && c.name.trim().toLowerCase() === match.contactPerson.trim().toLowerCase(),
      )
      ?? companyContacts[0]
      ?? null
    const isNewCompany = match.sourceLabel === 'New'
    let filledContactPerson = ''
    let filledMobile = ''
    let filledEmail = ''
    if (matched && !isNewCompany) {
      applyContactToLead(matched)
      filledContactPerson = matched.name
      filledMobile = sanitizePhoneDigits(matched.phone ?? '')
      filledEmail = matched.email?.trim() ?? ''
    } else {
      setContactId(matched?.id ?? '')
      const nextContactPerson = (matched?.name ?? match.contactPerson)?.trim() ?? ''
      const nextMobile = sanitizePhoneDigits((matched?.phone || match.contactPhone) ?? '')
      const nextEmail = (matched?.email || match.contactEmail)?.trim() ?? ''
      if (isNewCompany) {
        // Quick-created company (Add New Company popup): copy only the fields that
        // were actually entered — never blank values already typed on the lead.
        if (nextContactPerson) setContactPerson(nextContactPerson)
        if (nextMobile) setMobile(nextMobile)
        if (nextEmail) setEmail(nextEmail)
      } else {
        setContactPerson(nextContactPerson)
        setMobile(nextMobile)
        setEmail(nextEmail)
      }
      filledContactPerson = nextContactPerson
      filledMobile = nextMobile
      filledEmail = nextEmail
      if (isNewCompany && match.customerId && !matched) {
        // The popup's Contact Person is synced into a CRM contact asynchronously
        // (contactSync lazy imports). Poll briefly so the visible Contact Person
        // select on the lead form shows the created contact once it lands.
        let attempts = 0
        const pickUpSyncedContact = () => {
          attempts += 1
          const synced = useCrmStore.getState().contacts.find(
            (c) => c.customerId === match.customerId && (c.isActive ?? true),
          )
          if (synced) {
            setContactId((prev) => prev || synced.id)
            return
          }
          if (attempts < 5) window.setTimeout(pickUpSyncedContact, 200)
        }
        window.setTimeout(pickUpSyncedContact, 200)
      }
    }
    // Auto-filled values satisfy earlier save-attempt errors — drop them
    setValidationErrors((prev) => {
      const clearable = [
        filledContactPerson ? 'contactPerson' : null,
        filledMobile ? 'mobile' : null,
        filledEmail ? 'email' : null,
      ].filter((k): k is 'contactPerson' | 'mobile' | 'email' => Boolean(k && prev[k]))
      if (clearable.length === 0) return prev
      const next = { ...prev }
      for (const k of clearable) delete next[k]
      return next
    })
    if (match.industry) setIndustry(match.industry)
    if (match.customerId) setSource('existing_customer')
    // Clear stale save-time errors once company is linked
    setValidationErrors((prev) => {
      if (!prev.prospectName) return prev
      const next = { ...prev }
      delete next.prospectName
      return next
    })
    inlineValidation.touch('prospectName')
  }

  function handleLeadStageChange(next: LeadStage) {
    setLeadStage(next)
    const defaults = applyLeadStageDefaults(next, { activityStatus, lifecycleStatus, closedDate, closedReason })
    if (defaults.lifecycleStatus) setLifecycleStatus(defaults.lifecycleStatus)
    if (defaults.activityStatus) setActivityStatus(defaults.activityStatus)
    if (defaults.closedDate) setClosedDate(defaults.closedDate)
    if (next !== 'closed') setClosedReason('')
    if (next !== 'not_qualified') setNotQualifiedReason('')
  }

  function resolveProspectName(): string {
    const typed = company.prospectName.trim()
    if (typed) return typed
    if (company.customerId) {
      const linked = useMasterStore.getState().getCustomer(company.customerId)
      if (linked?.customerName?.trim()) return linked.customerName.trim()
    }
    return companyInfo?.customerName?.trim() ?? ''
  }

  function validate(): FieldErrorMap {
    inlineValidation.touchAll()
    return validateLeadForm({
      prospectName: resolveProspectName(),
      customerId: company.customerId,
      leadOwnerId,
      priority,
      createdDate,
      email,
      mobile,
      mobileCountry: resolveLeadMobileCountry(),
      contactPerson,
      contactId,
      remarks,
      leadStage,
      requirementText,
      hasRequirementLines: hasLeadRequirementLines(requirementLines),
      expectedCloseDate,
      nextFollowUpDate,
      activityStatus,
      inactiveReason,
      notQualifiedReason,
      closedDate,
      closedReason,
      isEdit,
    })
  }

  function expandLeadSectionForField(sectionId: string) {
    const needsAdditional =
      sectionId === 'lead-section-requirement'
      || sectionId === 'lead-section-status'
      || sectionId === 'lead-section-commercial'
      || sectionId === 'lead-section-followup'
      || sectionId === 'lead-section-notes'
      || sectionId === 'lead-section-documents'
    if (needsAdditional && !showAdditionalDetails) setShowAdditionalDetails(true)
    if (sectionId === 'lead-section-status') setActiveAdditionalSection('status')
    else if (sectionId === 'lead-section-requirement') setActiveAdditionalSection('requirement')
    else if (sectionId === 'lead-section-commercial') setActiveAdditionalSection('commercial')
    else if (sectionId === 'lead-section-followup') setActiveAdditionalSection('followup')
    else if (sectionId === 'lead-section-notes') setActiveAdditionalSection('notes')
    else if (sectionId === 'lead-section-documents') setActiveAdditionalSection('documents')
    setSectionForceOpenKey((k) => k + 1)
  }

  function buildPayload() {
    const owner = leadUsers.find((u) => u.id === leadOwnerId)
    const masters = useMasterStore.getState()
    const cust = company.customerId ? masters.getCustomer(company.customerId) : undefined
    const prospectName =
      resolveProspectName()
      || cust?.customerName?.trim()
      || companyInfo?.customerName?.trim()
      || ''
    // Keep parent state aligned with what we are about to save
    if (prospectName && prospectName !== company.prospectName.trim()) {
      setCompany((prev) => ({ ...prev, prospectName }))
    }
    const stageDefaults = applyLeadStageDefaults(leadStage, { activityStatus, lifecycleStatus, closedDate, closedReason })
    return {
      customerId: company.customerId,
      prospectName,
      leadOwnerId,
      leadOwnerName: owner?.name ?? session.name,
      priority,
      createdDate,
      stage: leadStage,
      activityStatus: stageDefaults.activityStatus ?? activityStatus,
      inactiveReason: activityStatus === 'inactive' ? inactiveReason : null,
      lifecycleStatus: stageDefaults.lifecycleStatus ?? lifecycleStatus,
      closedDate: leadStage === 'closed' ? (closedDate || todayIso()) : null,
      closedReason: leadStage === 'closed' ? closedReason : null,
      notQualifiedReason: leadStage === 'not_qualified' ? notQualifiedReason : null,
      productRequirement: encodeLeadRequirementLines(requirementLines),
      expectedQty: requirementLineSummary.totalQty > 0 ? requirementLineSummary.totalQty : null,
      expectedValue: Number(expectedValue) || requirementLineSummary.grandTotal || 0,
      expectedCloseDate: expectedCloseDate || null,
      remarks: remarks.trim(),
      contactPerson: contactPerson || null,
      contactId: contactId || null,
      mobile: mobile || null,
      email: email.trim() ? normalizeEmail(email) : null,
      nextFollowUpDate: nextFollowUpDate || null,
      followUpType: followUpType || null,
      followUpNotes: followUpNotes || null,
      source,
      industry: industry || (cust?.industry ?? companyInfo?.industry ?? ''),
      probability: Number(probability) || 30,
      locationId: locationId || null,
    }
  }

  function saveLead(mode: 'default' | 'opportunity' | 'new' | 'close') {
    if (isEdit && !formPolicy.canSave) {
      notify.warning(formPolicy.reason ?? 'This lead cannot be saved in its current state')
      return
    }
    const errors = validate()
    if (Object.keys(errors).length) {
      setSaveAttempted(true)
      handleInvalidSubmit({
        errors,
        fieldOrder: [...LEAD_FIELD_ORDER],
        sectionByField: LEAD_SECTION_BY_FIELD,
        root: formRootRef.current,
        expandSection: expandLeadSectionForField,
        onFieldErrors: setValidationErrors,
      })
      return
    }
    setValidationErrors({})
    if (isSubmitting) return

    setIsSubmitting(true)
    void (async () => {
      const payload = buildPayload()
      let leadId = id

      try {
        if (isEdit && id) {
          const prevStage = existing?.stage
          const {
            stage: _stage,
            lifecycleStatus: _lifecycleStatus,
            ...fieldPatch
          } = payload
          const r = await resolveStoreAction(updateLead(id, fieldPatch))
          if (!r.ok) {
            showToast(r.error ?? 'Lead save failed', 'error')
            return
          }
          if (formPolicy.canChangeStage && prevStage && prevStage !== leadStage) {
            const stageResult = await resolveStoreAction(
              advanceLeadStage(id, leadStage, {
                notQualifiedReason: notQualifiedReason || undefined,
                closedReason: closedReason || undefined,
                closedDate: closedDate || undefined,
              }),
            )
            if (!stageResult.ok) {
              showToast(stageResult.error ?? 'Lead fields saved, but stage change failed', 'error')
              return
            }
            await resolveStoreAction(
              createActivity({
                type: 'note',
                subject: `Stage changed from ${leadStageLabel(prevStage)} to ${leadStageLabel(leadStage)}`,
                description: `Lead stage updated on ${leadStageLabel(leadStage)}`,
                leadId: id,
                customerId: company.customerId,
                ownerId: session.id,
                ownerName: selectedOwner?.name ?? session.name,
              }),
            )
          }
          setLeadAttachments(id, attachments)
        } else {
          const r = await resolveStoreAction(createLead(payload))
          if (!r.ok || !r.leadId) {
            showToast(r.error ?? 'Lead save failed', 'error')
            return
          }
          leadId = r.leadId
          clearDraft()
          bindDraftAttachments('draft:new', leadId)
          setLeadAttachments(leadId, attachments.map((a) => ({ ...a, leadId })))
          setLeadAttachments('draft:new', [])
          // Side effects must not undo a confirmed create (toast/redirect still succeed)
          try {
            await resolveStoreAction(
              createActivity({
                type: 'note',
                subject: 'Lead created as New',
                description: `New lead captured for ${company.prospectName || resolveProspectName()}`,
                leadId,
                customerId: company.customerId,
                ownerId: session.id,
                ownerName: selectedOwner?.name ?? session.name,
              }),
            )
          } catch {
            /* lead already persisted */
          }
        }

        if (nextFollowUpDate && leadId) {
          try {
            const dueTime = suggestFollowUpDueTime(nextFollowUpDate)
            const dueError = validateFollowUpAt({ dueDate: nextFollowUpDate, dueTime })
            if (dueError) {
              notify.warning(dueError)
            } else {
              await resolveStoreAction(
                createFollowUp({
                  leadId,
                  customerId: company.customerId,
                  followUpType: (followUpType as 'call') || 'call',
                  assignedTo: session.id,
                  assignedToName: selectedOwner?.name ?? session.name,
                  dueDate: nextFollowUpDate,
                  dueTime,
                  priority: priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'medium',
                  notes: followUpNotes || `Follow-up for ${company.prospectName || resolveProspectName()}`,
                }),
              )
            }
          } catch {
            /* lead already persisted */
          }
        }

        if (mode === 'close') {
          resetDirty()
          // Bridge already upserted into salesStore; soft-refetch so list is server-fresh
          if (isApiMode()) {
            try {
              const { syncLeadsFromApi } = await import('../../services/bridges/crmApiBridge')
              await syncLeadsFromApi()
            } catch {
              /* upsert already applied */
            }
          }
          navigate(routes.base)
          showToast(isEdit ? 'Lead updated' : 'Lead created', 'success')
          return
        }
        if (mode === 'opportunity' && company.customerId) {
          const gate = resolveLeadConvertToOpportunityGate({
            stage: leadStage,
            customerId: company.customerId,
            opportunityId: existing?.opportunityId ?? null,
            lifecycleStatus: existing?.lifecycleStatus ?? (leadStage === 'qualified' ? 'qualified' : 'open'),
          })
          if (!gate.ok) {
            showToast(gate.reason, 'warning')
            return
          }
          resetDirty()
          navigate(`/crm/opportunities/new?customerId=${company.customerId}&leadId=${leadId}`)
          showToast('Lead saved — opening opportunity form', 'success')
          return
        }

        if (!isEdit) {
          // Save & New — stay on blank form; default Save — lead list register
          if (mode === 'new') {
            resetBlankNewLeadForm()
            showToast('Lead saved — form cleared for next entry', 'success')
            return
          }
          resetDirty()
          if (isApiMode()) {
            try {
              const { syncLeadsFromApi } = await import('../../services/bridges/crmApiBridge')
              await syncLeadsFromApi()
            } catch {
              /* upsert already applied */
            }
          }
          navigate(routes.base)
          showToast('Lead created', 'success')
          return
        }

        // Edit Save — persist then return to Lead 360 / stage page
        const saved = useSalesStore.getState().getLead(leadId!)
        setSavedLeadId(leadId!)
        setSavedLeadNo(saved?.leadNo ?? null)
        dirtyBaseline.current = dirtySnapshotRef.current
        dirtyBaselineReady.current = true
        resetDirty()
        showToast('Lead updated successfully', 'success')
        if (mode === 'default' && leadId) {
          navigate(routes.view(leadId))
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Lead save failed', 'error')
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveLead('default')
  }

  const showGapSignals = crmShowCompletenessHints({
    isEdit,
    dirty,
    saveAttempted,
  })

  if (id && !existing) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12">
        <p className="text-erp-muted">Lead not found.</p>
        <button type="button" className="text-sm font-semibold text-erp-primary hover:underline" onClick={() => navigate(routes.base)}>
          Back to leads
        </button>
      </div>
    )
  }

  const isConverted = isEdit && (
    existing?.stage === 'converted_to_opportunity'
    || existing?.lifecycleStatus === 'converted'
    || Boolean(quoteOpportunityId)
  )
  const canConvertOpp = isEdit
    && formPolicy.canSave
    && formPolicy.mode !== 'limited'
    && formPolicy.mode !== 'readonly'
    && leadStage === 'qualified'
    && Boolean(company.customerId)
    && !isConverted

  const commandBar = isEdit && id ? (
    <ErpCardCommandBar
      inline
      moreActions={[
        {
          id: 'convert',
          label: 'Convert to Opportunity',
          icon: Handshake,
          onClick: () => navigate(`/crm/opportunities/new?customerId=${company.customerId ?? ''}&leadId=${id}`),
          disabled: !canConvertOpp,
          disabledReason: isConverted ? 'Already converted' : 'Qualify and link company first',
        },
        ...(quoteOpportunityId
          ? [{
              id: 'quotation',
              label: 'Create Quotation',
              icon: FileText,
              onClick: () => navigate(`/crm/quotations/new?opportunityId=${quoteOpportunityId}`),
            }]
          : []),
        {
          id: 'follow-up',
          label: 'Schedule Activity',
          icon: Calendar,
          onClick: () => setNextFollowUpDate(todayIso()),
        },
        { id: 'call', label: 'Call', icon: Phone, onClick: () => mobile && window.open(`tel:${mobile}`), disabled: !mobile },
        { id: 'email', label: 'Email', icon: Mail, onClick: () => email && window.open(`mailto:${email}`), disabled: !email },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, onClick: () => mobile && window.open(`https://wa.me/${mobile.replace(/\D/g, '')}`), disabled: !mobile },
        { id: 'view', label: 'View Lead 360', icon: ExternalLink, onClick: () => navigate(routes.view(id)) },
        { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => navigate(`${routes.new}?duplicateFrom=${id}`) },
      ]}
    />
  ) : undefined

  function handleCancel() {
    if (!isEdit) {
      clearDraft()
      setLeadAttachments('draft:new', [])
    }
    resetDirty()
    // Edit: discard and return to Lead 360. Create: back to register.
    if (isEdit && id) navigate(routes.view(id))
    else navigate(routes.base)
  }

  const factBox = (
    <LeadSmartOverviewPanel
      input={smartOverviewInput}
      showGapSignals={showGapSignals}
      onGoToSection={scrollToSection}
      onCreateOpportunity={() => {
        if (isEdit) {
          if (!canConvertOpp) {
            showToast(
              isConverted
                ? 'Lead is already converted to an opportunity'
                : 'Qualify the lead and link a company before converting.',
              'warning',
            )
            return
          }
          if (id && company.customerId) {
            navigate(`/crm/opportunities/new?customerId=${company.customerId}&leadId=${id}`)
          }
          return
        }
        saveLead('opportunity')
      }}
      onCreateQuotation={
        quoteOpportunityId
          ? () => navigate(`/crm/quotations/new?opportunityId=${quoteOpportunityId}`)
          : undefined
      }
      onScheduleFollowUp={() => {
        if (isEdit && existing) setFollowUpOpen(true)
        else scrollToSection('followup')
      }}
      onLogActivity={() => {
        if (isEdit && existing) setLogActivityOpen(true)
        else notify.info('Save the lead first, then log an activity')
      }}
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={isEdit ? 'Edit Lead' : 'New Lead'}
        badge="CRM"
        className="crm-lead-form-page enterprise-workspace--dynamics-form enterprise-workspace--crm-smart-overview"
        recordNo={existing?.leadNo ?? 'New'}
        recordTitle={company.prospectName.trim() || (isEdit ? existing?.prospectName : 'New Lead') || 'New Lead'}
        status={formatStatus(lifecycleStatus)}
        statusTone={leadStage === 'closed' ? 'critical' : leadStage === 'qualified' ? 'success' : 'info'}
        stage={leadStageLabel(leadStage)}
        createdDate={formatDate(createdDate)}
        owner={selectedOwner?.name ?? session.name}
        priority={leadPriorityLabel(priority)}
        company={company.prospectName || undefined}
        lastSaved={isEdit && existing?.modifiedAt ? `Last updated ${formatDate(existing.modifiedAt)}` : autosaveLabel}
        favoritePath={isEdit && id ? routes.view(id) : routes.new}
        breadcrumbs={isEdit ? leadEditBreadcrumbs(routes) : leadNewBreadcrumbs(routes)}
        commandBar={commandBar}
        factBox={factBox}
        suppressFactBoxRecord
        onSubmit={handleSubmit}
        onSaveShortcut={() => saveLead('default')}
        onSaveCloseShortcut={() => saveLead('close')}
        onSaveAndNewShortcut={!isEdit ? () => saveLead('new') : undefined}
        stickyFooter
        collapsibleFactBox
        factBoxLabel="Smart Context"
        footer={(
          <FormActionBar
            sticky
            busy={isSubmitting}
            dirty={dirty}
            disabled={isEdit && !formPolicy.canSave}
            disabledReason={isEdit && !formPolicy.canSave ? formPolicy.reason : undefined}
            onSave={() => saveLead('default')}
            onSaveAndNew={!isEdit ? () => saveLead('new') : undefined}
            onSaveAndClose={() => saveLead('close')}
            onCancel={handleCancel}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete · Ctrl+S Save · Ctrl+Shift+S Save &amp; Close
                {!isEdit ? ' · Alt+N Save & New' : ''}
              </span>
            )}
          />
        )}
      >
        <div ref={formRootRef} className="erp-form-body crm-lead-form-body">
        {isEdit && formPolicy.reason ? (
          <p
            className="mb-3 rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[13px] text-erp-muted"
            role="status"
          >
            {formPolicy.reason}
          </p>
        ) : null}
        {savedLeadId ? (
          <LeadSaveNextActionsPanel
            leadId={savedLeadId}
            leadNo={savedLeadNo ?? undefined}
            routes={routes}
            isEdit={isEdit}
            stage={leadStage}
            customerId={company.customerId}
            opportunityId={quoteOpportunityId}
            onDismiss={() => setSavedLeadId(null)}
          />
        ) : null}

        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
        />

        <ErpQuickEntrySection
          id="lead-section-quick"
          title="Quick Entry"
          subtitle="Company, contact, and ownership — expand only when you need more."
          columns={3}
          className="crm-lead-quick-entry"
        >
          <ErpFieldGroup columns={3}>
            <ErpFieldRow
              label="Company / Prospect"
              required
              colSpan={3}
              horizontal={false}
              dataField="prospectName"
              fieldState={inlineValidation.fieldState('prospectName')}
              fieldError={inlineValidation.fieldError('prospectName') ?? validationErrors.prospectName}
            >
              <CompanyProspectSelect
                value={company}
                onChange={(v) => {
                  const companyChanged = v.customerId !== company.customerId
                  setCompany(v)
                  if (companyChanged && !v.customerId) {
                    setContactId('')
                  }
                  if (v.customerId || v.prospectName.trim()) {
                    setValidationErrors((prev) => {
                      if (!prev.prospectName) return prev
                      const next = { ...prev }
                      delete next.prospectName
                      return next
                    })
                  }
                }}
                onBlur={() => inlineValidation.touch('prospectName')}
                onCompanyLinked={onCompanyLinked}
                onCompanyCreateTyping={onCompanyCreateTyping}
                onCompanyCreateCancel={onCompanyCreateCancel}
                error={Boolean(inlineValidation.fieldError('prospectName') ?? validationErrors.prospectName)}
                autoFocus={!isEdit}
                disabled={fieldLocked('customerId') || fieldLocked('prospectName')}
              />
            </ErpFieldRow>
          </ErpFieldGroup>

          <ErpFieldGroup label="Contact" columns={3}>
            {company.customerId ? (
              <ErpFieldRow
                label="Contact Person"
                horizontal={false}
                dataField="contactPerson"
                fieldState={
                  (validationErrors.contactPerson) ? 'error' : undefined
                }
                fieldError={validationErrors.contactPerson}
              >
                <LeadContactSelect
                  customerId={company.customerId}
                  contactId={contactId || null}
                  onContactSelected={applyContactToLead}
                  disabled={fieldLocked('contactId') || fieldLocked('contactPerson')}
                />
              </ErpFieldRow>
            ) : (
              <ErpFieldRow
                label="Contact Person"
                horizontal={false}
                dataField="contactPerson"
                fieldState={validationErrors.contactPerson ? 'error' : undefined}
                fieldError={validationErrors.contactPerson}
              >
                <Input
                  value={contactPerson}
                  onChange={(e) => {
                    setContactId('')
                    setContactPerson(e.target.value)
                    setValidationErrors((prev) => {
                      if (!prev.contactPerson) return prev
                      const next = { ...prev }
                      delete next.contactPerson
                      return next
                    })
                  }}
                  placeholder="Primary contact"
                  className="erp-input"
                  error={Boolean(validationErrors.contactPerson)}
                  disabled={fieldLocked('contactPerson')}
                />
              </ErpFieldRow>
            )}
            <ErpFieldRow
              label="Mobile"
              horizontal={false}
              dataField="mobile"
              fieldState={
                (inlineValidation.fieldError('mobile') ?? validationErrors.mobile)
                  ? 'error'
                  : inlineValidation.fieldState('mobile')
              }
              fieldError={inlineValidation.fieldError('mobile') ?? validationErrors.mobile}
            >
              <MobileInput
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value)
                  setValidationErrors((prev) => {
                    if (!prev.mobile) return prev
                    const next = { ...prev }
                    delete next.mobile
                    return next
                  })
                }}
                onBlur={() => inlineValidation.touch('mobile')}
                placeholder="10-digit mobile"
                maxDigits={15}
                className="erp-input"
                error={Boolean(inlineValidation.fieldError('mobile') ?? validationErrors.mobile)}
                disabled={fieldLocked('mobile')}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Email"
              horizontal={false}
              dataField="email"
              fieldState={
                (inlineValidation.fieldError('email') ?? validationErrors.email)
                  ? 'error'
                  : inlineValidation.fieldState('email')
              }
              fieldError={inlineValidation.fieldError('email') ?? validationErrors.email}
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setValidationErrors((prev) => {
                    if (!prev.email) return prev
                    const next = { ...prev }
                    delete next.email
                    return next
                  })
                }}
                onBlur={() => inlineValidation.touch('email')}
                placeholder="contact@company.com"
                className="erp-input"
                error={Boolean(inlineValidation.fieldError('email') ?? validationErrors.email)}
                disabled={fieldLocked('email')}
              />
            </ErpFieldRow>
          </ErpFieldGroup>

          <ErpFieldGroup label="Ownership & status" columns={3}>
            <ErpFieldRow
              label="Lead Owner"
              required
              horizontal={false}
              dataField="leadOwnerId"
              fieldState={inlineValidation.fieldState('leadOwnerId')}
              fieldError={inlineValidation.fieldError('leadOwnerId') ?? validationErrors.leadOwnerId}
            >
              <ErpSmartSelect
                options={ownerSelectOptions}
                value={leadOwnerId}
                onChange={(v) => { if (v) setLeadOwnerId(v) }}
                onBlur={() => inlineValidation.touch('leadOwnerId')}
                placeholder="Select owner…"
                appearance="dropdown"
                error={Boolean(inlineValidation.fieldError('leadOwnerId') ?? validationErrors.leadOwnerId)}
                disabled={fieldLocked('leadOwnerId')}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Lead Source"
              horizontal={false}
              hint={
                company.customerId && source === 'existing_customer'
                  ? 'Linked to Company Master — set to Existing Customer'
                  : undefined
              }
            >
              <ErpSmartSelect
                options={sourceSelectOptions}
                value={source}
                onChange={(v) => v && setSource(v)}
                placeholder="Select source…"
                appearance="dropdown"
                disabled={fieldLocked('source')}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Priority"
              required
              horizontal={false}
              dataField="priority"
              fieldState={inlineValidation.fieldState('priority')}
              fieldError={inlineValidation.fieldError('priority') ?? validationErrors.priority}
            >
              <CrmLeadPriorityChips
                value={priority}
                onChange={(v) => {
                  setPriority(v)
                  inlineValidation.touch('priority')
                }}
                onBlur={() => inlineValidation.touch('priority')}
                options={leadPriorityOptions}
                disabled={fieldLocked('priority')}
              />
            </ErpFieldRow>
          </ErpFieldGroup>

          <ErpFieldGroup columns={3}>
            <ErpFieldRow label="Lead Stage" required horizontal={false}>
              <ErpSmartSelect
                options={leadStageSelectOptions}
                value={leadStage}
                onChange={(value) => value && handleLeadStageChange(value)}
                placeholder="Select lead stage…"
                appearance="dropdown"
                disabled={!formPolicy.canChangeStage || fieldLocked('stage')}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Created Date"
              required
              horizontal={false}
              dataField="createdDate"
              fieldState={inlineValidation.fieldState('createdDate')}
              fieldError={inlineValidation.fieldError('createdDate') ?? validationErrors.createdDate}
            >
              <Input
                type="date"
                value={createdDate}
                min={getCrmDateInputMin()}
                max={getDateInputMin()}
                onChange={(e) => setCreatedDate(e.target.value)}
                onBlur={() => inlineValidation.touch('createdDate')}
                className="erp-input"
                error={Boolean(inlineValidation.fieldError('createdDate') ?? validationErrors.createdDate)}
                disabled={fieldLocked('createdDate')}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Next Follow-up Date"
              horizontal={false}
              dataField="nextFollowUpDate"
              fieldState={validationErrors.nextFollowUpDate ? 'error' : 'idle'}
              fieldError={validationErrors.nextFollowUpDate}
            >
              <Input
                type="date"
                data-field="nextFollowUpDate"
                value={nextFollowUpDate}
                min={getDateInputMin()}
                max={getCrmDateInputMax()}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="erp-input"
              />
            </ErpFieldRow>
          </ErpFieldGroup>
        </ErpQuickEntrySection>

        <ErpCardSection
          id="lead-section-enquiry-notes"
          title="Notes"
          subtitle="Enquiry context and conversation notes — use a full text area, not a single line."
          icon={FileText}
          accent="slate"
          columns={1}
          className="crm-lead-notes-card"
          collapsible
          defaultOpen
          forceOpenKey={sectionForceOpenKey}
        >
          <ErpFieldRow
            label="Notes"
            required
            colSpan={3}
            horizontal={false}
            dataField="remarks"
            fieldState={
              (inlineValidation.fieldError('remarks') ?? validationErrors.remarks)
                ? 'error'
                : inlineValidation.fieldState('remarks')
            }
            fieldError={inlineValidation.fieldError('remarks') ?? validationErrors.remarks}
            hint="Capture call summaries, requirements, and next steps."
          >
            <Textarea
              rows={5}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              onBlur={() => inlineValidation.touch('remarks')}
              placeholder="Context from first call or enquiry…"
              className="erp-input"
              error={Boolean(inlineValidation.fieldError('remarks') ?? validationErrors.remarks)}
              disabled={fieldLocked('remarks')}
            />
          </ErpFieldRow>
        </ErpCardSection>

        <ErpAdditionalInfoToggle
          open={showAdditionalDetails}
          onToggle={() => {
            if (showAdditionalDetails) setActiveSection('quick')
            toggleAdditionalDetails()
          }}
          panelId={additionalPanelId}
          sectionCount={additionalSectionItems.length}
          attentionCount={additionalSectionItems.filter((s) => s.tone === 'missing').length}
        />

        <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
          <ErpAdditionalSectionNav
            sections={additionalSectionItems}
            activeId={activeAdditionalSection}
            onSelect={selectAdditionalSection}
            title=""
          />

          {activeAdditionalSection === 'requirement' ? (
            <ErpCardSection
              id="lead-section-requirement"
              title="Products"
              subtitle="Search products, set qty and pricing — totals roll up to commercial value."
              icon={ClipboardList}
              accent="teal"
              columns={4}
              forceOpenKey={sectionForceOpenKey}
            >
              <div className="col-span-full" data-field="productRequirement">
                <ErpLineItemsGrid
                  lines={requirementLines}
                  onChange={(next) => {
                    handleRequirementLinesChange(next)
                  }}
                  productOptions={productOptions}
                  productPickMap={pickMap}
                  probability={Number(probability) || 0}
                  variant="opportunity"
                />
                {validationErrors.productRequirement ? (
                  <p className="erp-field-row__error mt-2">
                    {validationErrors.productRequirement}
                  </p>
                ) : null}
              </div>
              <ErpFieldRow label="Industry" colSpan={3}>
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry segment" className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'commercial' ? (
            <ErpCardSection
              id="lead-section-commercial"
              title="Commercial"
              subtitle={
                requirementLineSummary.grandTotal > 0
                  ? 'Expected revenue rolls up from product lines — adjust probability and close date.'
                  : 'Revenue estimation and forecasting.'
              }
              icon={Banknote}
              accent="green"
              columns={4}
            >
              <ErpFieldRow label="Expected Revenue (₹)" dataField="expectedValue" fieldState={inlineValidation.fieldState('expectedValue')}>
                <Input
                  type="number"
                  min={0}
                  value={expectedValue}
                  onChange={(e) => { setExpectedValue(Number(e.target.value)); inlineValidation.touch('expectedValue') }}
                  placeholder="Expected revenue"
                  className="erp-input"
                  readOnly={requirementLineSummary.grandTotal > 0}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Probability">
                <div className="dyn-probability-field">
                  <div className="dyn-probability-field__track">
                    <input
                      type="range"
                      className="dyn-probability-field__range"
                      min={0}
                      max={100}
                      step={5}
                      value={probability}
                      onChange={(e) => setProbability(Number(e.target.value))}
                      aria-label="Win probability"
                    />
                    <span className="dyn-probability-field__value">{probability}%</span>
                  </div>
                </div>
              </ErpFieldRow>
              <ErpFieldRow
                label="Expected Closing Date"
                dataField="expectedCloseDate"
                fieldState={validationErrors.expectedCloseDate ? 'error' : 'idle'}
                fieldError={validationErrors.expectedCloseDate}
              >
                <Input
                  type="date"
                  value={expectedCloseDate}
                  min={isEdit ? getCrmDateInputMin() : getDateInputMin()}
                  max={getCrmDateInputMax()}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="erp-input"
                />
              </ErpFieldRow>
              <ErpFieldRow label="Currency" readOnly>
                <Input value="INR (₹)" readOnly className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'followup' ? (
            <ErpCardSection
              id="lead-section-followup"
              title="Follow-up"
              subtitle="Schedule next action on save."
              icon={Calendar}
              accent="amber"
              columns={4}
            >
              <ErpFieldRow label="Follow-up Type" horizontal={false}>
                <ErpSmartSelect
                  options={followUpSelectOptions}
                  value={followUpType}
                  onChange={(v) => v && setFollowUpType(v)}
                  placeholder="Select type…"
                  appearance="dropdown"
                />
              </ErpFieldRow>
              <ErpFieldRow label="Assigned To" readOnly horizontal={false}>
                <Input value={selectedOwner?.name ?? '—'} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Remarks" colSpan={3} horizontal={false}>
                <Textarea rows={2} value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} placeholder="Follow-up notes" className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'notes' ? (
            <ErpCardSection
              id="lead-section-notes"
              title="Internal notes"
              subtitle="Internal notes and reference tags."
              icon={FileText}
              accent="slate"
              columns={4}
            >
              <ErpFieldRow label="Internal Notes" colSpan={3} horizontal={false}>
                <Textarea rows={5} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal team notes" className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Reference" colSpan={3}>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Campaign / RFQ ref" className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'documents' ? (
            <ErpCardSection
              id="lead-section-documents"
              title="Attachments"
              subtitle="Choose document type, then upload supporting files."
              icon={Paperclip}
              accent="slate"
              columns={1}
            >
              <CrmTypedDocumentUpload
                attachments={attachments}
                onChange={setAttachments}
              />
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'status' ? (
            <ErpCardSection
              id="lead-section-status"
              title="Status & location"
              subtitle="Territory, branch, and lifecycle."
              icon={Building2}
              accent="violet"
              columns={4}
              forceOpenKey={sectionForceOpenKey}
            >
              <ErpFieldRow label="Territory" readOnly>
                <Input value={territory} readOnly className="erp-input" />
              </ErpFieldRow>
              <LocationFieldRow
                value={locationId}
                onChange={(locId) => setLocationId(locId)}
                usage="sales"
              />
              <ErpFieldRow label="Lead Status">
                <Select native value={activityStatus} onChange={(e) => setActivityStatus(e.target.value as LeadActivityStatus)} className="erp-input">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </ErpFieldRow>
              <ErpFieldRow label="Lifecycle" readOnly>
                <Input value={formatStatus(lifecycleStatus)} readOnly className="erp-input" />
              </ErpFieldRow>
              {activityStatus === 'inactive' ? (
                <ErpFieldRow
                  label="Inactive Reason"
                  colSpan={3}
                  dataField="inactiveReason"
                  fieldState={validationErrors.inactiveReason ? 'error' : 'idle'}
                  fieldError={validationErrors.inactiveReason}
                >
                  <Select native value={inactiveReason} onChange={(e) => setInactiveReason(e.target.value)} className="erp-input">
                    <option value="">— Select reason —</option>
                    {inactiveReasons.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </ErpFieldRow>
              ) : null}
              {leadStage === 'not_qualified' ? (
                <ErpFieldRow
                  label="Not Qualified Reason"
                  colSpan={3}
                  dataField="notQualifiedReason"
                  fieldState={validationErrors.notQualifiedReason ? 'error' : 'idle'}
                  fieldError={validationErrors.notQualifiedReason}
                >
                  <Select native value={notQualifiedReason} onChange={(e) => setNotQualifiedReason(e.target.value)} className="erp-input">
                    <option value="">— Select reason —</option>
                    {notQualifiedReasons.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </ErpFieldRow>
              ) : null}
              {leadStage === 'closed' ? (
                <>
                  <ErpFieldRow
                    label="Closed Date"
                    dataField="closedDate"
                    fieldState={validationErrors.closedDate ? 'error' : 'idle'}
                    fieldError={validationErrors.closedDate}
                  >
                    <Input
                      type="date"
                      value={closedDate}
                      min={createdDate.trim() || getCrmDateInputMin()}
                      max={getDateInputMin()}
                      onChange={(e) => setClosedDate(e.target.value)}
                      className="erp-input"
                    />
                  </ErpFieldRow>
                  <ErpFieldRow
                    label="Closed Reason"
                    colSpan={2}
                    dataField="closedReason"
                    fieldState={validationErrors.closedReason ? 'error' : 'idle'}
                    fieldError={validationErrors.closedReason}
                  >
                    <Select native value={closedReason} onChange={(e) => setClosedReason(e.target.value)} className="erp-input">
                      <option value="">— Select reason —</option>
                      {closedReasons.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </Select>
                  </ErpFieldRow>
                </>
              ) : null}
            </ErpCardSection>
          ) : null}
        </ErpAdditionalInfoPanel>
        </div>
      </CrmCardFormShell>
      {isEdit && existing ? (
        <>
          <QuickFollowUpDrawer
            open={followUpOpen}
            onClose={() => setFollowUpOpen(false)}
            context={leadEngagementContext(existing)}
          />
          <LogActivityDrawer
            open={logActivityOpen}
            onClose={() => setLogActivityOpen(false)}
            context={{ ...leadEngagementContext(existing), lockLead: true }}
          />
        </>
      ) : null}
    </>
  )
}

/** Route export — replaces legacy SalesForms LeadFormPage */
export function LeadFormPage() {
  return <CrmLeadFormPage />
}
