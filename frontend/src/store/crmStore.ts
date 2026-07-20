import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CrmActivity,
  CrmActivityType,
  CrmContact,
  FollowUp,
  FollowUpType,
  Opportunity,
  OpportunityPriority,
  OpportunityStage,
  QuotationDocument,
  QuotationDocumentStatus,
  QuotationPriceLine,
  QuotationSection,
  QuotationTemplate,
  QuotationTemplateSection,
} from '../types/crm'
import {
  APPROVAL_AMOUNT_THRESHOLD,
  DISCOUNT_APPROVAL_THRESHOLD,
} from '../types/crm'
import {
  formatCustomerBillingAddress,
  resolveCustomerShippingAddress,
} from '../utils/customerUtils'
import { applyPrimaryContactFlags, syncCrmContactToMaster, syncPrimaryToCustomer } from '../utils/contactSync'
import { getStageProbability, opportunityStageLabel } from '../utils/opportunityUtils'
import { resolveLeadConvertToOpportunityGate } from '../utils/leadUtils'
import { DEFAULT_QUOTATION_TEMPLATES } from '../data/quotations/quotationTemplates'
import { buildCrmSampleData, emptyCrmState } from '../data/crm/crmSampleSeed'
import { mergeAudit, stampCreated, stampModified } from '../utils/audit'
import { memoizedOnSource } from './selectors/memoizedGetters'
import { calcPriceSummary, syncLineTotals } from '../utils/crmQuotationCalc'
import {
  calcOpportunityLinesSummary,
  opportunityLinesToQuotationPriceLines,
  resolveOpportunityLines,
  syncOpportunityLines,
} from '../utils/opportunityLineCalc'
import { buildSalesOrderLinesFromQuotationDocument } from '../utils/crmQuotationSoLines'
import { enrichFollowUpStatus } from '../utils/crmMetrics'
import type { CrmSalesOrderHandoverInput } from '../utils/crmQuotationSoConversion'
import { validateQuotationForSoConversion } from '../utils/crmQuotationSoConversion'
import { canConvertQuotationToSalesOrderPermission } from '../utils/permissions/crm'
import {
  documentGrandTotal,
  populateDocumentFromOpportunity,
  primaryPriceLine,
  sectionContent,
} from '../utils/crmIntegration'
import { useMasterStore } from './masterStore'
import { nextDocumentNo } from '../utils/documentNumbers'
import { assertPermission } from '../utils/permissions'
import { useSalesStore } from './salesStore'
import { ERP_STORAGE_KEYS, erpStorage } from './persistConfig'
import { isApiMode } from '../config/apiConfig'
import type { StoreActionResult, StoreAction } from './storeAction'
import {
  formatMissingStageFieldsMessage,
  getMissingOpportunityStageFields,
} from '../config/crmStageRequirements'
import { cloneTemplateSections } from '../utils/quotationEngine/cloneSections'
import { applyCommercialMastersToSections, resolveDefaultCommercialTerm } from '../utils/quotationTermUtils'
import { mergeBuiltinQuotationTemplates } from '../utils/quotationEngine/builtinTemplateSync'
import {
  buildIsoTankShowcaseBundle,
  injectIsoTankShowcase,
  ISO_TANK_SHOWCASE_DOCUMENT_ID,
  ISO_TANK_SHOWCASE_OPPORTUNITY_ID,
  ISO_TANK_TEMPLATE_ID,
  isoTankSamplePriceLines,
} from '../data/crm/isoTankShowcase'
import { validateFollowUpAt } from '../utils/validation/crmDatePolicy'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function appendApproval(
  doc: QuotationDocument,
  action: import('../types/crm').QuotationApprovalEntry['action'],
  remarks: string | null,
): QuotationDocument['approvalHistory'] {
  const audit = stampCreated()
  return [
    ...(doc.approvalHistory ?? []),
    {
      id: genId('appr'),
      action,
      byId: audit.createdById,
      byName: audit.createdByName,
      at: audit.createdAt,
      remarks,
    },
  ]
}

function defaultDocumentFields(): Pick<
  QuotationDocument,
  | 'approvalHistory'
  | 'contactId'
  | 'salesOwnerId'
  | 'salesOwnerName'
  | 'commercialNotes'
  | 'technicalNotes'
> {
  return {
    approvalHistory: [],
    contactId: null,
    salesOwnerId: null,
    salesOwnerName: null,
    commercialNotes: null,
    technicalNotes: null,
  }
}

interface CreateFollowUpInput {
  followUpType: FollowUpType
  customerId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  quotationId?: string | null
  leadId?: string | null
  assignedTo: string
  assignedToName: string
  dueDate: string
  dueTime?: string
  priority?: OpportunityPriority
  notes?: string
  reminder?: boolean
}

interface CreateActivityInput {
  type: CrmActivityType
  subject: string
  description: string
  customerId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  quotationId?: string | null
  leadId?: string | null
  ownerId: string
  ownerName: string
  outcome?: string | null
  activityDate?: string
}

interface MoveStageInput {
  opportunityId: string
  stage: OpportunityStage
  lostReason?: string
  manualWonApproval?: boolean
}

interface CrmState {
  contacts: CrmContact[]
  opportunities: Opportunity[]
  activities: CrmActivity[]
  followUps: FollowUp[]
  quotationDocuments: QuotationDocument[]
  quotationTemplates: QuotationTemplate[]

  loadSampleData: (customerIds: string[]) => void
  resetCrm: () => void
  syncBuiltinQuotationTemplates: () => void
  ensureIsoTankShowcase: () => void

  getOpportunity: (id: string) => Opportunity | undefined
  getContact: (id: string) => CrmContact | undefined
  getContactsForCustomer: (customerId: string) => CrmContact[]
  getActivitiesForOpportunity: (opportunityId: string) => CrmActivity[]
  getActivitiesForCustomer: (customerId: string) => CrmActivity[]
  getActivitiesForLead: (leadId: string) => CrmActivity[]
  getFollowUpsForOpportunity: (opportunityId: string) => FollowUp[]
  getFollowUpsForLead: (leadId: string) => FollowUp[]
  getQuotationDocument: (id: string) => QuotationDocument | undefined
  getQuotationDocumentsForQuotation: (quotationId: string) => QuotationDocument[]
  getLatestQuotationDocument: (quotationId: string) => QuotationDocument | undefined
  getTemplate: (id: string) => QuotationTemplate | undefined
  duplicateQuotationTemplate: (
    sourceId: string,
    templateName?: string,
  ) => StoreAction<StoreActionResult & { templateId?: string }>
  createQuotationTemplate: (input: {
    templateName: string
    productFamily?: string
    sections?: QuotationTemplateSection[]
    defaultTerms?: string
    defaultWarranty?: string
    defaultExclusions?: string
    sourceTemplateId?: string
    printLayout?: QuotationTemplate['printLayout']
  }) => StoreAction<StoreActionResult & { templateId?: string }>
  updateQuotationTemplate: (
    id: string,
    patch: Partial<
      Pick<
        QuotationTemplate,
        | 'templateName'
        | 'productFamily'
        | 'sections'
        | 'defaultTerms'
        | 'defaultWarranty'
        | 'defaultExclusions'
        | 'isActive'
        | 'version'
        | 'printLayout'
      >
    >,
  ) => StoreAction<StoreActionResult>

  createOpportunity: (input: Omit<Opportunity, keyof import('../types/audit').AuditTrail | 'id' | 'opportunityNo' | 'healthScore' | 'lastActivityAt'>) => StoreAction<StoreActionResult & { opportunityId?: string }>
  createContact: (input: Omit<CrmContact, keyof import('../types/audit').AuditTrail | 'id' | 'masterContactId'>) => StoreAction<StoreActionResult & { contactId?: string }>
  updateContact: (id: string, patch: Partial<Pick<CrmContact, 'contactCode' | 'customerId' | 'name' | 'designation' | 'department' | 'email' | 'phone' | 'isPrimary' | 'isActive'>>) => StoreAction<StoreActionResult & { contactId?: string }>
  deleteContact: (id: string) => StoreAction<StoreActionResult>
  moveOpportunityStage: (input: MoveStageInput) => StoreAction<StoreActionResult>
  updateOpportunity: (id: string, patch: Partial<Pick<Opportunity, 'opportunityName' | 'value' | 'probability' | 'expectedCloseDate' | 'priority' | 'ownerId' | 'ownerName' | 'productRequirement' | 'productId' | 'contactId' | 'customerId' | 'lines' | 'salesOrderId' | 'stage' | 'status' | 'locationId'>>) => StoreAction<StoreActionResult>
  assignOpportunity: (id: string, ownerId: string, ownerName?: string, notes?: string) => StoreAction<StoreActionResult>
  reopenOpportunity: (id: string, reason?: string) => StoreAction<StoreActionResult>
  deleteOpportunity: (id: string) => StoreAction<StoreActionResult>

  createFollowUp: (input: CreateFollowUpInput) => StoreAction<StoreActionResult & { followUpId?: string }>
  updateFollowUp: (
    id: string,
    patch: Partial<Pick<FollowUp, 'followUpType' | 'dueDate' | 'dueTime' | 'priority' | 'notes' | 'reminder'>>,
  ) => StoreAction<StoreActionResult>
  completeFollowUp: (id: string, outcome: string) => StoreAction<StoreActionResult>
  snoozeFollowUp: (id: string, newDueDate: string) => StoreAction<StoreActionResult>
  rescheduleFollowUp: (id: string, dueDate: string, dueTime: string) => StoreAction<StoreActionResult>
  deleteFollowUp: (id: string) => StoreAction<StoreActionResult>

  createActivity: (input: CreateActivityInput) => StoreAction<StoreActionResult & { activityId?: string }>
  updateActivity: (
    id: string,
    patch: Partial<Pick<CrmActivity, 'type' | 'subject' | 'description' | 'outcome' | 'activityDate'>>,
  ) => StoreAction<StoreActionResult & { activityId?: string }>
  completeActivity: (id: string, outcome?: string) => StoreAction<StoreActionResult & { activityId?: string }>
  deleteActivity: (id: string) => StoreAction<StoreActionResult>

  createQuotationDocumentFromTemplate: (quotationId: string, templateId: string, opportunityId?: string | null) => StoreAction<StoreActionResult & { documentId?: string }>
  updateQuotationDocumentSections: (documentId: string, sections: QuotationSection[]) => StoreAction<StoreActionResult>
  updateQuotationDocumentPriceTable: (documentId: string, priceLines: QuotationPriceLine[], extras?: { freightAmount?: number; installationAmount?: number; customCharges?: number }) => StoreAction<StoreActionResult>
  createQuotationRevision: (documentId: string, reason: string) => StoreAction<StoreActionResult & { documentId?: string }>
  deleteQuotation: (quotationId: string) => StoreAction<StoreActionResult>
  markQuotationDocumentSent: (documentId: string) => StoreAction<StoreActionResult>
  submitQuotationDocumentForApproval: (documentId: string) => StoreAction<StoreActionResult>
  approveQuotationDocument: (documentId: string, remarks?: string) => StoreAction<StoreActionResult>
  rejectQuotationDocument: (documentId: string, remarks: string) => StoreAction<StoreActionResult>

  createQuotationFromOpportunity: (
    opportunityId: string,
    templateId: string,
    unitPrice: number,
    customLines?: import('../types/crm').OpportunityLine[],
    extras?: {
      paymentTerms?: string
      deliveryTerms?: string
      validityDate?: string
      locationId?: string | null
    },
  ) => StoreAction<StoreActionResult & { quotationId?: string; documentId?: string }>
  createQuotationDirect: (
    customerId: string,
    templateId: string,
    unitPrice: number,
    customLines?: import('../types/crm').OpportunityLine[],
    extras?: {
      locationId?: string | null
      scopeNotes?: string
      paymentTerms?: string
      deliveryTerms?: string
      validityDate?: string
    },
  ) => StoreAction<StoreActionResult & { quotationId?: string; documentId?: string }>
  convertQuotationDocumentToSalesOrder: (
    documentId: string,
    handover?: CrmSalesOrderHandoverInput,
  ) => StoreAction<{ ok: boolean; error?: string; salesOrderId?: string; salesOrderNo?: string; validationIssues?: string[] }>
  syncOpportunityValueFromDocument: (opportunityId: string, documentId: string) => { ok: boolean; error?: string }
}

function logActivity(_get: () => CrmState, set: (fn: (s: CrmState) => Partial<CrmState>) => void, input: CreateActivityInput) {
  const audit = stampCreated()
  const act: CrmActivity = {
    id: genId('act'),
    type: input.type,
    subject: input.subject,
    description: input.description,
    customerId: input.customerId ?? null,
    contactId: input.contactId ?? null,
    opportunityId: input.opportunityId ?? null,
    quotationId: input.quotationId ?? null,
    leadId: input.leadId ?? null,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    outcome: input.outcome ?? null,
    activityDate: input.activityDate ?? audit.createdAt,
    attachmentNames: [],
    ...audit,
  }
  set((s) => ({ activities: [act, ...s.activities] }))
  if (input.opportunityId) {
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === input.opportunityId
          ? mergeAudit(o, { lastActivityAt: act.activityDate, ...stampModified(o) })
          : o,
      ),
    }))
  }
  return act
}

export const useCrmStore = create<CrmState>()(
  persist(
    (set, get): CrmState => ({
      ...emptyCrmState(),
      quotationTemplates: isApiMode() ? [] : mergeBuiltinQuotationTemplates(DEFAULT_QUOTATION_TEMPLATES),

      loadSampleData: (customerIds) => {
        if (isApiMode()) return
        const bundle = buildCrmSampleData(customerIds)
        injectIsoTankShowcase(bundle)
        set({
          contacts: bundle.contacts,
          opportunities: bundle.opportunities,
          activities: bundle.activities,
          followUps: enrichFollowUpStatus(bundle.followUps),
          quotationDocuments: bundle.quotationDocuments,
          quotationTemplates: mergeBuiltinQuotationTemplates(bundle.quotationTemplates),
        })
        get().ensureIsoTankShowcase()
      },

      resetCrm: () => set({ ...emptyCrmState(), quotationTemplates: isApiMode() ? [] : emptyCrmState().quotationTemplates }),

      syncBuiltinQuotationTemplates: () => {
        if (isApiMode()) return
        set((s) => ({
          quotationTemplates: mergeBuiltinQuotationTemplates(s.quotationTemplates),
        }))
      },

      ensureIsoTankShowcase: () => {
        if (isApiMode()) return
        const state = get()
        const existing = state.quotationDocuments.find((d) => d.id === ISO_TANK_SHOWCASE_DOCUMENT_ID)
        const bundle = buildIsoTankShowcaseBundle()
        const contacts = state.contacts
        const primary = contacts.find((c) => c.customerId === bundle.opportunity.customerId && c.isPrimary)
        if (primary) {
          bundle.document.contactId = primary.id
          bundle.opportunity.contactId = primary.id
        }

        if (existing && existing.sections.length >= 15) {
          const sales = useSalesStore.getState()
          if (!sales.getQuotation(bundle.salesQuotation.id)) {
            useSalesStore.setState({
              quotations: [bundle.salesQuotation, ...sales.quotations],
            })
          }
          return
        }

        set((s) => ({
          opportunities: s.opportunities.some((o) => o.id === bundle.opportunity.id)
            ? s.opportunities.map((o) => (o.id === bundle.opportunity.id ? { ...bundle.opportunity, contactId: o.contactId ?? bundle.opportunity.contactId } : o))
            : [bundle.opportunity, ...s.opportunities],
          quotationDocuments: existing
            ? s.quotationDocuments.map((d) => (d.id === ISO_TANK_SHOWCASE_DOCUMENT_ID ? bundle.document : d))
            : [bundle.document, ...s.quotationDocuments],
        }))
        const sales = useSalesStore.getState()
        if (!sales.getQuotation(bundle.salesQuotation.id)) {
          useSalesStore.setState({
            quotations: [bundle.salesQuotation, ...sales.quotations],
          })
        }
      },

      getOpportunity: (id) => {
        const opp = get().opportunities.find((o) => o.id === id)
        if (!opp) return undefined
        return memoizedOnSource(opp, `crm:getOpportunity:${id}`, () => ({
          ...opp,
          lines: opp.lines ?? [],
        }))
      },
      getContact: (id) => get().contacts.find((c) => c.id === id),
      getContactsForCustomer: (customerId) => get().contacts.filter((c) => c.customerId === customerId),
      getActivitiesForOpportunity: (opportunityId) =>
        get().activities.filter((a) => a.opportunityId === opportunityId).sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
      getActivitiesForCustomer: (customerId) =>
        get().activities.filter((a) => a.customerId === customerId).sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
      getActivitiesForLead: (leadId) =>
        get().activities.filter((a) => a.leadId === leadId).sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
      getFollowUpsForOpportunity: (opportunityId) => get().followUps.filter((f) => f.opportunityId === opportunityId),
      getFollowUpsForLead: (leadId) =>
        get().followUps.filter((f) => f.leadId === leadId).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      getQuotationDocument: (id) => get().quotationDocuments.find((d) => d.id === id),
      getQuotationDocumentsForQuotation: (quotationId) =>
        get().quotationDocuments.filter((d) => d.quotationId === quotationId).sort((a, b) => b.revisionNo - a.revisionNo),
      getLatestQuotationDocument: (quotationId) => {
        const docs = get().quotationDocuments.filter((d) => d.quotationId === quotationId)
        if (!docs.length) return undefined
        return docs.reduce((a, b) => (b.revisionNo > a.revisionNo ? b : a))
      },
      getTemplate: (id) => (Array.isArray(get().quotationTemplates) ? get().quotationTemplates : []).find((t) => t.id === id),

      duplicateQuotationTemplate: (sourceId, templateName) => {
        if (isApiMode()) {
          return import('../services/bridges/quotationTemplateApiBridge').then((m) =>
            m.apiDuplicateQuotationTemplate(sourceId, templateName),
          )
        }
        const source = get().getTemplate(sourceId)
        if (!source) return { ok: false, error: 'Template not found' }
        const audit = stampCreated()
        const tpl: QuotationTemplate = {
          ...source,
          id: genId('qtpl'),
          templateName: templateName?.trim() || `${source.templateName} (Copy)`,
          version: (source.version ?? 1) + 1,
          isActive: true,
          ...audit,
        }
        set((s) => ({ quotationTemplates: [tpl, ...s.quotationTemplates] }))
        return { ok: true, templateId: tpl.id }
      },

      createQuotationTemplate: (input) => {
        if (isApiMode()) {
          return import('../services/bridges/quotationTemplateApiBridge').then((m) => m.apiCreateQuotationTemplate(input))
        }
        const name = input.templateName?.trim()
        if (!name) return { ok: false, error: 'Template name is required' }
        const source = input.sourceTemplateId ? get().getTemplate(input.sourceTemplateId) : undefined
        const audit = stampCreated()
        const sections = input.sections ?? source?.sections ?? []
        const tpl: QuotationTemplate = {
          id: genId('qtpl'),
          templateName: name,
          productFamily: input.productFamily || source?.productFamily || 'Custom',
          version: 1,
          sections,
          defaultTerms: input.defaultTerms ?? source?.defaultTerms ?? '',
          defaultWarranty: input.defaultWarranty ?? source?.defaultWarranty ?? '',
          defaultExclusions: input.defaultExclusions ?? source?.defaultExclusions ?? '',
          isActive: true,
          printLayout: input.printLayout ?? source?.printLayout,
          ...audit,
        }
        set((s) => ({ quotationTemplates: [tpl, ...s.quotationTemplates] }))
        return { ok: true, templateId: tpl.id }
      },

      updateQuotationTemplate: (id, patch) => {
        if (isApiMode()) {
          return import('../services/bridges/quotationTemplateApiBridge').then((m) => m.apiUpdateQuotationTemplate(id, patch))
        }
        const tpl = get().getTemplate(id)
        if (!tpl) return { ok: false, error: 'Template not found' }
        set((s) => ({
          quotationTemplates: s.quotationTemplates.map((t) =>
            t.id === id ? mergeAudit(t, { ...patch, ...stampModified(t) }) : t,
          ),
        }))
        return { ok: true }
      },

      createOpportunity: (input) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateOpportunity(input))
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm
        if (input.leadId) {
          const lead = useSalesStore.getState().getLead(input.leadId)
          const gate = resolveLeadConvertToOpportunityGate(lead)
          if (!gate.ok) return { ok: false, error: gate.reason }
        }
        const audit = stampCreated()
        const syncedLines = syncOpportunityLines(input.lines ?? [])
        const summary = calcOpportunityLinesSummary(syncedLines)
        const primaryProductId = syncedLines[0]?.productId ?? input.productId ?? null
        const computedValue = summary.grandTotal > 0 ? summary.grandTotal : input.value
        const opp: Opportunity = {
          id: genId('opp'),
          opportunityNo: nextDocumentNo('OPP', get().opportunities.map((o) => o.opportunityNo)),
          ...input,
          leadId: input.leadId ?? null,
          inquiryId: null,
          lines: syncedLines,
          productId: primaryProductId,
          value: computedValue,
          healthScore: 60,
          lastActivityAt: audit.createdAt,
          ...audit,
        }
        set((s) => ({ opportunities: [opp, ...s.opportunities] }))
        if (input.leadId) {
          const link = useSalesStore.getState().linkLeadToOpportunity(input.leadId, opp.id)
          if (link instanceof Promise) return { ok: false, error: 'Lead link failed' }
          if (!link.ok) return link
        }
        const lineNote = syncedLines.length
          ? `Opportunity created with ${syncedLines.length} item line${syncedLines.length === 1 ? '' : 's'} worth ₹${computedValue.toLocaleString('en-IN')}.`
          : `Opportunity ${opp.opportunityName} created.`
        logActivity(get, set, {
          type: 'note',
          subject: input.leadId ? 'Opportunity created from lead' : 'Opportunity created',
          description: lineNote,
          customerId: opp.customerId,
          contactId: opp.contactId,
          opportunityId: opp.id,
          leadId: input.leadId ?? null,
          ownerId: opp.ownerId,
          ownerName: opp.ownerName,
        })
        return { ok: true, opportunityId: opp.id }
      },

      createContact: (input) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateContact(input))
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm
        if (!input.contactCode?.trim()) return { ok: false, error: 'Contact code is required' }
        if (!input.customerId?.trim()) return { ok: false, error: 'Customer is required' }
        if (!input.name?.trim()) return { ok: false, error: 'Contact name is required' }
        const audit = stampCreated()
        const contact: CrmContact = {
          id: genId('crm-contact'),
          department: input.department ?? '',
          isActive: input.isActive ?? true,
          ...input,
          ...audit,
        }
        set((s) => {
          let contacts = [contact, ...s.contacts]
          if (contact.isPrimary) {
            contacts = applyPrimaryContactFlags(contacts, contact.customerId, contact.id, true)
          }
          return { contacts }
        })
        const saved = get().getContact(contact.id)!
        const masterContactId = syncCrmContactToMaster(saved)
        set((s) => ({
          contacts: s.contacts.map((c) => (
            c.id === contact.id ? { ...c, masterContactId } : c
          )),
        }))
        syncPrimaryToCustomer(get().getContact(contact.id)!)
        logActivity(get, set, {
          type: 'note',
          subject: 'Contact added',
          description: `${contact.name} added to CRM contacts.`,
          customerId: contact.customerId,
          contactId: contact.id,
          ownerId: audit.createdById,
          ownerName: audit.createdByName,
        })
        return { ok: true, contactId: contact.id }
      },

      updateContact: (id, patch) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateContact(id, patch))
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm
        const existing = get().getContact(id)
        if (!existing) return { ok: false, error: 'Contact not found' }
        if (patch.customerId !== undefined && !patch.customerId.trim()) {
          return { ok: false, error: 'Customer is required' }
        }
        if (patch.name !== undefined && !patch.name.trim()) {
          return { ok: false, error: 'Contact name is required' }
        }
        const next: CrmContact = mergeAudit(existing, { ...patch, ...stampModified(existing) })
        set((s) => {
          let contacts = s.contacts.map((c) => (c.id === id ? next : c))
          if (next.isPrimary) {
            contacts = applyPrimaryContactFlags(contacts, next.customerId, id, true)
          }
          return { contacts }
        })
        const saved = get().getContact(id)!
        const masterContactId = syncCrmContactToMaster(saved)
        if (!saved.masterContactId) {
          set((s) => ({
            contacts: s.contacts.map((c) => (
              c.id === id ? { ...c, masterContactId } : c
            )),
          }))
        }
        syncPrimaryToCustomer(get().getContact(id)!)
        logActivity(get, set, {
          type: 'note',
          subject: 'Contact updated',
          description: `${saved.name} profile updated.`,
          customerId: saved.customerId,
          contactId: saved.id,
          ownerId: saved.modifiedById ?? saved.createdById,
          ownerName: saved.modifiedByName ?? saved.createdByName,
        })
        return { ok: true, contactId: id }
      },

      deleteContact: (id) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteContact(id))
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }))
        return { ok: true }
      },

      moveOpportunityStage: ({ opportunityId, stage, lostReason, manualWonApproval }) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiMoveOpportunityStage(opportunityId, stage, lostReason))
        const opp = get().getOpportunity(opportunityId)
        if (!opp) return { ok: false, error: 'Opportunity not found' }
        if (stage === 'lost' && !lostReason?.trim()) {
          return { ok: false, error: 'Lost reason is required' }
        }
        const gateOpp = {
          ...opp,
          ...(stage === 'lost' && lostReason !== undefined ? { lostReason } : {}),
        }
        const missing = getMissingOpportunityStageFields(gateOpp, stage)
        if (missing.length > 0) {
          return {
            ok: false,
            error: formatMissingStageFieldsMessage(missing, opportunityStageLabel(stage)),
            code: 'STAGE_REQUIREMENTS_INCOMPLETE',
            missingFields: missing,
          }
        }
        if (stage === 'won') {
          const hasApproved =
            manualWonApproval ||
            (opp.quotationId &&
              get().quotationDocuments.some(
                (d) => d.quotationId === opp.quotationId && d.status === 'approved',
              )) ||
            (opp.quotationId && useSalesStore.getState().getQuotation(opp.quotationId)?.status === 'approved')
          if (!hasApproved) {
            return { ok: false, error: 'Won stage requires approved quotation or manual approval' }
          }
        }
        const prev = opp.stage
        const status = stage === 'won' ? 'won' : stage === 'lost' ? 'lost' : stage === 'on_hold' ? 'on_hold' : 'open'
        const masterProb = getStageProbability(stage)
        const nextProbability =
          stage === 'won' ? 100
          : stage === 'lost' ? 0
          : masterProb != null ? masterProb
          : opp.probability
        set((s) => ({
          opportunities: s.opportunities.map((o) =>
            o.id === opportunityId
              ? mergeAudit(o, {
                  stage,
                  status,
                  lostReason: stage === 'lost' ? lostReason ?? null : o.lostReason,
                  probability: nextProbability,
                  ...stampModified(o),
                })
              : o,
          ),
        }))
        logActivity(get, set, {
          type: 'stage_change',
          subject: `Stage: ${opportunityStageLabel(prev)} → ${opportunityStageLabel(stage)}`,
          description: lostReason ? `Lost reason: ${lostReason}` : `Pipeline stage updated.`,
          customerId: opp.customerId,
          contactId: opp.contactId,
          opportunityId: opp.id,
          ownerId: opp.ownerId,
          ownerName: opp.ownerName,
        })
        if (stage === 'won') {
          logActivity(get, set, {
            type: 'deal_won',
            subject: 'Deal won',
            description: `${opp.opportunityName} marked as won.`,
            customerId: opp.customerId,
            opportunityId: opp.id,
            ownerId: opp.ownerId,
            ownerName: opp.ownerName,
          })
        }
        if (stage === 'lost') {
          logActivity(get, set, {
            type: 'deal_lost',
            subject: 'Deal lost',
            description: lostReason ?? 'Deal marked lost.',
            customerId: opp.customerId,
            opportunityId: opp.id,
            ownerId: opp.ownerId,
            ownerName: opp.ownerName,
            outcome: lostReason ?? null,
          })
        }
        return { ok: true }
      },

      updateOpportunity: (id, patch) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateOpportunity(id, patch))
        const opp = get().getOpportunity(id)
        if (!opp) return { ok: false, error: 'Opportunity not found' }
        let nextPatch = { ...patch }
        if (patch.lines) {
          const syncedLines = syncOpportunityLines(patch.lines)
          nextPatch = {
            ...nextPatch,
            lines: syncedLines,
            productId: syncedLines[0]?.productId ?? patch.productId ?? opp.productId,
            value: calcOpportunityLinesSummary(syncedLines).grandTotal,
          }
        }
        set((s) => ({
          opportunities: s.opportunities.map((o) => (o.id === id ? mergeAudit(o, { ...nextPatch, ...stampModified(o) }) : o)),
        }))
        return { ok: true }
      },

      assignOpportunity: (id, ownerId, ownerName, notes) => {
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) => m.apiAssignOpportunity(id, ownerId, notes))
        }
        const opp = get().getOpportunity(id)
        if (!opp) return { ok: false, error: 'Opportunity not found' }
        return get().updateOpportunity(id, {
          ownerId,
          ownerName: ownerName ?? opp.ownerName,
        })
      },

      reopenOpportunity: (id, reason) => {
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) => m.apiReopenOpportunity(id, reason))
        }
        const opp = get().getOpportunity(id)
        if (!opp) return { ok: false, error: 'Opportunity not found' }
        if (opp.stage !== 'won' && opp.stage !== 'lost') {
          return { ok: false, error: 'Only won or lost opportunities can be reopened' }
        }
        return get().moveOpportunityStage({ opportunityId: id, stage: 'qualified', lostReason: reason })
      },

      deleteOpportunity: (id) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteOpportunity(id))
        set((s) => ({ opportunities: s.opportunities.filter((o) => o.id !== id) }))
        return { ok: true }
      },

      createFollowUp: (input) => {
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiCreateFollowUp({
              followUpType: input.followUpType,
              customerId: input.customerId,
              contactId: input.contactId,
              opportunityId: input.opportunityId,
              leadId: input.leadId,
              assignedTo: input.assignedTo,
              dueDate: input.dueDate,
              dueTime: input.dueTime,
              priority: input.priority,
              notes: input.notes,
              reminder: input.reminder,
            }),
          )
        }
        const dueError = validateFollowUpAt({ dueDate: input.dueDate, dueTime: input.dueTime })
        if (dueError) return { ok: false, error: dueError }
        const audit = stampCreated()
        const fu: FollowUp = {
          id: genId('fu'),
          followUpType: input.followUpType,
          customerId: input.customerId ?? null,
          contactId: input.contactId ?? null,
          opportunityId: input.opportunityId ?? null,
          quotationId: input.quotationId ?? null,
          leadId: input.leadId ?? null,
          assignedTo: input.assignedTo,
          assignedToName: input.assignedToName,
          dueDate: input.dueDate,
          dueTime: input.dueTime ?? '10:00',
          priority: input.priority ?? 'medium',
          status: 'pending',
          outcome: null,
          notes: input.notes ?? '',
          reminder: input.reminder ?? true,
          ...audit,
        }
        set((s) => ({ followUps: [fu, ...s.followUps] }))
        if (input.leadId) {
          logActivity(get, set, {
            type: 'note',
            subject: `Follow-up scheduled: ${input.followUpType.replace(/_/g, ' ')}`,
            description: input.notes ?? `Due ${input.dueDate} at ${input.dueTime ?? '10:00'}`,
            customerId: input.customerId,
            contactId: input.contactId,
            leadId: input.leadId,
            ownerId: input.assignedTo,
            ownerName: input.assignedToName,
          })
        }
        if (input.opportunityId) {
          set((s) => ({
            opportunities: s.opportunities.map((o) =>
              o.id === input.opportunityId
                ? mergeAudit(o, { nextFollowUpDate: input.dueDate, ...stampModified(o) })
                : o,
            ),
          }))
        }
        return { ok: true, followUpId: fu.id }
      },

      updateFollowUp: (id, patch) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateFollowUp(id, patch))
        const fu = get().followUps.find((f) => f.id === id)
        if (!fu) return { ok: false, error: 'Follow-up not found' }
        if (patch.dueDate !== undefined || patch.dueTime !== undefined) {
          const dueError = validateFollowUpAt({
            dueDate: patch.dueDate ?? fu.dueDate,
            dueTime: patch.dueTime ?? fu.dueTime,
          })
          if (dueError) return { ok: false, error: dueError }
        }
        set((s) => ({
          followUps: s.followUps.map((f) =>
            f.id === id ? mergeAudit(f, { ...patch, ...stampModified(f) }) : f,
          ),
        }))
        return { ok: true }
      },

      completeFollowUp: (id, outcome) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCompleteFollowUp(id, outcome))
        const fu = get().followUps.find((f) => f.id === id)
        if (!fu) return { ok: false, error: 'Follow-up not found' }
        set((s) => ({
          followUps: s.followUps.map((f) =>
            f.id === id ? mergeAudit(f, { status: 'completed', outcome, ...stampModified(f) }) : f,
          ),
        }))
        logActivity(get, set, {
          type: 'follow_up_completed',
          subject: `Follow-up completed: ${fu.followUpType}`,
          description: fu.notes,
          customerId: fu.customerId,
          contactId: fu.contactId,
          opportunityId: fu.opportunityId,
          quotationId: fu.quotationId,
          leadId: fu.leadId,
          ownerId: fu.assignedTo,
          ownerName: fu.assignedToName,
          outcome,
        })
        return { ok: true }
      },

      snoozeFollowUp: (id, newDueDate) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiSnoozeFollowUp(id, newDueDate))
        const fu = get().followUps.find((f) => f.id === id)
        if (!fu) return { ok: false, error: 'Follow-up not found' }
        const dueError = validateFollowUpAt({ dueDate: newDueDate, dueTime: fu.dueTime ?? '23:59' })
        if (dueError) return { ok: false, error: dueError }
        set((s) => ({
          followUps: s.followUps.map((f) =>
            f.id === id ? mergeAudit(f, { status: 'snoozed', dueDate: newDueDate, ...stampModified(f) }) : f,
          ),
        }))
        return { ok: true }
      },

      rescheduleFollowUp: (id, dueDate, dueTime) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiRescheduleFollowUp(id, dueDate, dueTime))
        const fu = get().followUps.find((f) => f.id === id)
        if (!fu) return { ok: false, error: 'Follow-up not found' }
        const dueError = validateFollowUpAt({ dueDate, dueTime })
        if (dueError) return { ok: false, error: dueError }
        set((s) => ({
          followUps: s.followUps.map((f) =>
            f.id === id ? mergeAudit(f, { status: 'pending', dueDate, dueTime, ...stampModified(f) }) : f,
          ),
        }))
        return { ok: true }
      },

      deleteFollowUp: (id) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteFollowUp(id))
        set((s) => ({ followUps: s.followUps.filter((f) => f.id !== id) }))
        return { ok: true }
      },

      createActivity: (input) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateActivity(input))
        const act = logActivity(get, set, input)
        return { ok: true, activityId: act.id }
      },

      updateActivity: (id, patch) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateActivity(id, patch))
        const act = get().activities.find((a) => a.id === id)
        if (!act) return { ok: false, error: 'Activity not found' }
        set((s) => ({
          activities: s.activities.map((a) =>
            a.id === id ? mergeAudit(a, { ...patch, ...stampModified(a) }) : a,
          ),
        }))
        return { ok: true, activityId: id }
      },

      completeActivity: (id, outcome) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCompleteActivity(id, outcome))
        const act = get().activities.find((a) => a.id === id)
        if (!act) return { ok: false, error: 'Activity not found' }
        set((s) => ({
          activities: s.activities.map((a) =>
            a.id === id ? mergeAudit(a, { outcome: outcome ?? a.outcome, ...stampModified(a) }) : a,
          ),
        }))
        return { ok: true, activityId: id }
      },

      deleteActivity: (id) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteActivity(id))
        set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
        return { ok: true }
      },

      createQuotationDocumentFromTemplate: (quotationId, templateId, opportunityId) => {
        if (isApiMode()) {
          return { ok: false, error: 'Create quotation via opportunity flow in API mode' }
        }
        const tpl = get().getTemplate(templateId)
        if (!tpl) return { ok: false, error: 'Template not found' }
        const audit = stampCreated()
        const sections = applyCommercialMastersToSections(cloneTemplateSections(tpl.sections, genId), {
          replaceTemplateContent: true,
        })
        const priceLines =
          templateId === ISO_TANK_TEMPLATE_ID || tpl.code === 'ISO-TANK-26KL' || tpl.productFamily === 'ISO Tank'
            ? isoTankSamplePriceLines()
            : []
        const total = priceLines.length
          ? priceLines.reduce((s, l) => s + l.lineTotal, 0)
          : 0
        const doc: QuotationDocument = {
          id: genId('qdoc'),
          quotationId,
          revisionNo: 0,
          templateId,
          opportunityId: opportunityId ?? null,
          sections,
          priceLines,
          freightAmount: 0,
          installationAmount: 0,
          customCharges: 0,
          status: 'draft',
          totalAmount: total,
          revisionReason: null,
          locked: false,
          ...defaultDocumentFields(),
          ...audit,
        }
        set((s) => ({ quotationDocuments: [doc, ...s.quotationDocuments] }))
        logActivity(get, set, {
          type: 'quotation_created',
          subject: 'Quotation document created',
          description: `From template ${tpl.templateName}`,
          opportunityId: opportunityId ?? undefined,
          quotationId,
          ownerId: audit.createdById,
          ownerName: audit.createdByName,
        })
        return { ok: true, documentId: doc.id }
      },

      updateQuotationDocumentSections: (documentId, sections) => {
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiUpdateQuotationDocument(doc.quotationId, documentId, { sections }),
          )
        }
        if (doc.locked) return { ok: false, error: 'Approved or sent quotation is locked' }
        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === documentId ? mergeAudit(d, { sections, ...stampModified(d) }) : d,
          ),
        }))
        return { ok: true }
      },

      updateQuotationDocumentPriceTable: (documentId, priceLines, extras) => {
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          const lines = syncLineTotals(priceLines)
          const freight = extras?.freightAmount ?? doc.freightAmount
          const installation = extras?.installationAmount ?? doc.installationAmount
          const custom = extras?.customCharges ?? doc.customCharges
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiUpdateQuotationDocument(doc.quotationId, documentId, {
              priceLines: lines,
              freightAmount: freight,
              installationAmount: installation,
              customCharges: custom,
            }),
          )
        }
        if (doc.locked) return { ok: false, error: 'Approved or sent quotation is locked' }
        const lines = syncLineTotals(priceLines)
        const freight = extras?.freightAmount ?? doc.freightAmount
        const installation = extras?.installationAmount ?? doc.installationAmount
        const custom = extras?.customCharges ?? doc.customCharges
        const total = calcPriceSummary(lines, freight, installation, custom).grandTotal
        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === documentId
              ? mergeAudit(d, {
                  priceLines: lines,
                  freightAmount: freight,
                  installationAmount: installation,
                  customCharges: custom,
                  totalAmount: total,
                  ...stampModified(d),
                })
              : d,
          ),
        }))
        if (doc.opportunityId) {
          get().syncOpportunityValueFromDocument(doc.opportunityId, documentId)
        }
        return { ok: true }
      },

      createQuotationRevision: (documentId, reason) => {
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateQuotationRevision(doc.quotationId, reason))
        }
        const audit = stampCreated()
        const nextRev = doc.revisionNo + 1
        const line = primaryPriceLine(doc)
        const sales = useSalesStore.getState()
        if (line) {
          sales.updateQuotationDraft(doc.quotationId, {
            unitPrice: line.unitPrice,
            discountPct: line.discountPct,
          })
        }

        const newDocId = genId('qdoc')
        set((s) => ({
          quotationDocuments: [
            ...s.quotationDocuments.map((d) =>
              d.quotationId === doc.quotationId && d.revisionNo === doc.revisionNo
                ? mergeAudit(d, { locked: true, ...stampModified(d) })
                : d,
            ),
            {
              ...doc,
              id: newDocId,
              revisionNo: nextRev,
              revisionReason: reason,
              status: 'draft' as QuotationDocumentStatus,
              locked: false,
              approvalHistory: [],
              ...audit,
            },
          ],
        }))
        logActivity(get, set, {
          type: 'quotation_revised',
          subject: `Revision ${nextRev}`,
          description: reason,
          quotationId: doc.quotationId,
          opportunityId: doc.opportunityId ?? undefined,
          ownerId: audit.createdById,
          ownerName: audit.createdByName,
        })
        return { ok: true, documentId: newDocId }
      },

      deleteQuotation: (quotationId) => {
        const header = useSalesStore.getState().getQuotation(quotationId)
        const docs = get().quotationDocuments.filter((d) => d.quotationId === quotationId)
        if (!header && docs.length === 0) return { ok: false, error: 'Quotation not found' }
        const status = header?.status ?? docs.sort((a, b) => b.revisionNo - a.revisionNo)[0]?.status
        if (status !== 'draft') {
          return { ok: false, error: `Only draft quotations can be deleted — current status is ${status}` }
        }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteQuotation(quotationId))
        }
        useSalesStore.setState((s) => ({
          quotations: s.quotations.filter((q) => q.id !== quotationId),
        }))
        set((s) => ({
          quotationDocuments: s.quotationDocuments.filter((d) => d.quotationId !== quotationId),
        }))
        return { ok: true }
      },

      markQuotationDocumentSent: (documentId) => {
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiMarkQuotationDocumentSent(doc.quotationId, documentId),
          )
        }
        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === documentId
              ? mergeAudit(d, { status: 'sent', locked: true, ...stampModified(d) })
              : d,
          ),
        }))
        logActivity(get, set, {
          type: 'quotation_sent',
          subject: 'Quotation sent to customer',
          description: `Rev ${doc.revisionNo}`,
          quotationId: doc.quotationId,
          opportunityId: doc.opportunityId ?? undefined,
          ownerId: doc.createdById,
          ownerName: doc.createdByName,
        })
        return { ok: true }
      },

      submitQuotationDocumentForApproval: (documentId) => {
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiSubmitQuotationDocumentForApproval(doc.quotationId, documentId),
          )
        }
        if (doc.locked && doc.status !== 'draft') return { ok: false, error: 'Document is locked' }
        const maxDiscount = doc.priceLines.reduce((m, l) => Math.max(m, l.discountPct), 0)
        const audit = stampCreated()
        const history = appendApproval(doc, 'submitted', 'Submitted for approval')
        if (doc.totalAmount > APPROVAL_AMOUNT_THRESHOLD || maxDiscount > DISCOUNT_APPROVAL_THRESHOLD) {
          set((s) => ({
            quotationDocuments: s.quotationDocuments.map((d) =>
              d.id === documentId
                ? mergeAudit(d, { status: 'pending_approval', approvalHistory: history, ...stampModified(d) })
                : d,
            ),
          }))
        } else {
          useSalesStore.getState().submitQuotationForApproval(doc.quotationId)
          return get().approveQuotationDocument(documentId, 'Auto-approved within limit')
        }
        useSalesStore.getState().submitQuotationForApproval(doc.quotationId)
        logActivity(get, set, {
          type: 'note',
          subject: 'Quotation submitted for approval',
          description: `Submitted by ${audit.createdByName}`,
          quotationId: doc.quotationId,
          opportunityId: doc.opportunityId ?? undefined,
          ownerId: audit.createdById,
          ownerName: audit.createdByName,
        })
        return { ok: true }
      },

      approveQuotationDocument: (documentId, remarks) => {
        const perm = assertPermission('sales', 'approve')
        if (!perm.ok) return perm
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiApproveQuotationDocument(doc.quotationId, documentId, remarks),
          )
        }
        const history = appendApproval(doc, 'approved', remarks ?? 'Approved')
        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === documentId
              ? mergeAudit(d, { status: 'approved', locked: true, approvalHistory: history, ...stampModified(d) })
              : d,
          ),
        }))
        const salesState = useSalesStore.getState()
        const salesQuo = salesState.getQuotation(doc.quotationId)
        if (salesQuo && (salesQuo.status === 'draft' || salesQuo.status === 'rejected')) {
          salesState.submitQuotationForApproval(doc.quotationId)
        }
        salesState.recordCustomerApproval(doc.quotationId, 'approved')
        logActivity(get, set, {
          type: 'quotation_approved',
          subject: 'Quotation approved',
          description: remarks ?? 'Approved',
          quotationId: doc.quotationId,
          opportunityId: doc.opportunityId ?? undefined,
          ownerId: doc.createdById,
          ownerName: doc.createdByName,
        })
        return { ok: true }
      },

      rejectQuotationDocument: (documentId, remarks) => {
        const perm = assertPermission('sales', 'approve')
        if (!perm.ok) return perm
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiRejectQuotationDocument(doc.quotationId, documentId, remarks),
          )
        }
        const history = appendApproval(doc, 'rejected', remarks)
        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === documentId
              ? mergeAudit(d, { status: 'rejected', locked: false, approvalHistory: history, ...stampModified(d) })
              : d,
          ),
        }))
        useSalesStore.getState().recordCustomerApproval(doc.quotationId, 'rejected', remarks)
        logActivity(get, set, {
          type: 'quotation_rejected',
          subject: 'Quotation rejected',
          description: remarks,
          quotationId: doc.quotationId,
          opportunityId: doc.opportunityId ?? undefined,
          ownerId: doc.createdById,
          ownerName: doc.createdByName,
        })
        return { ok: true }
      },

      createQuotationFromOpportunity: (opportunityId, templateId, unitPrice, customLines, extras) => {
        const opp = get().getOpportunity(opportunityId)
        if (!opp) return { ok: false, error: 'Opportunity not found' }
        const master = useMasterStore.getState()
        const product = opp.productId ? master.getProduct(opp.productId) : undefined
        const resolvedLines = customLines?.length
          ? syncOpportunityLines(customLines)
          : resolveOpportunityLines(opp, product)
        const effectiveUnitPrice = unitPrice > 0 ? unitPrice : (resolvedLines[0]?.unitPrice ?? 0)
        const primaryProductId = resolvedLines[0]?.productId ?? opp.productId
        if (!primaryProductId && resolvedLines.length === 0) {
          return { ok: false, error: 'Opportunity needs at least one product line' }
        }
        if (!effectiveUnitPrice || effectiveUnitPrice <= 0) {
          return { ok: false, error: 'Unit price must be greater than zero' }
        }

        const customer = master.getCustomer(opp.customerId)
        const contact = opp.contactId ? get().getContact(opp.contactId) : null
        const tpl = get().getTemplate(templateId)
        const paymentDefault = resolveDefaultCommercialTerm('payment-terms')
        const deliveryDefault = resolveDefaultCommercialTerm('delivery-terms')
        const paymentTerms = extras?.paymentTerms?.trim() || paymentDefault.text
        const deliveryTerms = extras?.deliveryTerms?.trim() || deliveryDefault.text
        const validityDate = extras?.validityDate?.trim() || undefined
        const commercialNotes = opp.productRequirement
        const qty = resolvedLines[0]?.qty ?? 1

        if (isApiMode()) {
          const tplSections = applyCommercialMastersToSections(cloneTemplateSections(tpl?.sections ?? [], genId), {
            replaceTemplateContent: true,
          })
          const sections = populateDocumentFromOpportunity(tplSections, {
            customerName: customer?.customerName ?? opp.customerId,
            contactName: contact?.name ?? customer?.contactPerson ?? '—',
            productRequirement: opp.productRequirement,
            technicalNotes: opp.productRequirement,
            commercialNotes,
            deliveryDate: opp.expectedCloseDate,
            ownerName: opp.ownerName,
          })
          const priceLines = resolvedLines.length > 0
            ? syncLineTotals(opportunityLinesToQuotationPriceLines(resolvedLines))
            : syncLineTotals([
              {
                id: genId('pl'),
                productOrItem: opp.productRequirement,
                description: tpl?.productFamily ?? 'Supply',
                qty,
                uom: 'Nos',
                unitPrice: effectiveUnitPrice,
                discountPct: 0,
                taxPct: 18,
                lineTotal: 0,
                isOptional: false,
              },
            ])
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiCreateQuotationFromOpportunity({
              opportunityId: opp.id,
              opportunityNo: opp.opportunityNo,
              customerId: opp.customerId,
              productId: primaryProductId!,
              qty,
              unitPrice: effectiveUnitPrice,
              terms: commercialNotes,
              paymentTerms,
              deliveryTerms,
              validityDate,
              locationId: extras?.locationId !== undefined ? extras.locationId : (opp.locationId ?? null),
              contactId: opp.contactId,
              salesOwnerId: opp.ownerId,
              salesOwnerName: opp.ownerName,
              templateId,
              sections,
              priceLines,
              commercialNotes,
              technicalNotes: opp.productRequirement,
            }),
          )
        }

        const sales = useSalesStore.getState()
        const quo = sales.createQuotationFromOpportunity({
          opportunityId: opp.id,
          opportunityNo: opp.opportunityNo,
          customerId: opp.customerId,
          productId: primaryProductId!,
          qty,
          unitPrice: effectiveUnitPrice,
          discountPct: 0,
          terms: commercialNotes,
          paymentTerms,
          deliveryTerms,
          validityDate,
          locationId: extras?.locationId !== undefined ? extras.locationId : (opp.locationId ?? null),
        }) as StoreActionResult & { quotationId?: string }
        if (!quo.ok || !quo.quotationId) return quo

        const docResult = get().createQuotationDocumentFromTemplate(quo.quotationId!, templateId, opportunityId) as StoreActionResult & { documentId?: string }
        if (!docResult.ok || !docResult.documentId) return docResult

        const createdDoc = get().getQuotationDocument(docResult.documentId)!
        const sections = populateDocumentFromOpportunity(createdDoc.sections, {
          customerName: customer?.customerName ?? opp.customerId,
          contactName: contact?.name ?? customer?.contactPerson ?? '—',
          productRequirement: opp.productRequirement,
          technicalNotes: opp.productRequirement,
          commercialNotes,
          deliveryDate: opp.expectedCloseDate,
          ownerName: opp.ownerName,
        })
        get().updateQuotationDocumentSections(docResult.documentId, sections)

        const lines = resolvedLines.length > 0
          ? syncLineTotals(opportunityLinesToQuotationPriceLines(resolvedLines))
          : syncLineTotals([
            {
              id: genId('pl'),
              productOrItem: opp.productRequirement,
              description: tpl?.productFamily ?? 'Supply',
              qty,
              uom: 'Nos',
              unitPrice: effectiveUnitPrice,
              discountPct: 0,
              taxPct: 18,
              lineTotal: 0,
              isOptional: false,
            },
          ])
        get().updateQuotationDocumentPriceTable(docResult.documentId, lines)
        const total = documentGrandTotal(get().getQuotationDocument(docResult.documentId)!)

        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === docResult.documentId
              ? mergeAudit(d, {
                  contactId: opp.contactId,
                  salesOwnerId: opp.ownerId,
                  salesOwnerName: opp.ownerName,
                  commercialNotes,
                  technicalNotes: opp.productRequirement,
                  ...stampModified(d),
                })
              : d,
          ),
          opportunities: s.opportunities.map((o) =>
            o.id === opportunityId
              ? mergeAudit(o, {
                  quotationId: quo.quotationId,
                  stage: 'quotation_prepared',
                  value: total,
                  ...stampModified(o),
                })
              : o,
          ),
        }))

        logActivity(get, set, {
          type: 'quotation_created',
          subject: 'Quotation created from opportunity',
          description: `${quo.quotationId} for ${opp.opportunityName}`,
          customerId: opp.customerId,
          contactId: opp.contactId,
          opportunityId: opp.id,
          quotationId: quo.quotationId,
          ownerId: opp.ownerId,
          ownerName: opp.ownerName,
        })

        return { ok: true, quotationId: quo.quotationId, documentId: docResult.documentId }
      },

      createQuotationDirect: (customerId, templateId, unitPrice, customLines, extras) => {
        const master = useMasterStore.getState()
        const customer = master.getCustomer(customerId)
        if (!customer) return { ok: false, error: 'Customer not found' }

        const resolvedLines = customLines?.length ? syncOpportunityLines(customLines) : []
        const effectiveUnitPrice = unitPrice > 0 ? unitPrice : (resolvedLines[0]?.unitPrice ?? 0)
        const primaryProductId = resolvedLines[0]?.productId ?? null
        if (resolvedLines.length === 0) {
          return { ok: false, error: 'Add at least one product line' }
        }
        if (!effectiveUnitPrice || effectiveUnitPrice <= 0) {
          return { ok: false, error: 'Unit price must be greater than zero' }
        }

        const tpl = get().getTemplate(templateId)
        const paymentDefault = resolveDefaultCommercialTerm('payment-terms')
        const deliveryDefault = resolveDefaultCommercialTerm('delivery-terms')
        const paymentTerms = extras?.paymentTerms?.trim() || paymentDefault.text
        const deliveryTerms = extras?.deliveryTerms?.trim() || deliveryDefault.text
        const validityDate = extras?.validityDate?.trim() || undefined
        const commercialNotes = extras?.scopeNotes?.trim() || undefined
        const qty = resolvedLines[0]?.qty ?? 1
        const productRequirement = resolvedLines
          .map((l) => l.productOrItem?.trim())
          .filter(Boolean)
          .join(', ')
        const owner = stampCreated()
        const locationId = extras?.locationId ?? null

        if (isApiMode()) {
          const tplSections = applyCommercialMastersToSections(cloneTemplateSections(tpl?.sections ?? [], genId), {
            replaceTemplateContent: true,
          })
          const sections = populateDocumentFromOpportunity(tplSections, {
            customerName: customer.customerName,
            contactName: customer.contactPerson ?? '—',
            productRequirement,
            technicalNotes: productRequirement,
            commercialNotes: commercialNotes ?? '',
            deliveryDate: '',
            ownerName: owner.createdByName,
          })
          const priceLines = syncLineTotals(opportunityLinesToQuotationPriceLines(resolvedLines))
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiCreateQuotation({
              customerId,
              opportunityId: null,
              productId: primaryProductId,
              qty,
              unitPrice: effectiveUnitPrice,
              terms: commercialNotes,
              paymentTerms,
              deliveryTerms,
              validityDate,
              locationId,
              templateId,
              sections,
              priceLines,
              commercialNotes: commercialNotes ?? null,
              technicalNotes: productRequirement || null,
              summary: `Initial quotation created for ${customer.customerName} (direct)`,
            }),
          )
        }

        const sales = useSalesStore.getState()
        const quo = sales.createQuotationDirect({
          customerId,
          productId: primaryProductId ?? undefined,
          qty,
          unitPrice: effectiveUnitPrice,
          discountPct: 0,
          terms: commercialNotes,
          paymentTerms,
          deliveryTerms,
          validityDate,
          locationId,
        }) as StoreActionResult & { quotationId?: string }
        if (!quo.ok || !quo.quotationId) return quo

        const docResult = get().createQuotationDocumentFromTemplate(quo.quotationId, templateId, null) as StoreActionResult & { documentId?: string }
        if (!docResult.ok || !docResult.documentId) return docResult

        const createdDoc = get().getQuotationDocument(docResult.documentId)!
        const sections = populateDocumentFromOpportunity(createdDoc.sections, {
          customerName: customer.customerName,
          contactName: customer.contactPerson ?? '—',
          productRequirement,
          technicalNotes: productRequirement,
          commercialNotes: commercialNotes ?? '',
          deliveryDate: '',
          ownerName: owner.createdByName,
        })
        get().updateQuotationDocumentSections(docResult.documentId, sections)

        const lines = syncLineTotals(opportunityLinesToQuotationPriceLines(resolvedLines))
        get().updateQuotationDocumentPriceTable(docResult.documentId, lines)

        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) =>
            d.id === docResult.documentId
              ? mergeAudit(d, {
                  salesOwnerId: owner.createdById,
                  salesOwnerName: owner.createdByName,
                  commercialNotes: commercialNotes ?? null,
                  technicalNotes: productRequirement || null,
                  locationId,
                  ...stampModified(d),
                })
              : d,
          ),
        }))

        logActivity(get, set, {
          type: 'quotation_created',
          subject: 'Quotation created (direct)',
          description: `${quo.quotationId} for ${customer.customerName}`,
          customerId,
          quotationId: quo.quotationId,
          ownerId: owner.createdById,
          ownerName: owner.createdByName,
        })

        return { ok: true, quotationId: quo.quotationId, documentId: docResult.documentId }
      },

      convertQuotationDocumentToSalesOrder: (documentId, handover) => {
        if (!canConvertQuotationToSalesOrderPermission()) {
          return { ok: false, error: 'You do not have permission to convert quotations to sales orders.' }
        }

        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }

        const existingSoId = doc.salesOrderId
          ?? useSalesStore.getState().getQuotation(doc.quotationId)?.salesOrderId
          ?? null
        if (doc.status === 'converted' || existingSoId) {
          const salesQuo = useSalesStore.getState().getQuotation(doc.quotationId)
          return {
            ok: false,
            error: 'Quotation already converted to a sales order',
            alreadyConverted: true,
            salesOrderId: existingSoId ?? undefined,
            salesOrderNo: doc.salesOrderNo ?? salesQuo?.salesOrderNo ?? undefined,
          }
        }

        const latestDoc = get().getLatestQuotationDocument(doc.quotationId)
        const salesState = useSalesStore.getState()
        const salesQuo = salesState.getQuotation(doc.quotationId)
        const masters = useMasterStore.getState()
        const customer = salesQuo ? masters.getCustomer(salesQuo.customerId) : undefined
        const contact = doc.contactId ? get().getContact(doc.contactId) : undefined
        const opportunity = doc.opportunityId ? get().getOpportunity(doc.opportunityId) : undefined
        const product = salesQuo ? masters.getProduct(salesQuo.productId) : undefined

        if (!doc.opportunityId || !opportunity) {
          return { ok: false, error: 'Link this quotation to an opportunity before creating a sales order' }
        }
        if (opportunity.stage === 'lost' || opportunity.status === 'lost') {
          return { ok: false, error: 'Cannot convert quotation — opportunity is Lost or Cancelled' }
        }
        if (customer && customer.isActive === false) {
          return { ok: false, error: 'Customer is inactive — cannot convert quotation' }
        }

        const validation = validateQuotationForSoConversion({
          document: doc,
          latestDocument: latestDoc,
          salesQuotation: salesQuo,
          customer,
          contactName: contact?.name,
          opportunityName: opportunity?.opportunityName,
          productName: product?.productName,
        })
        if (!validation.canConvert) {
          return {
            ok: false,
            error: validation.disabledReason ?? 'Quotation cannot be converted',
            validationIssues: validation.issues.filter((i) => i.blocking).map((i) => i.message),
          }
        }

        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiConvertQuotationToSalesOrder(doc.quotationId, documentId, handover),
          )
        }

        const line = primaryPriceLine(doc)
        const lines = syncLineTotals(doc.priceLines).filter((l) => !l.isOptional)
        const summary = calcPriceSummary(lines, doc.freightAmount, doc.installationAmount, doc.customCharges)
        const soLines = buildSalesOrderLinesFromQuotationDocument({
          document: doc,
          opportunity,
          salesQuotation: salesQuo,
          products: masters.products,
          defaultProduct: product,
        })

        const result = salesState.createSalesOrderFromQuotation(doc.quotationId, {
          quotationDocumentId: doc.id,
          quotationDocumentRevisionNo: doc.revisionNo,
          opportunityId: doc.opportunityId,
          contactId: doc.contactId ?? opportunity?.contactId ?? null,
          grandTotal: summary.grandTotal,
          unitPrice: line?.unitPrice ?? doc.totalAmount,
          discountPct: line?.discountPct ?? 0,
          paymentTerms: sectionContent(doc, 'payment') || salesQuo?.paymentTerms,
          deliveryTerms: sectionContent(doc, 'delivery') || salesQuo?.deliveryTerms,
          warrantyTerms: sectionContent(doc, 'warranty') || undefined,
          commercialNotes: doc.commercialNotes ?? sectionContent(doc, 'commercial'),
          technicalNotes: doc.technicalNotes ?? sectionContent(doc, 'technical'),
          customerPoNumber: handover?.customerPoNumber,
          customerPoDate: handover?.customerPoDate,
          expectedDeliveryDate: handover?.expectedDeliveryDate,
          deliveryLocation: handover?.deliveryLocation,
          locationId: handover?.locationId ?? salesQuo?.locationId ?? opportunity?.locationId ?? null,
          internalRemarks: handover?.internalRemarks,
          salesOwnerId: doc.salesOwnerId,
          salesOwnerName: doc.salesOwnerName,
          basicAmount: summary.taxableValue,
          gstAmount: summary.gstAmount,
          billingAddress: customer ? formatCustomerBillingAddress(customer) : undefined,
          shippingAddress: customer ? resolveCustomerShippingAddress(customer) : undefined,
          customerCode: customer?.customerCode,
          lines: soLines,
        })
        if (!result.ok) return result

        const soNo = result.salesOrderNo ?? 'SO'
        const alreadyWon = opportunity.stage === 'won' || opportunity.status === 'won'
        const today = new Date().toISOString().slice(0, 10)
        set((s) => ({
          quotationDocuments: s.quotationDocuments.map((d) => {
            if (d.id === documentId) {
              return mergeAudit(d, {
                status: 'converted',
                locked: true,
                salesOrderId: result.salesOrderId ?? null,
                salesOrderNo: result.salesOrderNo ?? null,
                ...stampModified(d),
              })
            }
            if (
              d.quotationId === doc.quotationId
              && d.id !== documentId
              && d.status !== 'converted'
              && d.status !== 'rejected'
              && d.status !== 'superseded'
            ) {
              return mergeAudit(d, { status: 'superseded', locked: true, ...stampModified(d) })
            }
            return d
          }),
          opportunities: s.opportunities.map((o) =>
            o.id === opportunity.id
              ? mergeAudit(o, {
                  salesOrderId: result.salesOrderId ?? null,
                  stage: 'won',
                  status: 'won',
                  probability: 100,
                  value: summary.grandTotal,
                  // Preserve original close date when already Won.
                  expectedCloseDate: alreadyWon
                    ? o.expectedCloseDate
                    : (o.expectedCloseDate || today),
                  ...stampModified(o),
                })
              : o,
          ),
        }))
        logActivity(get, set, {
          type: alreadyWon ? 'note' : 'sales_order_created',
          subject: alreadyWon ? `Sales order ${soNo} linked` : 'CRM handover complete',
          description: alreadyWon
            ? `Quotation ${salesQuo?.quotationNo ?? doc.quotationId} converted to ${soNo} (opportunity was already Won).`
            : `Quotation ${salesQuo?.quotationNo ?? doc.quotationId} Rev ${doc.revisionNo} converted to Sales Order ${soNo}.`,
          quotationId: doc.quotationId,
          opportunityId: doc.opportunityId ?? undefined,
          customerId: salesQuo?.customerId,
          ownerId: doc.salesOwnerId ?? doc.createdById,
          ownerName: doc.salesOwnerName ?? doc.createdByName,
        })
        return result
      },

      syncOpportunityValueFromDocument: (opportunityId, documentId) => {
        const doc = get().getQuotationDocument(documentId)
        if (!doc) return { ok: false, error: 'Document not found' }
        set((s) => ({
          opportunities: s.opportunities.map((o) =>
            o.id === opportunityId ? mergeAudit(o, { value: doc.totalAmount, ...stampModified(o) }) : o,
          ),
        }))
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.crm,
      storage: erpStorage,
      merge: (persisted, current): CrmState => {
        const p = persisted as Partial<CrmState> | undefined
        const base = emptyCrmState()
        if (isApiMode()) {
          return {
            ...current,
            ...p,
            contacts: current.contacts ?? base.contacts,
            opportunities: current.opportunities ?? base.opportunities,
            activities: current.activities ?? base.activities,
            followUps: Array.isArray(p?.followUps) ? p.followUps : current.followUps ?? base.followUps,
            quotationDocuments: Array.isArray(p?.quotationDocuments)
              ? p.quotationDocuments
              : current.quotationDocuments ?? base.quotationDocuments,
            quotationTemplates: [],
          }
        }
        return {
          ...current,
          ...p,
          contacts: Array.isArray(p?.contacts) ? p.contacts : current.contacts ?? base.contacts,
          opportunities: Array.isArray(p?.opportunities) ? p.opportunities : current.opportunities ?? base.opportunities,
          activities: Array.isArray(p?.activities) ? p.activities : current.activities ?? base.activities,
          followUps: Array.isArray(p?.followUps) ? p.followUps : current.followUps ?? base.followUps,
          quotationDocuments: Array.isArray(p?.quotationDocuments)
            ? p.quotationDocuments
            : current.quotationDocuments ?? base.quotationDocuments,
          quotationTemplates: Array.isArray(p?.quotationTemplates)
            ? p.quotationTemplates
            : current.quotationTemplates ?? base.quotationTemplates,
        }
      },
      partialize: (s) => ({
        contacts: isApiMode() ? [] : s.contacts,
        opportunities: isApiMode() ? [] : s.opportunities,
        activities: isApiMode() ? [] : s.activities,
        followUps: isApiMode() ? [] : s.followUps,
        quotationDocuments: isApiMode() ? [] : s.quotationDocuments,
        quotationTemplates: isApiMode() ? [] : s.quotationTemplates,
      }),
      onRehydrateStorage: () => (state) => {
        queueMicrotask(() => {
          void import('../demo/factories/crmEcosystemBootstrap').then(({ syncCrmStoreArtifacts, bootstrapCrmEcosystemOnce }) => {
            if (isApiMode()) {
              // Clear any leftover demo showcase rows that may still be in memory from seed defaults
              useCrmStore.setState((s) => ({
                opportunities: s.opportunities.filter((o) => o.id !== ISO_TANK_SHOWCASE_OPPORTUNITY_ID),
                quotationDocuments: s.quotationDocuments.filter((d) => d.id !== ISO_TANK_SHOWCASE_DOCUMENT_ID),
                followUps: [],
              }))
              return
            }
            syncCrmStoreArtifacts()
            if (!state?.opportunities?.length) {
              bootstrapCrmEcosystemOnce()
            }
          })
        })
      },
    },
  ),
)
