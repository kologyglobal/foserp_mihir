import type { IndiaMartEnquiry, IndiaMartMatchStatus } from '@prisma/client'
import * as repo from './indiamart.repository.js'
import { normalizeCompanyName } from './indiamart.normalizer.js'

export type MatchResult = {
  matchStatus: IndiaMartMatchStatus
  matchedLeadId?: string | null
  matchedCompanyId?: string | null
  matchedContactId?: string | null
  reason: string
  confidence: number
}

export async function matchEnquiryAgainstCrm(
  tenantId: string,
  enquiry: Pick<
    IndiaMartEnquiry,
    | 'externalEnquiryId'
    | 'normalizedMobile'
    | 'normalizedEmail'
    | 'normalizedCompanyName'
    | 'buyerName'
    | 'productName'
    | 'dedupeFingerprint'
  >,
): Promise<MatchResult> {
  // 1. Same external source ID on existing lead
  const byExternal = await repo.findLeadByExternalSource(tenantId, 'INDIAMART', enquiry.externalEnquiryId)
  if (byExternal) {
    return {
      matchStatus: 'EXACT_DUPLICATE',
      matchedLeadId: byExternal.id,
      reason: 'external_source_id',
      confidence: 100,
    }
  }

  // 2. Exact normalized mobile
  if (enquiry.normalizedMobile) {
    const byMobile = await repo.findLeadByMobile(tenantId, enquiry.normalizedMobile)
    if (byMobile) {
      return {
        matchStatus: 'EXISTING_LEAD',
        matchedLeadId: byMobile.id,
        reason: 'exact_mobile',
        confidence: 95,
      }
    }
  }

  // 3. Exact normalized email
  if (enquiry.normalizedEmail) {
    const byEmail = await repo.findLeadByEmail(tenantId, enquiry.normalizedEmail)
    if (byEmail) {
      return {
        matchStatus: 'EXISTING_LEAD',
        matchedLeadId: byEmail.id,
        reason: 'exact_email',
        confidence: 92,
      }
    }
  }

  // 4. Contact match
  const contact = await repo.findContactByMobileOrEmail(
    tenantId,
    enquiry.normalizedMobile,
    enquiry.normalizedEmail,
  )
  if (contact) {
    return {
      matchStatus: 'EXISTING_CONTACT',
      matchedContactId: contact.id,
      matchedCompanyId: contact.companyId,
      reason: 'existing_contact',
      confidence: 85,
    }
  }

  // 5. Company + person name (possible duplicate)
  if (enquiry.normalizedCompanyName && enquiry.buyerName) {
    const company = await repo.findCompanyByNormalizedName(tenantId, enquiry.normalizedCompanyName)
    if (company) {
      const companyNorm = normalizeCompanyName(company.name)
      if (companyNorm === enquiry.normalizedCompanyName) {
        return {
          matchStatus: 'EXISTING_COMPANY',
          matchedCompanyId: company.id,
          reason: 'exact_company',
          confidence: 75,
        }
      }
      return {
        matchStatus: 'POSSIBLE_DUPLICATE',
        matchedCompanyId: company.id,
        reason: 'fuzzy_company',
        confidence: 55,
      }
    }
  }

  return {
    matchStatus: 'NO_MATCH',
    reason: 'no_match',
    confidence: 0,
  }
}
