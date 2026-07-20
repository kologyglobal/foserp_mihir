import type { NextFunction, Request, Response } from 'express'
import { permissionSetIncludes } from '../constants/permissions.js'
import { prisma } from '../config/database.js'
import { createAuditLog } from '../services/audit.service.js'
import { AuthenticationError, AuthorizationError } from '../utils/errors.js'

export async function attachRequestContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.context) {
      next()
      return
    }
    const user = await prisma.user.findFirst({
      where: { id: req.context.userId, tenantId: req.context.tenantId, deletedAt: null, status: 'ACTIVE' },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    })

    if (!user) {
      next(new AuthenticationError('User not found or inactive'))
      return
    }

    const roles = user.userRoles.map((ur) => ur.role.name)
    const permissions = [
      ...new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name))),
    ]

    req.context = {
      ...req.context,
      roles,
      permissions,
      isSuperAdmin: permissions.includes('tenant.manage'),
    }
    next()
  } catch (error) {
    next(error)
  }
}

function auditPermissionDenied(req: Request, required: string[]): void {
  const ctx = req.context
  void createAuditLog({
    tenantId: ctx?.tenantId ?? null,
    userId: ctx?.userId ?? null,
    module: 'rbac',
    entity: 'Permission',
    entityId: null,
    action: 'PERMISSION_DENIED',
    newValues: {
      required,
      path: req.originalUrl ?? req.url,
      method: req.method,
      roles: ctx?.roles ?? [],
    },
    ipAddress: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  }).catch(() => {
    // Never block the 403 response on audit failure
  })
}

export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      next(new AuthenticationError())
      return
    }
    const granted = req.context.permissions
    const hasAll = required.every((p) => permissionSetIncludes(granted, p))
    if (!hasAll) {
      auditPermissionDenied(req, required)
      next(new AuthorizationError(`Missing permission: ${required.join(', ')}`))
      return
    }
    next()
  }
}

/** Pass if the user has any one of the listed permissions (or tenant.manage). */
export function requireAnyPermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      next(new AuthenticationError())
      return
    }
    const granted = req.context.permissions
    const hasAny = required.some((p) => permissionSetIncludes(granted, p))
    if (!hasAny) {
      auditPermissionDenied(req, required)
      next(new AuthorizationError(`Missing permission: one of ${required.join(', ')}`))
      return
    }
    next()
  }
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.context?.isSuperAdmin) {
    auditPermissionDenied(req, ['tenant.manage'])
    next(new AuthorizationError('Super Admin access required'))
    return
  }
  next()
}
