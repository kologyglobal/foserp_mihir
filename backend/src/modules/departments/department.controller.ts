import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as departmentService from './department.service.js'
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from './department.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await departmentService.listDepartments(
    getTenantId(req),
    req.query as unknown as ListDepartmentsQuery,
  )
  sendPaginated(res, 'Departments retrieved', result.items, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const row = await departmentService.getDepartment(
    getTenantId(req),
    getRouteParam(req, 'departmentId'),
  )
  sendSuccess(res, 'Department retrieved', row)
}

export async function create(req: Request, res: Response): Promise<void> {
  const row = await departmentService.createDepartment(
    getTenantId(req),
    req.body as CreateDepartmentInput,
    auditMeta(req),
  )
  sendCreated(res, 'Department created', row)
}

export async function update(req: Request, res: Response): Promise<void> {
  const row = await departmentService.updateDepartment(
    getTenantId(req),
    getRouteParam(req, 'departmentId'),
    req.body as UpdateDepartmentInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Department updated', row)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const row = await departmentService.deleteDepartment(
    getTenantId(req),
    getRouteParam(req, 'departmentId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Department deleted', row)
}
