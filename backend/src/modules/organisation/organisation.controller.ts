import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as service from './organisation.service.js'
import type {
  CreateOrgAccountInput,
  CreateOrgFiscalYearInput,
  CreateOrgLegalEntityInput,
  CreateRegistrationInput,
  ListOrgLegalEntitiesQuery,
  ListOrgPeriodsQuery,
  ListRegistrationsQuery,
  UpdateOrgLegalEntityInput,
  UpdateRegistrationInput,
  UpsertOrgMappingsInput,
} from './organisation.validation.js'

// re-export type used in controller — generate schema type
type GeneratePeriodsBody = { financialYearId: string }

export const listLegalEntities = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listLegalEntities(req, tenantId, req.query as unknown as ListOrgLegalEntitiesQuery)
  return sendPaginated(
    res,
    'Legal entities listed',
    result.items,
    buildPaginationMeta(result.total, result.page ?? 1, result.limit ?? 20),
  )
})

export const getLegalEntity = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.getLegalEntity(getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Legal entity fetched', item)
})

export const createLegalEntity = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.createLegalEntity(req, getTenantId(req), req.body as CreateOrgLegalEntityInput)
  return sendCreated(res, 'Legal entity created', item)
})

export const updateLegalEntity = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.updateLegalEntity(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as UpdateOrgLegalEntityInput,
  )
  return sendSuccess(res, 'Legal entity updated', item)
})

export const listRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listRegistrations(getTenantId(req), req.query as unknown as ListRegistrationsQuery)
  return sendPaginated(
    res,
    'Registrations listed',
    result.items,
    buildPaginationMeta(result.total, result.page ?? 1, result.limit ?? 20),
  )
})

export const createRegistration = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.createRegistration(req, getTenantId(req), req.body as CreateRegistrationInput)
  return sendCreated(res, 'Registration created', item)
})

export const updateRegistration = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.updateRegistration(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as UpdateRegistrationInput,
  )
  return sendSuccess(res, 'Registration updated', item)
})

export const listChartOfAccounts = asyncHandler(async (req: Request, res: Response) => {
  const legalEntityId = String(req.query.legalEntityId ?? '')
  const result = await service.listChartOfAccounts(req, getTenantId(req), legalEntityId)
  return sendPaginated(
    res,
    'Chart of accounts listed',
    result.items,
    buildPaginationMeta(result.total, result.page ?? 1, result.limit ?? 500),
  )
})

export const createChartAccount = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.createChartAccount(req, getTenantId(req), req.body as CreateOrgAccountInput)
  return sendCreated(res, 'Account created', item)
})

export const listAccountMappings = asyncHandler(async (req: Request, res: Response) => {
  const legalEntityId = String(req.query.legalEntityId ?? '')
  const items = await service.listAccountMappings(req, getTenantId(req), legalEntityId)
  return sendSuccess(res, 'Account mappings listed', items)
})

export const upsertAccountMappings = asyncHandler(async (req: Request, res: Response) => {
  const items = await service.upsertAccountMappings(req, getTenantId(req), req.body as UpsertOrgMappingsInput)
  return sendSuccess(res, 'Account mappings saved', items)
})

export const listFiscalYears = asyncHandler(async (req: Request, res: Response) => {
  const legalEntityId = String(req.query.legalEntityId ?? '')
  const result = await service.listFiscalYears(req, getTenantId(req), legalEntityId)
  return sendPaginated(
    res,
    'Fiscal years listed',
    result.items,
    buildPaginationMeta(result.total, result.page ?? 1, result.limit ?? 100),
  )
})

export const createFiscalYear = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.createFiscalYear(req, getTenantId(req), req.body as CreateOrgFiscalYearInput)
  return sendCreated(res, 'Fiscal year created', item)
})

export const listPostingPeriods = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPostingPeriods(req, getTenantId(req), req.query as unknown as ListOrgPeriodsQuery)
  return sendPaginated(
    res,
    'Posting periods listed',
    result.items,
    buildPaginationMeta(result.total, result.page ?? 1, result.limit ?? 100),
  )
})

export const generatePostingPeriods = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as GeneratePeriodsBody
  const items = await service.generatePostingPeriods(req, getTenantId(req), body.financialYearId)
  return sendSuccess(res, 'Posting periods generated', items)
})
