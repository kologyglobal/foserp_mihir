import type { Prisma, Tenant, TenantStatus } from '@prisma/client'
import { prisma } from '../../config/database.js'
import type { PaginationInput } from '../../utils/pagination.js'
import { getPagination } from '../../utils/pagination.js'
import type { CreateTenantInput, UpdateTenantInput } from './tenant.validation.js'

export type TenantRecord = Tenant

export async function findTenants(
  query: PaginationInput & { status?: TenantStatus },
): Promise<{ items: TenantRecord[]; total: number }> {
  const { skip, take } = getPagination(query)

  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { slug: { contains: query.search } },
            { email: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.tenant.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
    }),
    prisma.tenant.count({ where }),
  ])

  return { items, total }
}

export async function findTenantById(tenantId: string): Promise<TenantRecord | null> {
  return prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
  })
}

export async function findTenantBySlug(slug: string): Promise<TenantRecord | null> {
  return prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
  })
}

export async function createTenantWithAdmin(
  input: CreateTenantInput,
  rolePermissionIds: string[],
  passwordHash: string,
): Promise<{ tenant: TenantRecord; adminUserId: string }> {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        legalName: input.legalName,
        email: input.email,
        phone: input.phone,
        country: input.country,
        state: input.state,
        city: input.city,
        timezone: input.timezone,
        currency: input.currency,
        status: input.status,
        subscriptionPlan: input.subscriptionPlan,
        subscriptionStatus: input.subscriptionStatus,
        trialEndsAt: input.trialEndsAt,
      },
    })

    const adminRole = await tx.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Tenant Admin',
        description: 'Tenant administrator with full tenant-scoped access',
        isSystem: true,
        rolePermissions: {
          create: rolePermissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    })

    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        firstName: input.adminUser.firstName,
        lastName: input.adminUser.lastName,
        email: input.adminUser.email,
        mobile: input.adminUser.mobile,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        userRoles: {
          create: {
            roleId: adminRole.id,
            tenantId: tenant.id,
          },
        },
      },
    })

    return { tenant, adminUserId: adminUser.id }
  })
}

export async function updateTenant(tenantId: string, input: UpdateTenantInput): Promise<TenantRecord> {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: input,
  })
}

export async function softDeleteTenant(tenantId: string): Promise<TenantRecord> {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  })
}
