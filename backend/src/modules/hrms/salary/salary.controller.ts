import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as assignmentService from './salary-assignment.service.js'
import * as componentService from './salary-component.service.js'
import * as effectiveService from './effective-salary.service.js'
import * as structureService from './salary-structure.service.js'
import type {
  CreateAssignmentInput,
  CreateComponentInput,
  CreateStructureInput,
  CreateVersionInput,
  ListAssignmentsQuery,
  ListComponentsQuery,
  ListStructuresQuery,
  PreviewSalaryInput,
  ReviseAssignmentInput,
  UpdateComponentInput,
  UpdateStructureInput,
  UpdateVersionInput,
} from './salary.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

// ─── Components ────────────────────────────────────────────────────────────

export const listComponents = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await componentService.listComponents(
    getTenantId(req),
    scope,
    req.query as unknown as ListComponentsQuery,
  )
  return sendPaginated(
    res,
    'Salary components listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getComponent = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await componentService.getComponent(
    getTenantId(req),
    getRouteParam(req, 'componentId'),
    scope,
  )
  return sendSuccess(res, 'Salary component fetched', item)
})

export const createComponent = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await componentService.createComponent(
    getTenantId(req),
    req.body as CreateComponentInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Salary component created', item)
})

export const updateComponent = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await componentService.updateComponent(
    getTenantId(req),
    getRouteParam(req, 'componentId'),
    req.body as UpdateComponentInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Salary component updated', item)
})

// ─── Structures ────────────────────────────────────────────────────────────

export const listStructures = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await structureService.listStructures(
    getTenantId(req),
    scope,
    req.query as unknown as ListStructuresQuery,
  )
  return sendPaginated(
    res,
    'Salary structures listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getStructure = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.getStructure(
    getTenantId(req),
    getRouteParam(req, 'structureId'),
    scope,
  )
  return sendSuccess(res, 'Salary structure fetched', item)
})

export const createStructure = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.createStructure(
    getTenantId(req),
    req.body as CreateStructureInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Salary structure created', item)
})

export const updateStructure = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.updateStructure(
    getTenantId(req),
    getRouteParam(req, 'structureId'),
    req.body as UpdateStructureInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Salary structure updated', item)
})

// ─── Versions ────────────────────────────────────────────────────────────────

export const createVersion = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.createVersion(
    getTenantId(req),
    getRouteParam(req, 'structureId'),
    req.body as CreateVersionInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Salary structure version created', item)
})

export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.getVersion(
    getTenantId(req),
    getRouteParam(req, 'versionId'),
    scope,
  )
  return sendSuccess(res, 'Salary structure version fetched', item)
})

export const updateVersion = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.updateVersion(
    getTenantId(req),
    getRouteParam(req, 'versionId'),
    req.body as UpdateVersionInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Salary structure version updated', item)
})

export const activateVersion = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await structureService.activateVersion(
    getTenantId(req),
    getRouteParam(req, 'versionId'),
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Salary structure version activated', item)
})

// ─── Assignments ─────────────────────────────────────────────────────────────

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await assignmentService.listAssignments(
    getTenantId(req),
    scope,
    req.query as unknown as ListAssignmentsQuery,
  )
  return sendPaginated(
    res,
    'Salary assignments listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await assignmentService.createAssignment(
    getTenantId(req),
    req.body as CreateAssignmentInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Salary assignment created', item)
})

export const reviseAssignment = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await assignmentService.reviseAssignment(
    getTenantId(req),
    getRouteParam(req, 'assignmentId'),
    req.body as ReviseAssignmentInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Salary assignment revised', item)
})

// ─── Effective & preview ─────────────────────────────────────────────────────

export const getEmployeeEffective = asyncHandler(async (req: Request, res: Response) => {
  const date =
    typeof req.query.date === 'string' && req.query.date
      ? req.query.date
      : new Date().toISOString().slice(0, 10)
  const item = await effectiveService.getEffectiveSalaryStructure(
    getTenantId(req),
    getRouteParam(req, 'employeeId'),
    date,
  )
  return sendSuccess(res, 'Effective salary structure', item)
})

export const previewSalary = asyncHandler(async (req: Request, res: Response) => {
  const item = await effectiveService.previewSalary(
    getTenantId(req),
    req.body as PreviewSalaryInput,
  )
  return sendSuccess(res, 'Salary preview', item)
})
