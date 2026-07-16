import { prisma } from '../../config/database.js'
import { ValidationError } from '../../utils/errors.js'
import { tenantActiveFilter } from '../../shared/index.js'

export async function assertUserInTenant(tenantId: string, userId: string, label = 'User'): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  if (!user) throw new ValidationError(`${label} not found in tenant`)
}

export async function assertCompanyInTenant(tenantId: string, companyId: string): Promise<void> {
  const row = await prisma.crmCompany.findFirst({
    where: { id: companyId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  if (!row) throw new ValidationError('Company not found in tenant')
}

export async function assertContactInTenant(tenantId: string, contactId: string): Promise<void> {
  const row = await prisma.crmContact.findFirst({
    where: { id: contactId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  if (!row) throw new ValidationError('Contact not found in tenant')
}

export async function assertLeadInTenant(tenantId: string, leadId: string): Promise<void> {
  const row = await prisma.crmLead.findFirst({
    where: { id: leadId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  if (!row) throw new ValidationError('Lead not found in tenant')
}

export async function assertOpportunityInTenant(tenantId: string, opportunityId: string): Promise<void> {
  const row = await prisma.crmOpportunity.findFirst({
    where: { id: opportunityId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  if (!row) throw new ValidationError('Opportunity not found in tenant')
}
