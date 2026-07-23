import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as invitationService from './user-invitation.service.js'
import * as userService from './user.service.js'
import type {
  AssignRoleInput,
  CreateUserInput,
  InviteUserInput,
  ListInvitationsQuery,
  ListUsersQuery,
  UpdateUserInput,
} from './user.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await userService.listUsers(getTenantId(req), req.query as unknown as ListUsersQuery)
  sendPaginated(res, 'Users retrieved', result.items, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await userService.getUserById(getTenantId(req), getRouteParam(req, 'userId'))
  sendSuccess(res, 'User retrieved', user)
}

export async function create(req: Request, res: Response): Promise<void> {
  const user = await userService.createUser(
    getTenantId(req),
    req.body as CreateUserInput,
    auditMeta(req),
  )
  sendCreated(res, 'User created', user)
}

export async function invite(req: Request, res: Response): Promise<void> {
  const result = await invitationService.inviteUser(
    getTenantId(req),
    req.body as InviteUserInput,
    auditMeta(req),
  )
  sendCreated(res, 'Invitation created', result)
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  const result = await invitationService.listInvitations(
    getTenantId(req),
    req.query as unknown as ListInvitationsQuery,
  )
  sendPaginated(res, 'Invitations retrieved', result.items, result.meta)
}

export async function resendInvitation(req: Request, res: Response): Promise<void> {
  const result = await invitationService.resendInvitation(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Invitation resent', result)
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const result = await invitationService.deactivateUser(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    auditMeta(req),
  )
  sendSuccess(res, 'User deactivated', result)
}

export async function activate(req: Request, res: Response): Promise<void> {
  const user = await invitationService.activateUser(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    auditMeta(req),
  )
  sendSuccess(res, 'User activated', user)
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await invitationService.listUserSessions(
    getTenantId(req),
    getRouteParam(req, 'userId'),
  )
  sendSuccess(res, 'Sessions retrieved', sessions)
}

export async function revokeSessions(req: Request, res: Response): Promise<void> {
  const result = await invitationService.revokeUserSessionsAdmin(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Sessions revoked', result)
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await userService.updateUser(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    req.body as UpdateUserInput,
    auditMeta(req),
  )
  sendSuccess(res, 'User updated', user)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const user = await userService.deleteUser(getTenantId(req), getRouteParam(req, 'userId'), auditMeta(req))
  sendSuccess(res, 'User deleted', user)
}

export async function assignRole(req: Request, res: Response): Promise<void> {
  const user = await userService.assignRole(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    req.body as AssignRoleInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Role assigned', user)
}

export async function removeRole(req: Request, res: Response): Promise<void> {
  const user = await userService.removeRole(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    getRouteParam(req, 'roleId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Role removed', user)
}
