import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CustomerApprovalStatus,
  Inquiry,
  InquiryAttachment,
  Lead,
  LeadActivityStatus,
  LeadLifecycleStatus,
  LeadPriority,
  LeadStage,
  LeadSource,
  Quotation,
  QuotationPricing,
  QuotationStatus,
} from '../types/sales'
import type { SalesOrderLine } from '../types/mrp'
import {
  INQUIRY_STATUS_FLOW,
  LEAD_STAGE_FLOW,
} from '../types/sales'
import { seedInquiries, seedLeads, seedQuotations } from '../data/sales/seed'
import { mergeAudit, stampCreated, stampModified } from '../utils/audit'
import { nextDocumentNo } from '../utils/documentNumbers'
import { assertPermission } from '../utils/permissions'
import { useMrpStore } from './mrpStore'
import { useMasterStore } from './masterStore'
import { useCrmStore } from './crmStore'
import { formatCustomerBillingAddress, resolveCustomerShippingAddress } from '../utils/customerUtils'
import { useProductMasterStore } from './productMasterStore'
import { normalizeLead, mapLifecycleToStage, mapStageToLifecycle, deriveLifecycleFromStage, isLeadStageLocked } from '../utils/leadUtils'
import { getLeadUser } from '../data/crm/leadUsers'
import { getSessionUser } from '../utils/permissions'
import { erpStorage } from './persistConfig'
import { isApiMode } from '../config/apiConfig'
import type { StoreAction, StoreActionResult } from './storeAction'

const DEFAULT_GST_PCT = 18
const DEFAULT_VALIDITY_DAYS = 30

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function computePricing(qty: number, unitPrice: number, discountPct: number, gstPct = DEFAULT_GST_PCT): QuotationPricing {
  const subtotal = Math.round(qty * unitPrice * (1 - discountPct / 100) * 100) / 100
  const gstAmount = Math.round(subtotal * (gstPct / 100) * 100) / 100
  return {
    unitPrice,
    discountPct,
    subtotal,
    gstPct,
    gstAmount,
    grandTotal: Math.round((subtotal + gstAmount) * 100) / 100,
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function canTransition<T extends string>(flow: Record<T, T[]>, from: T, to: T): boolean {
  return flow[from]?.includes(to) ?? false
}

interface CreateLeadInput {
  source?: LeadSource
  industry?: string
  customerId?: string | null
  prospectName: string
  leadOwnerId: string
  leadOwnerName: string
  expectedValue: number
  probability?: number
  remarks?: string
  priority: LeadPriority
  createdDate: string
  activityStatus: LeadActivityStatus
  inactiveReason?: string | null
  lifecycleStatus: LeadLifecycleStatus
  closedDate?: string | null
  closedReason?: string | null
  productRequirement: string
  expectedQty?: number | null
  expectedCloseDate?: string | null
  contactPerson?: string | null
  contactId?: string | null
  mobile?: string | null
  email?: string | null
  nextFollowUpDate?: string | null
  followUpType?: string | null
  followUpNotes?: string | null
  stage?: LeadStage
  notQualifiedReason?: string | null
  opportunityId?: string | null
  locationId?: string | null
}

interface CreateInquiryInput {
  leadId?: string | null
  customerId: string
  productId: string
  qty: number
  deliveryExpectation: string
  notes?: string
}

interface CreateQuotationInput {
  inquiryId?: string
  opportunityId?: string
  opportunityNo?: string
  customerId?: string
  productId?: string
  qty?: number
  unitPrice: number
  discountPct?: number
  gstPct?: number
  terms?: string
  paymentTerms?: string
  deliveryTerms?: string
  validityDate?: string
  locationId?: string | null
}

export interface CrmSalesOrderContext {
  quotationDocumentId: string
  quotationDocumentRevisionNo: number
  opportunityId?: string | null
  contactId?: string | null
  grandTotal?: number
  unitPrice?: number
  discountPct?: number
  paymentTerms?: string
  deliveryTerms?: string
  warrantyTerms?: string
  commercialNotes?: string
  technicalNotes?: string
  customerPoNumber?: string
  customerPoDate?: string
  expectedDeliveryDate?: string
  deliveryLocation?: string
  locationId?: string | null
  internalRemarks?: string
  salesOwnerId?: string | null
  salesOwnerName?: string | null
  basicAmount?: number
  gstAmount?: number
  billingAddress?: string
  shippingAddress?: string
  customerCode?: string
  lines?: SalesOrderLine[]
}

interface SalesState {
  leads: Lead[]
  inquiries: Inquiry[]
  quotations: Quotation[]

  getLead: (id: string) => Lead | undefined
  getInquiry: (id: string) => Inquiry | undefined
  getQuotation: (id: string) => Quotation | undefined
  getQuotationsForInquiry: (inquiryId: string) => Quotation[]
  getQuotationsForOpportunity: (opportunityId: string) => Quotation[]
  getRevisionChain: (rootQuotationId: string) => Quotation[]
  getPendingCustomerApprovals: () => Quotation[]

  createLead: (input: CreateLeadInput) => StoreAction<StoreActionResult & { leadId?: string }>
  updateLead: (id: string, patch: Partial<Omit<Lead, 'id' | 'leadNo' | 'createdAt' | 'createdById' | 'createdByName'>>) => StoreAction<StoreActionResult>
  assignLead: (id: string, leadOwnerId: string, notes?: string) => StoreAction<StoreActionResult>
  advanceLeadStage: (
    id: string,
    stage: LeadStage,
    extras?: {
      remarks?: string
      notQualifiedReason?: string
      closedReason?: string
      closedDate?: string | null
    },
  ) => StoreAction<StoreActionResult>
  linkLeadToOpportunity: (leadId: string, opportunityId: string) => StoreAction<StoreActionResult>
  getInquiriesForLead: (leadId: string) => Inquiry[]
  archiveLead: (id: string) => StoreAction<StoreActionResult>
  convertLeadToInquiry: (leadId: string, productId: string, qty: number, deliveryExpectation: string, notes?: string) => { ok: boolean; error?: string; inquiryId?: string; opportunityId?: string }

  createInquiry: (input: CreateInquiryInput) => { ok: boolean; error?: string; inquiryId?: string }
  updateInquiry: (id: string, patch: Partial<Pick<Inquiry, 'customerId' | 'productId' | 'qty' | 'deliveryExpectation' | 'notes'>>) => { ok: boolean; error?: string }
  submitInquiry: (id: string) => { ok: boolean; error?: string }
  addInquiryAttachment: (id: string, name: string) => { ok: boolean; error?: string }

  createQuotationFromOpportunity: (input: CreateQuotationInput & { opportunityId: string; opportunityNo: string; customerId: string; productId: string; qty: number }) => StoreAction<StoreActionResult & { quotationId?: string }>
  /** Direct quotation — customer required, opportunity optional/null */
  createQuotationDirect: (input: CreateQuotationInput & { customerId: string; qty: number; productId?: string | null }) => StoreAction<StoreActionResult & { quotationId?: string }>
  /** @deprecated Use createQuotationFromOpportunity */
  createQuotationFromInquiry: (input: CreateQuotationInput & { inquiryId: string }) => StoreAction<StoreActionResult & { quotationId?: string }>
  createQuotationRevision: (quotationId: string, changes: { unitPrice?: number; discountPct?: number; summary: string }) => { ok: boolean; error?: string; quotationId?: string }
  updateQuotationDraft: (id: string, patch: Partial<Pick<Quotation, 'terms' | 'paymentTerms' | 'deliveryTerms' | 'validityDate'>> & { unitPrice?: number; discountPct?: number }) => StoreAction<StoreActionResult>
  submitQuotationForApproval: (id: string) => { ok: boolean; error?: string }
  recordCustomerApproval: (id: string, decision: CustomerApprovalStatus, rejectionReason?: string) => { ok: boolean; error?: string }

  createSalesOrderFromQuotation: (quotationId: string, crm?: CrmSalesOrderContext) => { ok: boolean; error?: string; salesOrderId?: string; salesOrderNo?: string }
  createDirectSalesOrder: (input: {
    customerId: string
    productId: string
    qty: number
    unitPrice: number
    customerPoNumber: string
    paymentTerms: string
    deliveryTerms: string
    directSoReason: string
    expectedDeliveryDate?: string
    deliveryLocation?: string
    locationId?: string | null
    internalRemarks?: string
    opportunityId?: string | null
    contactId?: string | null
    quotationId?: string | null
    quotationNo?: string | null
    quotationRevisionNo?: number | null
    quotationDocumentId?: string | null
    customerPoDate?: string
    freightAmount?: number
    orderDiscountAmount?: number
    lines?: Array<{
      productId: string
      qty: number
      unitPrice: number
      discountPct?: number
      taxPct?: number
      description?: string
    }>
  }) => { ok: boolean; error?: string; salesOrderId?: string; salesOrderNo?: string }
  confirmSalesOrder: (salesOrderId: string) => { ok: boolean; error?: string }
  triggerProductionForOrder: (salesOrderId: string) => { ok: boolean; error?: string; runId?: string }
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get): SalesState => ({
      leads: isApiMode() ? [] : seedLeads.map((l) => ({ ...l })),
      inquiries: isApiMode() ? [] : seedInquiries.map((i) => ({ ...i })),
      quotations: isApiMode() ? [] : seedQuotations.map((q) => ({ ...q })),

      getLead: (id) => get().leads.find((l) => l.id === id),
      getInquiry: (id) => get().inquiries.find((i) => i.id === id),
      getQuotation: (id) => get().quotations.find((q) => q.id === id),
      getQuotationsForInquiry: (inquiryId) =>
        get()
          .quotations.filter((q) => q.inquiryId === inquiryId)
          .sort((a, b) => a.revisionNo - b.revisionNo),

      getQuotationsForOpportunity: (opportunityId) =>
        get()
          .quotations.filter((q) => q.opportunityId === opportunityId)
          .sort((a, b) => a.revisionNo - b.revisionNo),

      getRevisionChain: (rootQuotationId) =>
        get()
          .quotations.filter((q) => q.rootQuotationId === rootQuotationId)
          .sort((a, b) => a.revisionNo - b.revisionNo),

      getPendingCustomerApprovals: () =>
        get().quotations.filter(
          (q) => q.isLatestRevision && q.status === 'pending_approval' && q.customerApproval === 'pending',
        ),

      createLead: (input) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateLead(input as unknown as Record<string, unknown>))
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm

        const session = getSessionUser()
        const ownerName = input.leadOwnerName || session.name
        const stage = input.stage ?? mapLifecycleToStage(input.lifecycleStatus, 'new')
        const lifecycleStatus = input.lifecycleStatus ?? deriveLifecycleFromStage(stage)
        const leadNo = nextDocumentNo('LEAD-', get().leads.map((l) => l.leadNo))
        const lead: Lead = normalizeLead({
          id: genId('lead'),
          leadNo,
          source: input.source ?? 'other',
          industry: input.industry ?? '',
          customerId: input.customerId ?? null,
          prospectName: input.prospectName,
          salesOwner: ownerName,
          leadOwnerId: input.leadOwnerId || session.id,
          leadOwnerName: ownerName,
          expectedValue: input.expectedValue,
          probability: input.probability ?? 30,
          stage,
          remarks: input.remarks ?? input.productRequirement ?? '',
          priority: input.priority,
          createdDate: input.createdDate,
          activityStatus: input.activityStatus,
          inactiveReason: input.inactiveReason ?? null,
          lifecycleStatus,
          closedDate: input.closedDate ?? null,
          closedReason: input.closedReason ?? null,
          notQualifiedReason: input.notQualifiedReason ?? null,
          opportunityId: input.opportunityId ?? null,
          productRequirement: input.productRequirement,
          expectedQty: input.expectedQty ?? null,
          expectedCloseDate: input.expectedCloseDate ?? null,
          contactPerson: input.contactPerson ?? null,
          contactId: input.contactId ?? null,
          mobile: input.mobile ?? null,
          email: input.email ?? null,
          nextFollowUpDate: input.nextFollowUpDate ?? null,
          followUpType: input.followUpType ?? null,
          followUpNotes: input.followUpNotes ?? null,
          locationId: input.locationId ?? null,
          ...stampCreated(),
        })
        set((s) => ({ leads: [lead, ...s.leads] }))
        return { ok: true, leadId: lead.id }
      },

      updateLead: (id, patch) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateLead(id, patch as Record<string, unknown>))
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm
        const lead = get().getLead(id)
        if (!lead) return { ok: false, error: 'Lead not found' }
        if (isLeadStageLocked(lead.stage)) {
          return { ok: false, error: 'Lead is locked — cannot edit' }
        }
        const merged = { ...patch }
        if (patch.leadOwnerName) merged.salesOwner = patch.leadOwnerName
        if (patch.stage) {
          merged.lifecycleStatus = deriveLifecycleFromStage(patch.stage)
        } else if (patch.lifecycleStatus) {
          merged.stage = mapLifecycleToStage(patch.lifecycleStatus, lead.stage)
        }
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id ? normalizeLead(mergeAudit(l, { ...merged, ...stampModified(l) })) : l,
          ),
        }))
        return { ok: true }
      },

      assignLead: (id, leadOwnerId, notes) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiAssignLead(id, leadOwnerId, notes))
        const lead = get().getLead(id)
        if (!lead) return { ok: false, error: 'Lead not found' }
        const ownerName = getLeadUser(leadOwnerId)?.name
        return get().updateLead(id, {
          leadOwnerId,
          ...(ownerName ? { leadOwnerName: ownerName } : {}),
        })
      },

      advanceLeadStage: (id, stage, extras) => {
        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) => m.apiAdvanceLeadStage(id, stage, extras))
        }
        const lead = get().getLead(id)
        if (!lead) return { ok: false, error: 'Lead not found' }
        if (!canTransition(LEAD_STAGE_FLOW, lead.stage, stage) && lead.stage !== stage) {
          // Allow same-stage no-op; otherwise enforce flow (closed/not_qualified may be direct from form)
          const forced = stage === 'closed' || stage === 'not_qualified' || stage === 'qualified'
          if (!forced) {
            return { ok: false, error: `Cannot move from ${lead.stage} to ${stage}` }
          }
        }
        const lifecycleStatus = mapStageToLifecycle(stage)
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? normalizeLead(mergeAudit(l, {
                stage,
                lifecycleStatus,
                ...(extras?.notQualifiedReason !== undefined ? { notQualifiedReason: extras.notQualifiedReason } : {}),
                ...(extras?.closedReason !== undefined ? { closedReason: extras.closedReason } : {}),
                ...(extras?.closedDate !== undefined ? { closedDate: extras.closedDate } : {}),
                ...stampModified(l),
              }))
              : l,
          ),
        }))
        return { ok: true }
      },

      linkLeadToOpportunity: (leadId, opportunityId) => {
        if (isApiMode()) return { ok: true }
        const lead = get().getLead(leadId)
        if (!lead) return { ok: false, error: 'Lead not found' }
        if (lead.opportunityId && lead.opportunityId !== opportunityId) {
          return { ok: false, error: 'Lead is already linked to another opportunity' }
        }
        const stage: LeadStage = 'converted_to_opportunity'
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === leadId
              ? normalizeLead(
                  mergeAudit(l, {
                    opportunityId,
                    stage,
                    lifecycleStatus: 'converted',
                    ...stampModified(l),
                  }),
                )
              : l,
          ),
        }))
        return { ok: true }
      },

      getInquiriesForLead: (leadId) =>
        get()
          .inquiries.filter((i) => i.leadId === leadId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      archiveLead: (id) => {
        if (isApiMode()) return import('../services/bridges/crmApiBridge').then((m) => m.apiDeleteLead(id))
        const perm = assertPermission('sales', 'override')
        if (!perm.ok) return perm
        const lead = get().getLead(id)
        if (!lead) return { ok: false, error: 'Lead not found' }
        if (lead.isArchived) return { ok: false, error: 'Lead is already archived' }
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? normalizeLead(
                  mergeAudit(l, {
                    isArchived: true,
                    activityStatus: 'inactive',
                    ...stampModified(l),
                  }),
                )
              : l,
          ),
        }))
        return { ok: true }
      },

      convertLeadToInquiry: () => ({
        ok: false as const,
        error: 'Inquiries are merged into Opportunities. Use Create Opportunity from the lead instead.',
      }),

      createInquiry: (input) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm

        const inquiryNo = nextDocumentNo('INQ-', get().inquiries.map((i) => i.inquiryNo))
        const inquiry: Inquiry = {
          id: genId('inq'),
          inquiryNo,
          leadId: input.leadId ?? null,
          customerId: input.customerId,
          productId: input.productId,
          qty: input.qty,
          deliveryExpectation: input.deliveryExpectation,
          notes: input.notes ?? '',
          attachments: [],
          status: 'draft',
          ...stampCreated(),
        }
        set((s) => ({ inquiries: [inquiry, ...s.inquiries] }))
        return { ok: true, inquiryId: inquiry.id }
      },

      updateInquiry: (id, patch) => {
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm
        const inquiry = get().getInquiry(id)
        if (!inquiry) return { ok: false, error: 'Inquiry not found' }
        if (inquiry.status !== 'draft') return { ok: false, error: 'Only draft inquiries can be edited' }
        set((s) => ({
          inquiries: s.inquiries.map((i) => (i.id === id ? mergeAudit(i, { ...patch, ...stampModified(i) }) : i)),
        }))
        return { ok: true }
      },

      submitInquiry: (id) => {
        const inquiry = get().getInquiry(id)
        if (!inquiry) return { ok: false, error: 'Inquiry not found' }
        if (!canTransition(INQUIRY_STATUS_FLOW, inquiry.status, 'submitted')) {
          return { ok: false, error: `Cannot submit inquiry in status ${inquiry.status}` }
        }
        set((s) => ({
          inquiries: s.inquiries.map((i) =>
            i.id === id ? mergeAudit(i, { status: 'submitted', ...stampModified(i) }) : i,
          ),
        }))
        return { ok: true }
      },

      addInquiryAttachment: (id, name) => {
        const inquiry = get().getInquiry(id)
        if (!inquiry) return { ok: false, error: 'Inquiry not found' }
        const attachment: InquiryAttachment = {
          id: genId('att'),
          name,
          uploadedAt: new Date().toISOString(),
        }
        set((s) => ({
          inquiries: s.inquiries.map((i) =>
            i.id === id
              ? mergeAudit(i, { attachments: [...i.attachments, attachment], ...stampModified(i) })
              : i,
          ),
        }))
        return { ok: true }
      },

      createQuotationFromOpportunity: (input) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm

        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) => m.apiCreateQuotationFromOpportunity(input))
        }

        const existing = get().getQuotationsForOpportunity(input.opportunityId)
        if (existing.length > 0) {
          return { ok: false, error: 'Quotation already exists — create a revision instead' }
        }

        const quotationNo = nextDocumentNo('QUO-', get().quotations.map((q) => q.quotationNo))
        const id = genId('quo')
        const discountPct = input.discountPct ?? 0
        const gstPct = input.gstPct ?? DEFAULT_GST_PCT
        const pricing = computePricing(input.qty, input.unitPrice, discountPct, gstPct)
        const validityDate = input.validityDate ?? addDays(new Date().toISOString(), DEFAULT_VALIDITY_DAYS)

        const quotation: Quotation = {
          id,
          quotationNo,
          opportunityId: input.opportunityId,
          opportunityNo: input.opportunityNo,
          customerId: input.customerId,
          productId: input.productId,
          qty: input.qty,
          revisionNo: 1,
          rootQuotationId: id,
          isLatestRevision: true,
          locked: false,
          status: 'draft',
          customerApproval: 'pending',
          customerApprovalAt: null,
          customerApprovalBy: null,
          customerRejectionReason: null,
          terms: input.terms ?? 'Standard manufacturing terms apply.',
          paymentTerms: input.paymentTerms ?? '30% advance, 70% before dispatch',
          deliveryTerms: input.deliveryTerms ?? 'Ex-works Nashik',
          validityDate,
          pricing,
          changeHistory: [
            {
              revisionNo: 1,
              changedAt: new Date().toISOString(),
              changedByName: stampCreated().createdByName,
              summary: 'Initial quotation created from opportunity',
            },
          ],
          salesOrderId: null,
          salesOrderNo: null,
          locationId: input.locationId ?? useCrmStore.getState().getOpportunity(input.opportunityId)?.locationId ?? null,
          ...stampCreated(),
        }

        set((s) => ({ quotations: [quotation, ...s.quotations] }))
        return { ok: true, quotationId: quotation.id }
      },

      createQuotationDirect: (input) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm

        if (isApiMode()) {
          return import('../services/bridges/crmApiBridge').then((m) =>
            m.apiCreateQuotation({
              customerId: input.customerId,
              opportunityId: null,
              productId: input.productId ?? null,
              qty: input.qty,
              unitPrice: input.unitPrice,
              discountPct: input.discountPct ?? 0,
              gstPct: input.gstPct ?? DEFAULT_GST_PCT,
              terms: input.terms,
              paymentTerms: input.paymentTerms,
              deliveryTerms: input.deliveryTerms,
              validityDate: input.validityDate,
              locationId: input.locationId ?? null,
              summary: 'Initial quotation created for customer (direct)',
            }),
          )
        }

        const quotationNo = nextDocumentNo('QUO-', get().quotations.map((q) => q.quotationNo))
        const id = genId('quo')
        const discountPct = input.discountPct ?? 0
        const gstPct = input.gstPct ?? DEFAULT_GST_PCT
        const pricing = computePricing(input.qty, input.unitPrice, discountPct, gstPct)
        const validityDate = input.validityDate ?? addDays(new Date().toISOString(), DEFAULT_VALIDITY_DAYS)

        const quotation: Quotation = {
          id,
          quotationNo,
          opportunityId: null,
          opportunityNo: null,
          customerId: input.customerId,
          productId: input.productId ?? '',
          qty: input.qty,
          revisionNo: 1,
          rootQuotationId: id,
          isLatestRevision: true,
          locked: false,
          status: 'draft',
          customerApproval: 'pending',
          customerApprovalAt: null,
          customerApprovalBy: null,
          customerRejectionReason: null,
          terms: input.terms ?? 'Standard manufacturing terms apply.',
          paymentTerms: input.paymentTerms ?? '30% advance, 70% before dispatch',
          deliveryTerms: input.deliveryTerms ?? 'Ex-works Nashik',
          validityDate,
          pricing,
          changeHistory: [
            {
              revisionNo: 1,
              changedAt: new Date().toISOString(),
              changedByName: stampCreated().createdByName,
              summary: 'Initial quotation created for customer (direct)',
            },
          ],
          salesOrderId: null,
          salesOrderNo: null,
          locationId: input.locationId ?? null,
          ...stampCreated(),
        }

        set((s) => ({ quotations: [quotation, ...s.quotations] }))
        return { ok: true, quotationId: quotation.id }
      },

      createQuotationFromInquiry: (input) => {
        const inquiry = get().getInquiry(input.inquiryId)
        if (!inquiry) return { ok: false, error: 'Inquiry not found — use Opportunities for new quotations' }
        if (inquiry.status === 'cancelled' || inquiry.status === 'closed') {
          return { ok: false, error: 'Inquiry is closed' }
        }
        const crmOpps = (require('./crmStore') as typeof import('./crmStore')).useCrmStore.getState().opportunities
        const linkedOpp = crmOpps.find((o) => o.inquiryId === inquiry.id)
        return get().createQuotationFromOpportunity({
          opportunityId: linkedOpp?.id ?? `legacy-inq-${inquiry.id}`,
          opportunityNo: linkedOpp?.opportunityNo ?? inquiry.inquiryNo,
          customerId: inquiry.customerId,
          productId: inquiry.productId,
          qty: inquiry.qty,
          unitPrice: input.unitPrice,
          discountPct: input.discountPct,
          gstPct: input.gstPct,
          terms: input.terms,
          paymentTerms: input.paymentTerms,
          deliveryTerms: input.deliveryTerms,
          validityDate: input.validityDate,
        })
      },

      createQuotationRevision: (quotationId, changes) => {
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm

        const current = get().getQuotation(quotationId)
        if (!current) return { ok: false, error: 'Quotation not found' }
        if (!current.isLatestRevision) return { ok: false, error: 'Only the latest revision can be revised' }
        if (current.status === 'converted') return { ok: false, error: 'Quotation already converted to sales order' }
        if (current.customerApproval === 'approved' && current.status === 'approved') {
          return { ok: false, error: 'Approved quotation cannot be revised — create a new opportunity if terms changed' }
        }

        const unitPrice = changes.unitPrice ?? current.pricing.unitPrice
        const discountPct = changes.discountPct ?? current.pricing.discountPct
        const pricing = computePricing(current.qty, unitPrice, discountPct, current.pricing.gstPct)
        const nextRev = current.revisionNo + 1
        const newId = genId('quo')
        const ts = new Date().toISOString()
        const user = stampCreated().createdByName

        const newQuotation: Quotation = {
          ...current,
          id: newId,
          revisionNo: nextRev,
          rootQuotationId: current.rootQuotationId,
          isLatestRevision: true,
          locked: false,
          status: 'draft',
          customerApproval: 'pending',
          customerApprovalAt: null,
          customerApprovalBy: null,
          customerRejectionReason: null,
          pricing,
          changeHistory: [
            ...current.changeHistory,
            {
              revisionNo: nextRev,
              changedAt: ts,
              changedByName: user,
              summary: changes.summary,
            },
          ],
          salesOrderId: null,
          salesOrderNo: null,
          ...stampCreated(),
        }

        set((s) => ({
          quotations: [
            newQuotation,
            ...s.quotations.map((q) =>
              q.id === current.id
                ? mergeAudit(
                    {
                      ...q,
                      isLatestRevision: false,
                      locked: true,
                      status: 'superseded' as QuotationStatus,
                    },
                    stampModified(q),
                  )
                : q,
            ),
          ],
        }))
        return { ok: true, quotationId: newId }
      },

      updateQuotationDraft: (id, patch) => {
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm

        if (isApiMode()) {
          const { unitPrice, discountPct, ...rest } = patch
          const payload: Record<string, unknown> = { ...rest }
          if (unitPrice != null) payload.unitPrice = unitPrice
          if (discountPct != null) payload.discountPct = discountPct
          return import('../services/bridges/crmApiBridge').then((m) => m.apiUpdateQuotation(id, payload))
        }

        const quo = get().getQuotation(id)
        if (!quo) return { ok: false, error: 'Quotation not found' }
        if (quo.locked) return { ok: false, error: 'Quotation revision is locked' }
        if (quo.status !== 'draft' && quo.status !== 'rejected') {
          return { ok: false, error: 'Only draft or rejected quotations can be edited' }
        }

        let pricing = quo.pricing
        if (patch.unitPrice != null || patch.discountPct != null) {
          pricing = computePricing(
            quo.qty,
            patch.unitPrice ?? quo.pricing.unitPrice,
            patch.discountPct ?? quo.pricing.discountPct,
            quo.pricing.gstPct,
          )
        }

        const { unitPrice: _u, discountPct: _d, ...rest } = patch
        set((s) => ({
          quotations: s.quotations.map((q) =>
            q.id === id ? mergeAudit(q, { ...rest, pricing, ...stampModified(q) }) : q,
          ),
        }))
        return { ok: true }
      },

      submitQuotationForApproval: (id) => {
        const quo = get().getQuotation(id)
        if (!quo) return { ok: false, error: 'Quotation not found' }
        if (quo.locked) return { ok: false, error: 'Quotation is locked' }
        if (quo.status !== 'draft' && quo.status !== 'rejected') {
          return { ok: false, error: `Cannot submit quotation in status ${quo.status}` }
        }

        set((s) => ({
          quotations: s.quotations.map((q) =>
            q.id === id
              ? mergeAudit(q, {
                  status: 'pending_approval',
                  customerApproval: 'pending',
                  ...stampModified(q),
                })
              : q,
          ),
        }))
        return { ok: true }
      },

      recordCustomerApproval: (id, decision, rejectionReason) => {
        const perm = assertPermission('sales', 'approve')
        if (!perm.ok) return perm

        const quo = get().getQuotation(id)
        if (!quo) return { ok: false, error: 'Quotation not found' }
        if (quo.locked) return { ok: false, error: 'Quotation is locked' }
        if (!quo.isLatestRevision) return { ok: false, error: 'Customer approval applies to latest revision only' }
        if (quo.status !== 'pending_approval') {
          return { ok: false, error: 'Quotation must be pending approval' }
        }

        if (decision === 'approved') {
          set((s) => ({
            quotations: s.quotations.map((q) =>
              q.id === id
                ? mergeAudit(q, {
                    status: 'approved',
                    customerApproval: 'approved',
                    customerApprovalAt: new Date().toISOString(),
                    customerApprovalBy: stampCreated().createdByName,
                    customerRejectionReason: null,
                    ...stampModified(q),
                  })
                : q,
            ),
          }))
          return { ok: true }
        }

        if (decision === 'rejected') {
          set((s) => ({
            quotations: s.quotations.map((q) =>
              q.id === id
                ? mergeAudit(q, {
                    status: 'rejected',
                    customerApproval: 'rejected',
                    customerApprovalAt: new Date().toISOString(),
                    customerApprovalBy: stampCreated().createdByName,
                    customerRejectionReason: rejectionReason ?? 'Customer declined',
                    ...stampModified(q),
                  })
                : q,
            ),
          }))
          return { ok: true }
        }

        return { ok: false, error: 'Use approved or rejected decision' }
      },

      createSalesOrderFromQuotation: (quotationId, crm) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm

        const quo = get().getQuotation(quotationId)
        if (!quo) return { ok: false, error: 'Quotation not found' }
        if (quo.customerApproval !== 'approved' || quo.status !== 'approved') {
          return { ok: false, error: 'Sales order requires customer-approved quotation' }
        }
        if (!quo.isLatestRevision) {
          return { ok: false, error: 'Convert from the latest approved revision only' }
        }
        if (quo.salesOrderId) return { ok: false, error: 'Sales order already created for this quotation' }

        const productCheck = useProductMasterStore.getState().canUseProductInSales(quo.productId)
        if (!productCheck.ok) return productCheck

        const lineProductId = crm?.lines?.find((l) => l.productId)?.productId ?? quo.productId
        const lineQty = crm?.lines?.length ? crm.lines.reduce((s, l) => s + l.qty, 0) : quo.qty
        if (lineProductId !== quo.productId) {
          const altCheck = useProductMasterStore.getState().canUseProductInSales(lineProductId)
          if (!altCheck.ok) return altCheck
        }
        for (const soLine of crm?.lines ?? []) {
          if (!soLine.productId || soLine.productId === lineProductId) continue
          const extraCheck = useProductMasterStore.getState().canUseProductInSales(soLine.productId)
          if (!extraCheck.ok) return extraCheck
        }

        const unitPrice = crm?.unitPrice ?? quo.pricing.unitPrice
        const discountPct = crm?.discountPct ?? quo.pricing.discountPct
        const grandTotal = crm?.grandTotal ?? quo.pricing.grandTotal
        const inquiry = quo.inquiryId ? get().getInquiry(quo.inquiryId) : undefined

        const mrp = useMrpStore.getState()
        const masters = useMasterStore.getState()
        const customer = masters.getCustomer(quo.customerId)
        const addResult = mrp.addSalesOrderFromQuotation({
          customerId: quo.customerId,
          productId: lineProductId,
          qty: lineQty,
          requiredDate: crm?.expectedDeliveryDate ?? inquiry?.deliveryExpectation ?? quo.validityDate,
          remarks: `${quo.quotationNo} Rev ${quo.revisionNo} — CRM doc Rev ${crm?.quotationDocumentRevisionNo ?? 0}`,
          quotationId: quo.id,
          quotationNo: quo.quotationNo,
          quotationRevisionNo: quo.revisionNo,
          quotationDocumentId: crm?.quotationDocumentId ?? null,
          quotationDocumentRevisionNo: crm?.quotationDocumentRevisionNo ?? null,
          inquiryId: quo.inquiryId ?? '',
          opportunityId: crm?.opportunityId ?? null,
          contactId: crm?.contactId ?? null,
          unitPrice,
          discountPct,
          grandTotal,
          paymentTerms: crm?.paymentTerms ?? quo.paymentTerms,
          deliveryTerms: crm?.deliveryTerms ?? quo.deliveryTerms,
          warrantyTerms: crm?.warrantyTerms ?? null,
          commercialNotes: crm?.commercialNotes ?? quo.terms,
          technicalNotes: crm?.technicalNotes ?? null,
          customerCode: crm?.customerCode ?? customer?.customerCode ?? null,
          customerPoNumber: crm?.customerPoNumber ?? null,
          customerPoDate: crm?.customerPoDate ?? null,
          expectedDeliveryDate: crm?.expectedDeliveryDate ?? inquiry?.deliveryExpectation ?? quo.validityDate,
          deliveryLocation: crm?.deliveryLocation ?? null,
          locationId: crm?.locationId ?? quo.locationId ?? null,
          billingAddress: crm?.billingAddress ?? (customer ? formatCustomerBillingAddress(customer) : null),
          shippingAddress: crm?.shippingAddress ?? (customer ? resolveCustomerShippingAddress(customer) : null),
          salesOwnerId: crm?.salesOwnerId ?? null,
          salesOwnerName: crm?.salesOwnerName ?? null,
          basicAmount: crm?.basicAmount ?? null,
          gstAmount: crm?.gstAmount ?? null,
          internalRemarks: crm?.internalRemarks ?? null,
          lines: crm?.lines ?? [],
          source: 'quotation',
        })
        if (!addResult.ok) return addResult

        set((s) => ({
          quotations: s.quotations.map((q) =>
            q.id === quo.id
              ? mergeAudit(q, {
                  status: 'converted',
                  salesOrderId: addResult.salesOrderId!,
                  salesOrderNo: addResult.salesOrderNo!,
                  ...stampModified(q),
                })
              : q,
          ),
        }))
        return { ok: true, salesOrderId: addResult.salesOrderId, salesOrderNo: addResult.salesOrderNo }
      },

      createDirectSalesOrder: (input) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm
        if (!input.customerPoNumber?.trim()) return { ok: false, error: 'Customer PO number is required' }
        if (!input.directSoReason?.trim()) return { ok: false, error: 'Reason for direct SO is required' }
        if (!input.paymentTerms?.trim() || !input.deliveryTerms?.trim()) {
          return { ok: false, error: 'Payment and delivery terms are required' }
        }

        const masters = useMasterStore.getState()
        const customer = masters.getCustomer(input.customerId)
        if (!customer) return { ok: false, error: 'Customer not found' }

        const lineInputs = input.lines?.length
          ? input.lines
          : [{
              productId: input.productId,
              qty: input.qty,
              unitPrice: input.unitPrice,
              discountPct: 0,
              taxPct: DEFAULT_GST_PCT,
            }]

        for (const line of lineInputs) {
          const productCheck = useProductMasterStore.getState().canUseProductInSales(line.productId)
          if (!productCheck.ok) return productCheck
        }

        const builtLines: SalesOrderLine[] = lineInputs.map((l, idx) => {
          const pricing = computePricing(l.qty, l.unitPrice, l.discountPct ?? 0, l.taxPct ?? DEFAULT_GST_PCT)
          const product = masters.getProduct(l.productId)
          return {
            id: genId('sol'),
            lineNo: idx + 1,
            productOrItem: product?.productName ?? l.productId,
            description: l.description || product?.productName || 'SO line',
            productId: l.productId,
            qty: l.qty,
            uom: 'Nos',
            unitPrice: l.unitPrice,
            discountPct: l.discountPct ?? 0,
            taxPct: l.taxPct ?? DEFAULT_GST_PCT,
            taxableValue: pricing.subtotal,
            gstAmount: pricing.gstAmount,
            lineTotal: pricing.grandTotal,
          }
        })

        const primary = builtLines[0]
        if (!primary?.productId) return { ok: false, error: 'At least one product line is required' }

        const basicAmount = Math.round(builtLines.reduce((s, l) => s + l.taxableValue, 0) * 100) / 100
        const gstAmount = Math.round(builtLines.reduce((s, l) => s + l.gstAmount, 0) * 100) / 100
        const freight = input.freightAmount ?? 0
        const orderDisc = input.orderDiscountAmount ?? 0
        const grandTotal = Math.round((basicAmount + gstAmount + freight - orderDisc) * 100) / 100
        const totalQty = builtLines.reduce((s, l) => s + l.qty, 0)

        const mrp = useMrpStore.getState()
        return mrp.addSalesOrderFromQuotation({
          customerId: input.customerId,
          productId: primary.productId,
          qty: totalQty,
          requiredDate: input.expectedDeliveryDate ?? addDays(new Date().toISOString(), 60),
          remarks: `Direct SO — ${input.directSoReason}`,
          quotationId: input.quotationId ?? '',
          quotationNo: input.quotationNo ?? '',
          quotationRevisionNo: input.quotationRevisionNo ?? 0,
          quotationDocumentId: input.quotationDocumentId ?? null,
          inquiryId: '',
          opportunityId: input.opportunityId ?? null,
          contactId: input.contactId ?? null,
          unitPrice: primary.unitPrice,
          grandTotal,
          paymentTerms: input.paymentTerms,
          deliveryTerms: input.deliveryTerms,
          customerCode: customer.customerCode,
          customerPoNumber: input.customerPoNumber,
          customerPoDate: input.customerPoDate,
          expectedDeliveryDate: input.expectedDeliveryDate,
          deliveryLocation: input.deliveryLocation,
          locationId: input.locationId ?? null,
          billingAddress: formatCustomerBillingAddress(customer),
          shippingAddress: resolveCustomerShippingAddress(customer),
          basicAmount,
          gstAmount,
          internalRemarks: input.internalRemarks,
          directSoReason: input.directSoReason,
          lines: builtLines,
          source: input.quotationId || input.opportunityId ? 'quotation' : 'direct',
        })
      },

      confirmSalesOrder: (salesOrderId) => {
        const perm = assertPermission('sales', 'approve')
        if (!perm.ok) return perm
        return useMrpStore.getState().confirmSalesOrder(salesOrderId)
      },

      triggerProductionForOrder: (salesOrderId) => {
        const perm = assertPermission('sales', 'post')
        if (!perm.ok) return perm
        return useMrpStore.getState().runMrpForOrder(salesOrderId, undefined, { autoReserve: true })
      },
    }),
    {
      name: 'vasant-erp-sales-v1',
      storage: erpStorage,
      partialize: (s) => ({
        leads: isApiMode() ? [] : s.leads,
        inquiries: isApiMode() ? [] : s.inquiries,
        quotations: isApiMode() ? [] : s.quotations,
      }),
    },
  ),
)
