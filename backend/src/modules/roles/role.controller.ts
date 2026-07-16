import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendCreated, sendSuccess } from '../../utils/response.js'
import * as roleService from './role.service.js'
import type { CreateRoleInput, UpdateRoleInput } from './role.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function list(req: Request, res: Response): Promise<void> {
  const roles = await roleService.listRolesForTenant(getTenantId(req))
  sendSuccess(res, 'Roles retrieved', roles)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const role = await roleService.getRoleById(getTenantId(req), getRouteParam(req, 'roleId'))
  sendSuccess(res, 'Role retrieved', role)
}

export async function listPermissions(_req: Request, res: Response): Promise<void> {
  const permissions = await roleService.listPermissionCatalog()
  sendSuccess(res, 'Permissions retrieved', permissions)
}

export async function create(req: Request, res: Response): Promise<void> {
  const role = await roleService.createRole(getTenantId(req), req.body as CreateRoleInput, auditMeta(req))
  sendCreated(res, 'Role created', role)
}

export async function update(req: Request, res: Response): Promise<void> {
  const role = await roleService.updateRole(
    getTenantId(req),
    getRouteParam(req, 'roleId'),
    req.body as UpdateRoleInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Role updated', role)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const role = await roleService.deleteRole(getTenantId(req), getRouteParam(req, 'roleId'), auditMeta(req))
  sendSuccess(res, 'Role deleted', role)
}
