import { prisma } from '../../config/database.js'
import { TENANT_ADMIN_PERMISSIONS } from '../../constants/permissions.js'
import { createAuditLog } from '../../services/audit.service.js'
import { initTenantCodeSeries } from '../../services/codeSeries.service.js'
import { ConflictError, NotFoundError } from '../../utils/errors.js'
import { hashPassword } from '../../utils/password.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import * as tenantRepository from './tenant.repository.js'
import type { CreateTenantInput, ListTenantsQuery, UpdateTenantInput } from './tenant.validation.js'

export async function listTenants(query: ListTenantsQuery) {
  const { items, total } = await tenantRepository.findTenants(query)
  return {
    items,
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function getTenantById(tenantId: string) {
  const tenant = await tenantRepository.findTenantById(tenantId)
  if (!tenant) {
    throw new NotFoundError('Tenant not found')
  }
  return tenant
}

export async function createTenant(
  input: CreateTenantInput,
  audit?: { userId?: string; ipAddress?: string | null; userAgent?: string | null },
) {
  const existing = await tenantRepository.findTenantBySlug(input.slug)
  if (existing) {
    throw new ConflictError('Tenant slug already exists')
  }

  const permissions = await prisma.permission.findMany({
    where: { name: { in: [...TENANT_ADMIN_PERMISSIONS] } },
  })

  const passwordHash = await hashPassword(input.adminUser.password)

  const { tenant, adminUserId } = await tenantRepository.createTenantWithAdmin(
    input,
    permissions.map((p) => p.id),
    passwordHash,
  )

  await initTenantCodeSeries(tenant.id)

  await createAuditLog({
    tenantId: tenant.id,
    userId: audit?.userId ?? null,
    module: 'tenant',
    entity: 'Tenant',
    entityId: tenant.id,
    action: 'CREATE',
    newValues: { tenant, adminUserId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      email: true,
      mobile: true,
      status: true,
      createdAt: true,
    },
  })

  return { tenant, adminUser }
}

export async function updateTenant(
  tenantId: string,
  input: UpdateTenantInput,
  audit?: { userId?: string; ipAddress?: string | null; userAgent?: string | null },
) {
  const existing = await tenantRepository.findTenantById(tenantId)
  if (!existing) {
    throw new NotFoundError('Tenant not found')
  }

  const tenant = await tenantRepository.updateTenant(tenantId, input)

  await createAuditLog({
    tenantId: tenant.id,
    userId: audit?.userId ?? null,
    module: 'tenant',
    entity: 'Tenant',
    entityId: tenant.id,
    action: 'UPDATE',
    oldValues: existing,
    newValues: tenant,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return tenant
}

export async function deleteTenant(
  tenantId: string,
  audit?: { userId?: string; ipAddress?: string | null; userAgent?: string | null },
) {
  const existing = await tenantRepository.findTenantById(tenantId)
  if (!existing) {
    throw new NotFoundError('Tenant not found')
  }

  const tenant = await tenantRepository.softDeleteTenant(tenantId)

  await createAuditLog({
    tenantId: tenant.id,
    userId: audit?.userId ?? null,
    module: 'tenant',
    entity: 'Tenant',
    entityId: tenant.id,
    action: 'DELETE',
    oldValues: existing,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return tenant
}
