import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
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

export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      next(new AuthenticationError())
      return
    }
    const hasAll = required.every(
      (p) => req.context!.permissions.includes(p) || req.context!.permissions.includes('tenant.manage'),
    )
    if (!hasAll) {
      next(new AuthorizationError(`Missing permission: ${required.join(', ')}`))
      return
    }
    next()
  }
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.context?.isSuperAdmin) {
    next(new AuthorizationError('Super Admin access required'))
    return
  }
  next()
}
