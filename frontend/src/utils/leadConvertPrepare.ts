import type { Lead, LeadStage } from '../types/sales'
import type { Customer } from '../types/master'
import type { Opportunity } from '../types/crm'
import { resolveStoreAction, type StoreActionResult } from '../store/storeAction'
import {
  migrateLeadStage,
  resolveLeadConvertActionGate,
  resolveLeadConvertToOpportunityGate,
  resolveLeadCustomerIdForConvert,
} from './leadUtils'
import { primaryLinkedOpportunityIdForLead } from './leadEngagement'

type UpdateLeadFn = (
  id: string,
  patch: Partial<Pick<Lead, 'customerId' | 'prospectName'>>,
) => StoreActionResult | Promise<StoreActionResult>

type AdvanceLeadStageFn = (
  id: string,
  stage: LeadStage,
  extras?: { remarks?: string },
) => StoreActionResult | Promise<StoreActionResult>

const BLOCKED_AUTO_QUALIFY_STAGES = new Set<LeadStage>([
  'not_qualified',
  'closed',
  'converted_to_opportunity',
])

/**
 * Before Lead → Opportunity: reuse existing customerId, or persist an exact prospect-name
 * match to Company Master so convert gates pass.
 */
export async function prepareLeadForOpportunityConvert(
  lead: Lead,
  customers: Customer[],
  updateLead: UpdateLeadFn,
): Promise<{ ok: true; customerId: string } | { ok: false; reason: string }> {
  const { customerId, autoLinked } = resolveLeadCustomerIdForConvert(lead, customers)
  if (autoLinked && customerId) {
    const match = customers.find((c) => c.id === customerId)
    const r = await resolveStoreAction(
      updateLead(lead.id, {
        customerId,
        ...(match?.customerName ? { prospectName: match.customerName } : {}),
      }),
    )
    if (!r.ok) return { ok: false, reason: r.error ?? 'Failed to link company to lead' }
  }
  const gate = resolveLeadConvertToOpportunityGate({ ...lead, customerId })
  if (!gate.ok) {
    // Still return customerId when the only blocker is "not qualified" — callers may auto-qualify.
    if (gate.reason.includes('Qualify') && customerId) {
      return { ok: false, reason: gate.reason }
    }
    return gate
  }
  return { ok: true, customerId: customerId! }
}

export type EnsureLeadCommercialReadyResult =
  | {
      ok: true
      lead: Lead
      customerId: string
      qualifiedNow: boolean
      opportunityId: string | null
    }
  | { ok: false; reason: string }

/**
 * Ensures a lead is ready for Create Opportunity / Create Quotation:
 * links company when possible, auto-qualifies open leads, then returns the refreshed lead.
 */
export async function ensureLeadReadyForCommercialAction(
  lead: Lead,
  options: {
    customers: Customer[]
    updateLead: UpdateLeadFn
    advanceLeadStage: AdvanceLeadStageFn
    getLead: (id: string) => Lead | undefined
    /** Snapshot or live getter — re-read after qualify so mirrored opportunities appear. */
    opportunities: Pick<Opportunity, 'id' | 'leadId'>[] | (() => Pick<Opportunity, 'id' | 'leadId'>[])
    canConvertPermission: boolean
    /** When false, skip qualify attempt and surface a clear error. Default true. */
    canQualifyPermission?: boolean
  },
): Promise<EnsureLeadCommercialReadyResult> {
  const readOpportunities = () =>
    typeof options.opportunities === 'function' ? options.opportunities() : options.opportunities

  const stage = migrateLeadStage(lead.stage)
  if (BLOCKED_AUTO_QUALIFY_STAGES.has(stage) || lead.lifecycleStatus === 'converted' || lead.opportunityId) {
    if (lead.opportunityId || stage === 'converted_to_opportunity' || lead.lifecycleStatus === 'converted') {
      return { ok: false, reason: 'Lead is already converted to an opportunity' }
    }
    return { ok: false, reason: 'Reopen this lead before creating an opportunity or quotation.' }
  }

  if (!options.canConvertPermission) {
    return { ok: false, reason: 'Requires crm.lead.convert permission' }
  }

  const prepared = await prepareLeadForOpportunityConvert(lead, options.customers, options.updateLead)
  const customerId = prepared.ok
    ? prepared.customerId
    : resolveLeadCustomerIdForConvert(lead, options.customers).customerId

  if (!customerId?.trim()) {
    return { ok: false, reason: 'Link a company before creating an opportunity or quotation.' }
  }

  let working: Lead = { ...lead, customerId }
  let qualifiedNow = false

  if (migrateLeadStage(working.stage) !== 'qualified') {
    if (options.canQualifyPermission === false) {
      return { ok: false, reason: 'Requires crm.lead.qualify permission to auto-qualify this lead.' }
    }
    const qualify = await resolveStoreAction(
      options.advanceLeadStage(working.id, 'qualified', {
        remarks: 'Auto-qualified when creating opportunity / quotation',
      }),
    )
    if (!qualify.ok) {
      return { ok: false, reason: qualify.error ?? 'Could not qualify lead' }
    }
    qualifiedNow = true
    working = options.getLead(working.id) ?? { ...working, stage: 'qualified', lifecycleStatus: 'qualified' }
  }

  const gate = resolveLeadConvertActionGate(working, options.canConvertPermission)
  if (!gate.ok) return gate

  return {
    ok: true,
    lead: working,
    customerId: working.customerId ?? customerId,
    qualifiedNow,
    opportunityId: primaryLinkedOpportunityIdForLead(working, readOpportunities()),
  }
}
