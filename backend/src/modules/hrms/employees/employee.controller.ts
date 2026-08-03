import type { Request, Response } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { auditFromRequest } from '../../../services/audit.service.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { permissionSetIncludes } from '../../../constants/permissions.js'
import { loadHrScope } from '../hrms-scope.js'
import * as service from './employee.service.js'
import * as bankService from './employee-bank.service.js'
import * as statutoryService from './employee-statutory.service.js'
import type {
  CreateBankDetailInput,
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateBankDetailInput,
  UpdateEmployeeInput,
  UpsertStatutoryDetailInput,
} from './employee.schemas.js'

function hasSensitiveAccess(req: Request): boolean {
  return permissionSetIncludes(req.context?.permissions ?? [], 'hrms.employee.sensitive.view')
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const result = await service.listEmployees(tenantId, scope, req.query as unknown as ListEmployeesQuery)
  return sendPaginated(res, 'Employees listed', result.items, result.meta)
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await service.getEmployee(tenantId, scope, getRouteParam(req, 'employeeId'))
  return sendSuccess(res, 'Employee fetched', item)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await service.createEmployee(tenantId, scope, req.body as CreateEmployeeInput, auditFromRequest(req))
  return sendCreated(res, 'Employee created', item)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await service.updateEmployee(
    tenantId,
    scope,
    getRouteParam(req, 'employeeId'),
    req.body as UpdateEmployeeInput,
    auditFromRequest(req),
  )
  return sendSuccess(res, 'Employee updated', item)
})

export const history = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const items = await service.getEmployeeHistory(tenantId, scope, getRouteParam(req, 'employeeId'))
  return sendSuccess(res, 'Employment history fetched', items)
})

export const listBank = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const items = await bankService.listBankDetails(
    tenantId,
    scope,
    getRouteParam(req, 'employeeId'),
    hasSensitiveAccess(req),
  )
  return sendSuccess(res, 'Bank details fetched', items)
})

export const createBank = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await bankService.createBankDetail(
    tenantId,
    scope,
    getRouteParam(req, 'employeeId'),
    req.body as CreateBankDetailInput,
    auditFromRequest(req),
  )
  return sendCreated(res, 'Bank detail added', item)
})

export const updateBank = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await bankService.updateBankDetail(
    tenantId,
    scope,
    getRouteParam(req, 'employeeId'),
    getRouteParam(req, 'bankId'),
    req.body as UpdateBankDetailInput,
    auditFromRequest(req),
  )
  return sendSuccess(res, 'Bank detail updated', item)
})

export const getStatutory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await statutoryService.getStatutoryDetail(
    tenantId,
    scope,
    getRouteParam(req, 'employeeId'),
    hasSensitiveAccess(req),
  )
  return sendSuccess(res, 'Statutory detail fetched', item)
})

export const putStatutory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await statutoryService.upsertStatutoryDetail(
    tenantId,
    scope,
    getRouteParam(req, 'employeeId'),
    req.body as UpsertStatutoryDetailInput,
    auditFromRequest(req),
  )
  return sendSuccess(res, 'Statutory detail saved', item)
})
