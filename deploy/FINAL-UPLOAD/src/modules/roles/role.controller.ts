import type { Request, Response } from 'express'
import { getTenantId } from '../../types/request-context.js'
import { sendSuccess } from '../../utils/response.js'
import * as roleService from './role.service.js'

export async function list(req: Request, res: Response): Promise<void> {
  const roles = await roleService.listRolesForTenant(getTenantId(req))
  sendSuccess(res, 'Roles retrieved', roles)
}
