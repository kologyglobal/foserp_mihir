/**
 * Duplicate detection before save — mobile + email + company + GSTIN.
 */

import type { BusinessCardFields } from './types'
import type { CrmCompany, CrmContact, CrmLead } from '@/types/crm'

export interface DuplicateMatch {
  kind: 'company' | 'contact' | 'lead'
  id: string
  label: string
  reason: string
  score: number
}

function normPhone(p?: string | null): string {
  return (p || '').replace(/\D/g, '').slice(-10)
}

function normEmail(e?: string | null): string {
  return (e || '').trim().toLowerCase()
}

function normGst(g?: string | null): string {
  return (g || '').trim().toUpperCase()
}

function normName(n?: string | null): string {
  return (n || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findBusinessCardDuplicates(input: {
  fields: BusinessCardFields
  companies?: CrmCompany[]
  contacts?: CrmContact[]
  leads?: CrmLead[]
}): DuplicateMatch[] {
  const f = input.fields
  const matches: DuplicateMatch[] = []
  const phone = normPhone(f.mobile) || normPhone(f.alternateMobile)
  const email = normEmail(f.email)
  const gst = normGst(f.gstin)
  const company = normName(f.company)

  for (const c of input.companies ?? []) {
    let score = 0
    const reasons: string[] = []
    if (gst && normGst(c.gstin) && gst === normGst(c.gstin)) {
      score += 50
      reasons.push('GSTIN')
    }
    if (company && normName(c.name || c.customerName) === company) {
      score += 35
      reasons.push('Company name')
    } else if (
      company &&
      company.length >= 4 &&
      normName(c.name || c.customerName).includes(company)
    ) {
      score += 20
      reasons.push('Similar company')
    }
    if (phone && (normPhone(c.phone) === phone || normPhone(c.contactPhone) === phone)) {
      score += 30
      reasons.push('Mobile')
    }
    if (email && normEmail(c.email) === email) {
      score += 25
      reasons.push('Email')
    }
    if (score >= 30) {
      matches.push({
        kind: 'company',
        id: c.id,
        label: c.customerName || c.name || c.companyCode || c.id,
        reason: reasons.join(' · '),
        score,
      })
    }
  }

  for (const ct of input.contacts ?? []) {
    let score = 0
    const reasons: string[] = []
    if (phone && (normPhone(ct.mobile) === phone || normPhone(ct.phone) === phone)) {
      score += 40
      reasons.push('Mobile')
    }
    if (email && normEmail(ct.email) === email) {
      score += 35
      reasons.push('Email')
    }
    if (score >= 35) {
      matches.push({
        kind: 'contact',
        id: ct.id,
        label:
          ct.fullName ||
          [ct.firstName, ct.lastName].filter(Boolean).join(' ') ||
          ct.contactCode ||
          ct.id,
        reason: reasons.join(' · '),
        score,
      })
    }
  }

  for (const l of input.leads ?? []) {
    let score = 0
    const reasons: string[] = []
    if (phone && normPhone(l.mobile) === phone) {
      score += 40
      reasons.push('Mobile')
    }
    if (email && normEmail(l.email) === email) {
      score += 35
      reasons.push('Email')
    }
    if (company && normName(l.companyName) === company) {
      score += 15
      reasons.push('Company')
    }
    if (score >= 35) {
      matches.push({
        kind: 'lead',
        id: l.id,
        label: l.prospectName || l.leadCode || l.id,
        reason: reasons.join(' · '),
        score,
      })
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 8)
}
