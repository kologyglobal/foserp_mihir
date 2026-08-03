import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as profileService from './employee-statutory.service.js'
import * as registerService from './statutory-register.service.js'
import * as ruleService from './statutory-rule.service.js'
import type {
  CreateRuleInput,
  ListRulesQuery,
  PutPtSlabsInput,
  PutWageBasisInput,
  RegisterQuery,
  ResolveRuleQuery,
  UpdateEmployeeStatutoryProfileInput,
  UpdateRuleInput,
} from './statutory.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export const listRules = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await ruleService.listRules(getTenantId(req), scope, req.query as unknown as ListRulesQuery)
  return sendPaginated(res, 'Statutory rules listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createRule = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await ruleService.createRule(getTenantId(req), req.body as CreateRuleInput, scope, auditMeta(req))
  return sendCreated(res, 'Statutory rule created', item)
})

export const getRule = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await ruleService.getRule(getTenantId(req), getRouteParam(req, 'ruleId'), scope)
  return sendSuccess(res, 'Statutory rule fetched', item)
})

export const updateRule = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await ruleService.updateRule(
    getTenantId(req),
    getRouteParam(req, 'ruleId'),
    req.body as UpdateRuleInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Statutory rule updated', item)
})

export const activateRule = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await ruleService.activateRule(getTenantId(req), getRouteParam(req, 'ruleId'), scope, auditMeta(req))
  return sendSuccess(res, 'Statutory rule activated', item)
})

export const putWageBasis = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await ruleService.putWageBasis(
    getTenantId(req),
    getRouteParam(req, 'ruleId'),
    req.body as PutWageBasisInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Wage-basis lines saved', item)
})

export const putPtSlabs = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await ruleService.putPtSlabs(
    getTenantId(req),
    getRouteParam(req, 'ruleId'),
    req.body as PutPtSlabsInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'PT slabs saved', item)
})

// ─── Employee profile ────────────────────────────────────────────────────────

export const getEmployeeProfile = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await profileService.getEmployeeStatutoryProfile(getTenantId(req), scope, getRouteParam(req, 'employeeId'))
  return sendSuccess(res, 'Employee statutory profile fetched', item)
})

export const updateEmployeeProfile = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await profileService.updateEmployeeStatutoryProfile(
    getTenantId(req),
    scope,
    getRouteParam(req, 'employeeId'),
    req.body as UpdateEmployeeStatutoryProfileInput,
    auditMeta(req),
  )
  return sendSuccess(res, 'Employee statutory profile updated', item)
})

// ─── Resolve helper ──────────────────────────────────────────────────────────

export const resolveRule = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const query = req.query as unknown as ResolveRuleQuery
  const date = query.date ? new Date(query.date) : new Date()
  const item = await ruleService.resolveRuleForEmployee(getTenantId(req), scope, query.type, query.employeeId, date)
  return sendSuccess(res, 'Effective statutory rule resolved', item)
})

// ─── Registers ───────────────────────────────────────────────────────────────

export const getRegister = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const kind = getRouteParam(req, 'kind') as registerService.RegisterKind
  const result = await registerService.getRegister(getTenantId(req), kind, scope, req.query as unknown as RegisterQuery)
  return sendPaginated(res, `${kind.toUpperCase()} register listed`, result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const exportRegisterCsv = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const kind = getRouteParam(req, 'kind') as registerService.RegisterKind
  const csv = await registerService.getRegisterCsv(getTenantId(req), kind, scope, req.query as unknown as RegisterQuery)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${kind}-register.csv"`)
  res.send(csv)
})
