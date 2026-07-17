import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './journal.service.js'
import * as postingService from './journal-posting.service.js'

export const listJournals = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listJournals(req, tenantId, req.query as never)
  return sendPaginated(res, 'journals listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getJournal(req, tenantId, id)
  return sendSuccess(res, 'journal fetched', item)
})

export const createJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createJournal(req, tenantId, req.body)
  return sendCreated(res, 'journal draft created', item)
})

export const updateJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateJournal(req, tenantId, id, req.body)
  return sendSuccess(res, 'journal draft updated', item)
})

export const validateJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const report = await service.validateJournalRecord(req, tenantId, id)
  return sendSuccess(res, 'journal validated', report)
})

export const submitJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.submitJournalRecord(req, tenantId, id)
  return sendSuccess(res, 'journal submitted', item)
})

export const cancelJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelJournalRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'journal cancelled', item)
})

export const getJournalAudit = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await service.getJournalAudit(req, tenantId, id)
  return sendSuccess(res, 'journal audit fetched', items)
})

export const postJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const posting = await postingService.postJournal(req, tenantId, id)
  const journal = await service.getJournal(req, tenantId, id)
  return sendSuccess(res, 'journal posted', { journal, posting })
})

export const getJournalLedger = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await postingService.getJournalLedger(tenantId, id)
  return sendSuccess(res, 'journal ledger fetched', items)
})
