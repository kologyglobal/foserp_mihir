import type { Request, Response } from 'express'
import { auditFromRequest, listAuditLogs } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendPaginated, sendSuccess } from '../../utils/response.js'
import { ADMIN_AUDIT_MODULES, MAX_FAILED_LOGINS, PASSWORD_MIN_LENGTH } from './security.constants.js'
import * as securityService from './security.service.js'
import type { ListAuditLogsQuery, ListLoginActivityQuery, ListSessionsQuery } from './security.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function listLoginActivity(req: Request, res: Response): Promise<void> {
  const result = await securityService.listLoginActivity(
    getTenantId(req),
    req.query as unknown as ListLoginActivityQuery,
  )
  sendSuccess(res, 'Login activity retrieved', result)
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const result = await securityService.listActiveSessions(
    getTenantId(req),
    req.query as unknown as ListSessionsQuery,
  )
  sendPaginated(res, 'Active sessions retrieved', result.items, result.meta)
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const result = await securityService.revokeSession(
    getTenantId(req),
    getRouteParam(req, 'sessionId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Session revoked', result)
}

export async function listLockedAccounts(req: Request, res: Response): Promise<void> {
  const result = await securityService.listLockedAccounts(getTenantId(req))
  sendSuccess(res, 'Locked accounts retrieved', result)
}

export async function lockUser(req: Request, res: Response): Promise<void> {
  const result = await securityService.lockUser(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    auditMeta(req),
  )
  sendSuccess(res, 'User locked', result)
}

export async function unlockUser(req: Request, res: Response): Promise<void> {
  const user = await securityService.unlockUser(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    auditMeta(req),
  )
  sendSuccess(res, 'User unlocked', user)
}

export async function getPolicy(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, 'Security policy retrieved', {
    maxFailedLogins: MAX_FAILED_LOGINS,
    passwordMinLength: PASSWORD_MIN_LENGTH,
    mfa: 'not_configured' as const,
    adminAuditModules: [...ADMIN_AUDIT_MODULES],
  })
}

export async function listAudit(req: Request, res: Response): Promise<void> {
  const result = await listAuditLogs(getTenantId(req), req.query as unknown as ListAuditLogsQuery)
  sendPaginated(res, 'Audit logs retrieved', result.items, result.meta)
}
