import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as readService from './approval-read.service.js'
import * as decisionService from './approval-decision.service.js'
import * as journalService from '../journals/journal.service.js'

export const listApprovalRequests = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await readService.listApprovalRequests(req, tenantId, req.query as never)
  return sendPaginated(
    res,
    'approval requests listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getApprovalRequest = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await readService.getApprovalRequest(req, tenantId, id)
  return sendSuccess(res, 'approval request fetched', item)
})

export const getJournalApprovals = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const journalId = getRouteParam(req, 'id')
  const items = await readService.getJournalApprovalsTimeline(req, tenantId, journalId)
  return sendSuccess(res, 'journal approvals fetched', items)
})

export const approveJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const journalId = getRouteParam(req, 'id')
  await decisionService.approveJournal(req, tenantId, journalId, req.body)
  const item = await journalService.getJournal(req, tenantId, journalId)
  return sendSuccess(res, 'journal approved', item)
})

export const sendBackJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const journalId = getRouteParam(req, 'id')
  await decisionService.sendBackJournal(req, tenantId, journalId, req.body)
  const item = await journalService.getJournal(req, tenantId, journalId)
  return sendSuccess(res, 'journal sent back', item)
})

export const rejectJournal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const journalId = getRouteParam(req, 'id')
  await decisionService.rejectJournal(req, tenantId, journalId, req.body)
  const item = await journalService.getJournal(req, tenantId, journalId)
  return sendSuccess(res, 'journal rejected', item)
})
