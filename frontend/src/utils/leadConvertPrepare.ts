import type { Lead } from '../types/sales'
import type { Customer } from '../types/master'
import { resolveStoreAction, type StoreActionResult } from '../store/storeAction'
import {
  resolveLeadConvertToOpportunityGate,
  resolveLeadCustomerIdForConvert,
} from './leadUtils'

type UpdateLeadFn = (
  id: string,
  patch: Partial<Pick<Lead, 'customerId' | 'prospectName'>>,
) => StoreActionResult | Promise<StoreActionResult>

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
  if (!gate.ok) return gate
  return { ok: true, customerId: customerId! }
}
