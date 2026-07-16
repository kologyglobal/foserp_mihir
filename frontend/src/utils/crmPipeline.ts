import type { Inquiry } from '../types/sales'

/** @deprecated Inquiries folded into opportunities — use open opportunities for a lead instead. */
export function resolveLeadInquiry(inquiries: Inquiry[], leadId: string | null | undefined): Inquiry | undefined {
  if (!leadId) return undefined
  return inquiries
    .filter((i) => i.leadId === leadId && i.status !== 'closed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}
