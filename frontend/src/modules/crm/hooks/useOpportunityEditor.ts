import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard'
import { useDocumentLocation } from '../../../hooks/useDocumentLocation'
import { useCrmOwnerOptions, useOpportunityPriorityOptions, useResolvedOpportunityStages } from '../../../hooks/useCrmMasters'
import { useCrmStore } from '../../../store/crmStore'
import { resolveStoreAction } from '../../../store/storeAction'
import { notify } from '../../../store/toastStore'
import {
  fieldErrorsToMessages,
  handleInvalidSubmit,
  type FieldErrorMap,
} from '../../../utils/formValidation'
import { useMasterStore } from '../../../store/masterStore'
import { useOpportunityAttachmentStore } from '../../../store/opportunityAttachmentStore'
import type { CrmTypedAttachment } from '../../../types/crmDocuments'
import type { OpportunityLine, OpportunityPriority, OpportunityStage } from '../../../types/crm'
import {
  calcOpportunityLinesSummary,
  calcWeightedValue,
  opportunityLineUnitPriceFieldKey,
  resolveOpportunityLines,
  syncOpportunityLines,
  UNIT_PRICE_REQUIRED_MESSAGE,
} from '../../../utils/opportunityLineCalc'
import { validateOpportunityForm } from '../../../utils/validation/crmSchemas/opportunitySchema'
import { sanitizeOpportunityScopeNotes } from '../../../utils/leadRequirementLines'
import { useProductMasterOptionMap } from '../../../utils/opportunityProductOptions'
import { resolveOpportunityPriorityOptions } from '../../../utils/opportunityUtils'
import { canCrmPermission } from '../../../utils/permissions'

export type OpportunityEditorActionId =
  | 'save'
  | 'saveAndClose'
  | 'saveAndQuotation'
  | 'cancel'
  | 'open360'
  | 'moveStage'
  | 'markWon'
  | 'markLost'
  | 'putOnHold'
  | 'reopen'
  | 'duplicate'
  | 'archive'
  | 'delete'
  | 'viewAudit'
  | 'logActivity'

export type OpportunitySaveMode = 'stay' | 'close' | 'quotation' | 'open360'

export type OpportunityEditorDialog =
  | { type: 'discard' }
  | { type: 'open360' }
  | { type: 'moveStage'; presetStage?: OpportunityStage }
  | { type: 'existingQuotation' }
  | { type: 'delete' }
  | null

const SAVE_TOAST = 'Opportunity saved successfully.'

const OPP_FIELD_ORDER = ['customerId', 'opportunityName', 'expectedCloseDate', 'ownerId', 'priority', 'stage', 'probability'] as const
const OPP_FIELD_LABELS: Record<string, string> = {
  customerId: 'Customer',
  opportunityName: 'Opportunity Name',
  expectedCloseDate: 'Expected Close Date',
  ownerId: 'Owner',
  priority: 'Priority',
  stage: 'Stage',
  probability: 'Probability',
}
const OPP_SECTION_BY_FIELD: Record<string, string> = {
  customerId: 'opp-section-general',
  opportunityName: 'opp-section-general',
  expectedCloseDate: 'opp-section-commercial',
  ownerId: 'opp-section-general',
  priority: 'opp-section-general',
  stage: 'opp-section-general',
  probability: 'opp-section-commercial',
}

function detailsPath(id: string) {
  return `/crm/opportunities/${id}`
}

function editPath(id: string) {
  return `/crm/opportunities/${id}/edit`
}

function quotationNewPath(id: string) {
  return `/crm/quotations/new?opportunityId=${encodeURIComponent(id)}`
}

export function useOpportunityEditor(opportunityId: string | undefined) {
  const navigate = useNavigate()
  const opportunity = useCrmStore((s) => (opportunityId ? s.opportunities.find((o) => o.id === opportunityId) : undefined))
  const updateOpportunity = useCrmStore((s) => s.updateOpportunity)
  const moveOpportunityStage = useCrmStore((s) => s.moveOpportunityStage)
  const deleteOpportunity = useCrmStore((s) => s.deleteOpportunity)
  const contacts = useCrmStore((s) => s.contacts)
  const customer = useMasterStore((s) => s.customers.find((c) => c.id === opportunity?.customerId))
  const products = useMasterStore((s) => s.products)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const product = useMasterStore((s) => (opportunity?.productId ? s.getProduct(opportunity.productId) : undefined))
  const ownerOptions = useCrmOwnerOptions()
  const priorityOptions = useOpportunityPriorityOptions()
  const stageOptions = useResolvedOpportunityStages()
  const { options: productOptions, pickMap } = useProductMasterOptionMap(products, items, uoms)

  const canUpdate = canCrmPermission('crm.opportunity.update')
  const canClose = canCrmPermission('crm.opportunity.close')
  const canDelete = canCrmPermission('crm.opportunity.delete')

  const resolvedPriorities = useMemo(
    () => (priorityOptions.length > 0 ? priorityOptions : resolveOpportunityPriorityOptions().map((p) => ({ value: p.value, label: p.label }))),
    [priorityOptions],
  )

  const initialLines = useMemo(
    () => (opportunity ? resolveOpportunityLines(opportunity, product) : []),
    [opportunity, product],
  )

  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})
  const [forceOpenProductsKey, setForceOpenProductsKey] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [dialog, setDialog] = useState<OpportunityEditorDialog>(null)
  const [targetStage, setTargetStage] = useState<OpportunityStage>('qualified')
  const [lostReason, setLostReason] = useState('')
  const [manualWon, setManualWon] = useState(false)

  const [opportunityName, setOpportunityName] = useState(opportunity?.opportunityName ?? '')
  const [contactId, setContactId] = useState(opportunity?.contactId ?? '')
  const [lines, setLines] = useState<OpportunityLine[]>(initialLines)
  const [probability, setProbability] = useState(String(opportunity?.probability ?? 0))
  const [expectedCloseDate, setExpectedCloseDate] = useState(opportunity?.expectedCloseDate?.slice(0, 10) ?? '')
  const [priority, setPriority] = useState<OpportunityPriority>(opportunity?.priority ?? 'medium')
  const [ownerId, setOwnerId] = useState(opportunity?.ownerId ?? ownerOptions[0]?.value ?? 'user-demo')
  const [productRequirement, setProductRequirement] = useState(() =>
    sanitizeOpportunityScopeNotes(opportunity?.productRequirement),
  )
  const { locationId, setLocationId } = useDocumentLocation('sales', opportunity?.locationId)

  const attachmentScopeId = opportunityId ?? 'draft:edit-opp'
  const setOpportunityAttachments = useOpportunityAttachmentStore((s) => s.setForOpportunity)
  const [attachments, setAttachmentsState] = useState<CrmTypedAttachment[]>(() =>
    useOpportunityAttachmentStore.getState().getForOpportunity(attachmentScopeId),
  )

  useEffect(() => {
    setAttachmentsState(useOpportunityAttachmentStore.getState().getForOpportunity(attachmentScopeId))
  }, [attachmentScopeId])

  const setAttachments = useCallback((next: CrmTypedAttachment[]) => {
    setAttachmentsState(next)
    setOpportunityAttachments(attachmentScopeId, next)
  }, [attachmentScopeId, setOpportunityAttachments])

  const formHydratedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!opportunity) return
    const key = `${opportunity.id}:${opportunity.modifiedAt ?? ''}`
    if (formHydratedFor.current === key) return
    // Initial hydrate / external store refresh only — never wipe mid-edit dirty state on same snapshot.
    if (formHydratedFor.current?.startsWith(`${opportunity.id}:`) && formHydratedFor.current !== key) {
      // Store updated after save — refresh form from server response without clearing mid-type if saving.
      if (isSaving) return
    }
    formHydratedFor.current = key
    setOpportunityName(opportunity.opportunityName ?? '')
    setContactId(opportunity.contactId ?? '')
    setLines(resolveOpportunityLines(opportunity, product))
    setProbability(String(opportunity.probability ?? 0))
    setExpectedCloseDate(opportunity.expectedCloseDate?.slice(0, 10) ?? '')
    setPriority(opportunity.priority ?? 'medium')
    setOwnerId(opportunity.ownerId ?? ownerOptions[0]?.value ?? 'user-demo')
    setProductRequirement(sanitizeOpportunityScopeNotes(opportunity.productRequirement))
  }, [opportunity, product, ownerOptions, isSaving])

  const customerContacts = useMemo(
    () => contacts.filter((c) => c.customerId === opportunity?.customerId),
    [contacts, opportunity?.customerId],
  )
  const owner = ownerOptions.find((o) => o.value === ownerId) ?? { value: ownerId, label: opportunity?.ownerName ?? '—' }
  const summary = calcOpportunityLinesSummary(syncOpportunityLines(lines))
  const dealValue = summary.grandTotal
  const weighted = calcWeightedValue(dealValue, Number(probability) || 0)
  const hasValidLine = lines.some((l) => l.productOrItem?.trim())

  const isEditable = Boolean(opportunity && opportunity.status === 'open')
  const { dirty: isDirty, markDirty, resetDirty } = useUnsavedChangesGuard(isEditable)
  const dirtyBaselineReady = useRef(false)
  const dirtyBaseline = useRef('')
  const dirtySnapshot = useMemo(
    () =>
      JSON.stringify({
        opportunityName,
        contactId,
        lines,
        probability,
        expectedCloseDate,
        priority,
        ownerId,
        productRequirement,
        locationId,
        attachmentIds: attachments.map((a) => a.id),
      }),
    [
      opportunityName,
      contactId,
      lines,
      probability,
      expectedCloseDate,
      priority,
      ownerId,
      productRequirement,
      locationId,
      attachments,
    ],
  )
  const dirtySnapshotRef = useRef(dirtySnapshot)
  dirtySnapshotRef.current = dirtySnapshot

  useEffect(() => {
    if (!isEditable) return
    dirtyBaselineReady.current = false
    const timer = window.setTimeout(() => {
      dirtyBaseline.current = dirtySnapshotRef.current
      dirtyBaselineReady.current = true
      resetDirty()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [opportunity?.id, opportunity?.modifiedAt, isEditable, resetDirty])

  useEffect(() => {
    if (!dirtyBaselineReady.current) return
    if (dirtySnapshot !== dirtyBaseline.current) markDirty()
    else resetDirty()
  }, [dirtySnapshot, markDirty, resetDirty])

  const form = useMemo(() => ({
    opportunityName,
    setOpportunityName,
    contactId,
    setContactId,
    lines,
    setLines,
    probability,
    setProbability,
    expectedCloseDate,
    setExpectedCloseDate,
    priority,
    setPriority,
    ownerId,
    setOwnerId,
    productRequirement,
    setProductRequirement,
    locationId,
    setLocationId,
    attachments,
    setAttachments,
  }), [
    opportunityName,
    contactId,
    lines,
    probability,
    expectedCloseDate,
    priority,
    ownerId,
    productRequirement,
    locationId,
    attachments,
    setAttachments,
    setLocationId,
  ])

  const runValidation = useCallback(() => {
    if (!opportunity) {
      return {
        fieldErrors: { _msg_0: 'Opportunity not found.' } as FieldErrorMap,
        rowErrors: {} as Record<string, string[]>,
      }
    }
    const { fieldErrors, rowErrors } = validateOpportunityForm({
      customerId: opportunity.customerId,
      opportunityName,
      ownerId,
      stage: opportunity.stage,
      probability,
      expectedCloseDate,
      lines,
    })
    // Editor-only rules (not part of shared create schema)
    if (!priority) fieldErrors.priority = 'Priority is required.'
    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId)
      if (!contact || contact.customerId !== opportunity.customerId) {
        fieldErrors[`_msg_${Object.keys(fieldErrors).length}`] = 'Selected contact must belong to the customer.'
      }
    }
    return { fieldErrors, rowErrors }
  }, [opportunity, lines, ownerId, probability, opportunityName, priority, expectedCloseDate, contactId, contacts])

  const persist = useCallback(async (): Promise<boolean> => {
    if (!opportunityId || !opportunity) return false
    if (!canUpdate) {
      notify.error('You do not have permission to update opportunities.')
      return false
    }
    const { fieldErrors, rowErrors: rErr } = runValidation()
    setRowErrors(rErr)
    if (Object.keys(fieldErrors).length || Object.keys(rErr).length) {
      const fieldMap = fieldErrors
      const lineKeys = Object.keys(fieldMap).filter(
        (k) => k.startsWith('unitPrice-') || k.startsWith('qty-') || k.startsWith('product-') || k.startsWith('taxPct-'),
      )
      const fieldOrder = [...OPP_FIELD_ORDER, ...lineKeys]
      const fieldLabels: Record<string, string> = { ...OPP_FIELD_LABELS }
      const sectionByField: Record<string, string> = { ...OPP_SECTION_BY_FIELD }
      for (const key of lineKeys) {
        sectionByField[key] = 'opp-section-products'
        if (key.startsWith('unitPrice-')) fieldLabels[key] = 'Unit Price'
        else if (key.startsWith('qty-')) fieldLabels[key] = 'Quantity'
        else if (key.startsWith('product-')) fieldLabels[key] = 'Product / Item'
        else if (key.startsWith('taxPct-')) fieldLabels[key] = 'GST %'
      }
      if (!lineKeys.length && Object.keys(rErr).length) {
        const firstLineId = Object.keys(rErr)[0]!
        const key = opportunityLineUnitPriceFieldKey(firstLineId)
        fieldMap[key] = UNIT_PRICE_REQUIRED_MESSAGE
        fieldOrder.push(key)
        fieldLabels[key] = 'Unit Price'
        sectionByField[key] = 'opp-section-products'
      }
      handleInvalidSubmit({
        errors: fieldMap,
        fieldOrder,
        fieldLabels,
        sectionByField,
        expandSection: (sectionId) => {
          if (sectionId === 'opp-section-products') {
            setForceOpenProductsKey((k) => k + 1)
          }
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        onFieldErrors: (map) => setValidationErrors(fieldErrorsToMessages(map, fieldOrder)),
        delayMs: 120,
      })
      return false
    }
    setValidationErrors([])
    if (isSaving) return false

    setIsSaving(true)
    try {
      const ownerRecord = ownerOptions.find((o) => o.value === ownerId) ?? { value: ownerId, label: opportunity.ownerName }
      const syncedLines = syncOpportunityLines(lines)
      const r = await resolveStoreAction(
        updateOpportunity(opportunityId, {
          opportunityName: opportunityName.trim(),
          contactId: contactId || null,
          lines: syncedLines,
          productId: syncedLines[0]?.productId ?? opportunity.productId,
          value: calcOpportunityLinesSummary(syncedLines).grandTotal,
          probability: Number(probability) || 0,
          expectedCloseDate,
          priority,
          ownerId: ownerRecord.value,
          ownerName: ownerRecord.label,
          productRequirement: sanitizeOpportunityScopeNotes(productRequirement)
            || syncedLines.map((l) => l.productOrItem).filter(Boolean).join('; ')
            || opportunityName.trim(),
          locationId: locationId || null,
        }),
      )
      if (!r.ok) {
        setValidationErrors([r.error ?? 'Could not save'])
        notify.failed(r.error ?? 'Could not save opportunity')
        return false
      }
      setOpportunityAttachments(opportunityId, attachments)
      dirtyBaseline.current = dirtySnapshotRef.current
      resetDirty()
      notify.success(SAVE_TOAST)
      return true
    } finally {
      setIsSaving(false)
    }
  }, [
    opportunityId,
    opportunity,
    canUpdate,
    runValidation,
    isSaving,
    ownerOptions,
    ownerId,
    lines,
    updateOpportunity,
    opportunityName,
    contactId,
    probability,
    expectedCloseDate,
    priority,
    productRequirement,
    locationId,
    attachments,
    setOpportunityAttachments,
    resetDirty,
  ])

  const save = useCallback(async () => {
    if (!isDirty) return
    await persist()
  }, [isDirty, persist])

  const saveAndClose = useCallback(async () => {
    if (!opportunityId) return
    if (isDirty) {
      const ok = await persist()
      if (!ok) return
    }
    navigate(detailsPath(opportunityId))
  }, [isDirty, persist, opportunityId, navigate])

  const navigateToQuotation = useCallback(() => {
    if (!opportunityId || !opportunity) return
    if (opportunity.quotationId) {
      setDialog({ type: 'existingQuotation' })
      return
    }
    navigate(quotationNewPath(opportunityId))
  }, [opportunityId, opportunity, navigate])

  const saveAndCreateQuotation = useCallback(async () => {
    if (isDirty) {
      const ok = await persist()
      if (!ok) return
    }
    navigateToQuotation()
  }, [isDirty, persist, navigateToQuotation])

  const cancel = useCallback(() => {
    if (!opportunityId) return
    if (isDirty) {
      setDialog({ type: 'discard' })
      return
    }
    navigate(detailsPath(opportunityId))
  }, [opportunityId, isDirty, navigate])

  const confirmDiscard = useCallback(() => {
    if (!opportunityId) return
    resetDirty()
    setDialog(null)
    navigate(detailsPath(opportunityId))
  }, [opportunityId, resetDirty, navigate])

  const open360 = useCallback(() => {
    if (!opportunityId) return
    if (isDirty) {
      setDialog({ type: 'open360' })
      return
    }
    navigate(detailsPath(opportunityId))
  }, [opportunityId, isDirty, navigate])

  const confirmOpen360 = useCallback(async (mode: 'save' | 'discard') => {
    if (!opportunityId) return
    if (mode === 'save') {
      const ok = await persist()
      if (!ok) return
    } else {
      resetDirty()
    }
    setDialog(null)
    navigate(detailsPath(opportunityId))
  }, [opportunityId, persist, resetDirty, navigate])

  const openMoveStage = useCallback((preset?: OpportunityStage) => {
    if (!canUpdate && !canClose) {
      notify.error('You do not have permission to change opportunity stage.')
      return
    }
    const stage = preset ?? opportunity?.stage ?? 'qualified'
    setTargetStage(stage)
    setLostReason('')
    setManualWon(false)
    setDialog({ type: 'moveStage', presetStage: preset })
  }, [canUpdate, canClose, opportunity?.stage])

  const confirmMoveStage = useCallback(async () => {
    if (!opportunityId) return
    if (targetStage === 'lost' && !lostReason.trim()) {
      notify.warning('Lost reason is required.')
      return
    }
    if ((targetStage === 'won' || targetStage === 'lost') && !canClose) {
      notify.error('You do not have permission to close opportunities.')
      return
    }
    const r = await resolveStoreAction(
      moveOpportunityStage({
        opportunityId,
        stage: targetStage,
        lostReason: targetStage === 'lost' ? lostReason : undefined,
        manualWonApproval: targetStage === 'won' ? manualWon : undefined,
      }),
    )
    if (!r.ok) {
      notify.failed(r.error ?? 'Could not move stage')
      return
    }
    notify.success(`Stage updated to ${targetStage.replace(/_/g, ' ')}.`)
    setDialog(null)
    if (targetStage === 'won' || targetStage === 'lost') {
      resetDirty()
      navigate(detailsPath(opportunityId))
    }
  }, [opportunityId, targetStage, lostReason, manualWon, canClose, moveOpportunityStage, resetDirty, navigate])

  const markWon = useCallback(() => openMoveStage('won'), [openMoveStage])
  const markLost = useCallback(() => openMoveStage('lost'), [openMoveStage])
  const putOnHold = useCallback(() => openMoveStage('on_hold'), [openMoveStage])

  const duplicate = useCallback(() => {
    if (!opportunity) return
    const params = new URLSearchParams({ customerId: opportunity.customerId })
    if (opportunity.leadId) params.set('leadId', opportunity.leadId)
    navigate(`/crm/opportunities/new?${params.toString()}`)
  }, [opportunity, navigate])

  const viewAudit = useCallback(() => {
    if (!opportunityId) return
    if (isDirty) {
      setDialog({ type: 'open360' })
      return
    }
    navigate(detailsPath(opportunityId))
  }, [opportunityId, isDirty, navigate])

  const archive = useCallback(() => {
    if (!canDelete) {
      notify.error('You do not have permission to delete opportunities.')
      return
    }
    setDialog({ type: 'delete' })
  }, [canDelete])

  const confirmDelete = useCallback(async () => {
    if (!opportunityId) return
    setIsDeleting(true)
    try {
      const r = await resolveStoreAction(deleteOpportunity(opportunityId))
      if (!r.ok) {
        notify.failed(r.error ?? 'Delete failed')
        return
      }
      resetDirty()
      setDialog(null)
      notify.success('Opportunity archived.')
      navigate('/crm/opportunities')
    } finally {
      setIsDeleting(false)
    }
  }, [opportunityId, deleteOpportunity, resetDirty, navigate])

  const refresh = useCallback(() => {
    if (!opportunity) return
    formHydratedFor.current = null
    setOpportunityName(opportunity.opportunityName ?? '')
    setContactId(opportunity.contactId ?? '')
    setLines(resolveOpportunityLines(opportunity, product))
    setProbability(String(opportunity.probability ?? 0))
    setExpectedCloseDate(opportunity.expectedCloseDate?.slice(0, 10) ?? '')
    setPriority(opportunity.priority ?? 'medium')
    setOwnerId(opportunity.ownerId ?? ownerOptions[0]?.value ?? 'user-demo')
    setProductRequirement(sanitizeOpportunityScopeNotes(opportunity.productRequirement))
    setValidationErrors([])
    setRowErrors({})
  }, [opportunity, product, ownerOptions])

  const executeAction = useCallback(async (actionId: OpportunityEditorActionId) => {
    switch (actionId) {
      case 'save':
        await save()
        break
      case 'saveAndClose':
        await saveAndClose()
        break
      case 'saveAndQuotation':
        await saveAndCreateQuotation()
        break
      case 'cancel':
        cancel()
        break
      case 'open360':
        open360()
        break
      case 'moveStage':
        openMoveStage()
        break
      case 'markWon':
        markWon()
        break
      case 'markLost':
        markLost()
        break
      case 'putOnHold':
        putOnHold()
        break
      case 'reopen':
        notify.info('Reopen is available from Opportunity 360 for closed deals.')
        break
      case 'duplicate':
        duplicate()
        break
      case 'archive':
      case 'delete':
        archive()
        break
      case 'viewAudit':
        viewAudit()
        break
      case 'logActivity':
        if (opportunityId) navigate(detailsPath(opportunityId))
        break
      default:
        break
    }
  }, [
    save,
    saveAndClose,
    saveAndCreateQuotation,
    cancel,
    open360,
    openMoveStage,
    markWon,
    markLost,
    putOnHold,
    duplicate,
    archive,
    viewAudit,
    opportunityId,
    navigate,
  ])

  const closeDialog = useCallback(() => setDialog(null), [])

  const confirmExistingQuotation = useCallback((mode: 'openExisting' | 'createNew') => {
    if (!opportunityId || !opportunity) return
    setDialog(null)
    if (mode === 'openExisting' && opportunity.quotationId) {
      navigate(`/crm/quotations/${opportunity.quotationId}`)
      return
    }
    navigate(quotationNewPath(opportunityId))
  }, [opportunityId, opportunity, navigate])

  return {
    opportunity,
    customer,
    customerContacts,
    owner,
    ownerOptions,
    resolvedPriorities,
    stageOptions,
    productOptions,
    productPickMap: pickMap,
    form,
    summary,
    dealValue,
    weighted,
    hasValidLine,
    validationErrors,
    rowErrors,
    forceOpenProductsKey,
    setValidationErrors,
    isDirty,
    isSaving,
    isDeleting,
    isEditable,
    canUpdate,
    canClose,
    canDelete,
    dialog,
    targetStage,
    setTargetStage,
    lostReason,
    setLostReason,
    manualWon,
    setManualWon,
    save,
    saveAndClose,
    saveAndCreateQuotation,
    cancel,
    confirmDiscard,
    open360,
    confirmOpen360,
    moveStage: openMoveStage,
    markWon,
    markLost,
    putOnHold,
    duplicate,
    archive,
    viewAudit,
    refresh,
    executeAction,
    confirmMoveStage,
    confirmDelete,
    confirmExistingQuotation,
    closeDialog,
    detailsPath: opportunityId ? detailsPath(opportunityId) : '/crm/opportunities',
    editPath: opportunityId ? editPath(opportunityId) : '/crm/opportunities',
  }
}
