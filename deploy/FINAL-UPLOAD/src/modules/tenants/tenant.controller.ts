import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam } from '../../types/request-context.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as tenantService from './tenant.service.js'
import type { CreateTenantInput, ListTenantsQuery, UpdateTenantInput } from './tenant.validation.js'

export async function list(req: Request, res: Response): Promise<void> {
  const result = await tenantService.listTenants(req.query as unknown as ListTenantsQuery)
  sendPaginated(res, 'Tenants retrieved', result.items, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const tenant = await tenantService.getTenantById(getRouteParam(req, 'tenantId'))
  sendSuccess(res, 'Tenant retrieved', tenant)
}

export async function create(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  const audit = { ...auditFromRequest(req), userId: ctx.userId }
  const result = await tenantService.createTenant(req.body as CreateTenantInput, audit)
  sendCreated(res, 'Tenant created', result)
}

export async function update(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  const audit = { ...auditFromRequest(req), userId: ctx.userId }
  const tenant = await tenantService.updateTenant(
    getRouteParam(req, 'tenantId'),
    req.body as UpdateTenantInput,
    audit,
  )
  sendSuccess(res, 'Tenant updated', tenant)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  const audit = { ...auditFromRequest(req), userId: ctx.userId }
  const tenant = await tenantService.deleteTenant(getRouteParam(req, 'tenantId'), audit)
  sendSuccess(res, 'Tenant deleted', tenant)
}
