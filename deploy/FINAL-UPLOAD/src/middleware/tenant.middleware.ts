import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { AuthenticationError, AuthorizationError, TenantMismatchError } from '../utils/errors.js'

export const TENANT_HEADER = 'x-tenant-id'

async function resolveTenantFromRoute(params: Request['params']): Promise<{ id: string; slug: string } | null> {
  const tenantId = typeof params.tenantId === 'string' ? params.tenantId : undefined
  const tenantSlug = typeof params.tenantSlug === 'string' ? params.tenantSlug : undefined

  if (tenantId) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    })
    return tenant ? { id: tenant.id, slug: tenant.slug } : null
  }
  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, deletedAt: null },
    })
    return tenant ? { id: tenant.id, slug: tenant.slug } : null
  }
  return null
}

export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const routeTenant = await resolveTenantFromRoute(req.params)

    if (routeTenant) {
      req.tenantId = routeTenant.id

      if (req.context) {
        const headerTenant = req.headers[TENANT_HEADER] as string | undefined
        if (headerTenant && headerTenant !== routeTenant.id && !req.context.isSuperAdmin) {
          next(new TenantMismatchError())
          return
        }
        if (!req.context.isSuperAdmin && req.context.tenantId !== routeTenant.id) {
          next(new TenantMismatchError('Authenticated tenant does not match route tenant'))
          return
        }
        if (req.context.isSuperAdmin) {
          req.context = { ...req.context, tenantId: routeTenant.id }
        }
      }
      next()
      return
    }

    if (req.context?.tenantId) {
      req.tenantId = req.context.tenantId
      next()
      return
    }

    const headerTenant = req.headers[TENANT_HEADER] as string | undefined
    if (headerTenant && req.context?.isSuperAdmin) {
      req.tenantId = headerTenant
      req.context = { ...req.context, tenantId: headerTenant }
      next()
      return
    }

    next(new AuthenticationError('Tenant context required'))
  } catch (error) {
    next(error)
  }
}

export function requireTenantAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenantId) {
    next(new AuthorizationError('Tenant context missing'))
    return
  }
  next()
}
