import type { CrmEntityType } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { NotFoundError } from '../../utils/errors.js'
import { tenantActiveFilter } from '../../shared/index.js'

export async function assertCrmEntityInTenant(tenantId: string, entityType: CrmEntityType, entityId: string) {
  switch (entityType) {
    case 'COMPANY': {
      const row = await prisma.crmCompany.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Company not found')
      return row
    }
    case 'CONTACT': {
      const row = await prisma.crmContact.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Contact not found')
      return row
    }
    case 'LEAD': {
      const row = await prisma.crmLead.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Lead not found')
      return row
    }
    case 'OPPORTUNITY': {
      const row = await prisma.crmOpportunity.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Opportunity not found')
      return row
    }
    case 'ACTIVITY': {
      const row = await prisma.crmActivity.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Activity not found')
      return row
    }
    case 'FOLLOW_UP': {
      const row = await prisma.crmFollowUp.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Follow-up not found')
      return row
    }
    case 'QUOTATION': {
      const row = await prisma.crmQuotation.findFirst({ where: { id: entityId, ...tenantActiveFilter(tenantId) } })
      if (!row) throw new NotFoundError('Quotation not found')
      return row
    }
    default:
      throw new NotFoundError('Unknown entity type')
  }
}
