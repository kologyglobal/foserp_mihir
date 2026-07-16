import type { Request } from 'express'

export interface RequestContext {
  userId: string
  tenantId: string
  roles: string[]
  permissions: string[]
  isSuperAdmin: boolean
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext
      tenantId?: string
    }
  }
}

export function getContext(req: Request): RequestContext {
  if (!req.context) {
    throw new Error('Request context not initialized')
  }
  return req.context
}

export function getTenantId(req: Request): string {
  const tenantId = req.tenantId ?? req.context?.tenantId
  if (!tenantId) {
    throw new Error('Tenant context not initialized')
  }
  return tenantId
}

export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name]
  if (typeof value !== 'string') {
    throw new Error(`Missing route param: ${name}`)
  }
  return value
}
