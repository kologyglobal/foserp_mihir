import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as challanService from '../challan/delivery-challan.service.js'
import * as reconService from '../challan/delivery-challan-reconciliation.service.js'
import type { CreateChallanInput, ListChallansQuery, UpdateChallanInput } from './phase7c4.schemas.js'

export const createChallan = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.createFromDispatch(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as CreateChallanInput,
  )
  return sendCreated(res, 'Delivery challan created', data)
})

export const listChallans = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListChallansQuery
  const result = await challanService.listChallans(getTenantId(req), query)
  return sendPaginated(
    res,
    'Delivery challans',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getChallan = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.getChallan(getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Delivery challan', data)
})

export const updateChallan = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.updateChallan(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as UpdateChallanInput,
  )
  return sendSuccess(res, 'Delivery challan updated', data)
})

export const refreshFromPacking = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.refreshFromPacking(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Delivery challan refreshed', data)
})

export const readyForReview = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.readyForReview(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Delivery challan ready for review', data)
})

export const sendBack = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { reason?: string }
  const data = await challanService.sendBack(req, getTenantId(req), getRouteParam(req, 'id'), body.reason ?? '')
  return sendSuccess(res, 'Delivery challan sent back', data)
})

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.approve(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Delivery challan approved', data)
})

export const issue = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { idempotencyKey?: string; sourceVersion?: number }
  const data = await challanService.issue(req, getTenantId(req), getRouteParam(req, 'id'), body)
  return sendSuccess(res, 'Delivery challan issued', data)
})

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { reason?: string }
  const data = await challanService.cancel(req, getTenantId(req), getRouteParam(req, 'id'), body.reason ?? '')
  return sendSuccess(res, 'Delivery challan cancelled', data)
})

export const supersede = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { reason?: string }
  const data = await challanService.supersede(req, getTenantId(req), getRouteParam(req, 'id'), body.reason ?? '')
  return sendCreated(res, 'Replacement Delivery Challan draft created', data)
})

export const getReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.getSessionReconciliation(getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Challan reconciliation', data)
})

export const getChallanPosition = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.getChallanPosition(getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Challan position', data)
})

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const doc = await challanService.getPreviewHtml(getTenantId(req), getRouteParam(req, 'id'))
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Challan-Status', doc.status)
  return res.status(200).send(doc.html)
})

export const pdf = asyncHandler(async (req: Request, res: Response) => {
  const doc = await challanService.getPreviewHtml(getTenantId(req), getRouteParam(req, 'id'))
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`)
  res.setHeader('X-Document-Note', 'Printable HTML document (PDF via browser print). DELIVERY_CHALLAN_AS_DOCUMENT_ONLY.')
  return res.status(200).send(doc.html)
})

export const generateDraftPreview = asyncHandler(async (req: Request, res: Response) => {
  const data = await challanService.generateDraftPreview(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Draft preview generated', data)
})

export const workbenchChallanDrafts = asyncHandler(async (req: Request, res: Response) => {
  const result = await challanService.listChallans(getTenantId(req), {
    status: 'DRAFT',
    page: 1,
    limit: 50,
  })
  return sendSuccess(res, 'Challan drafts', result.items)
})

export const workbenchChallanReview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const [ready, approved] = await Promise.all([
    challanService.listChallans(tenantId, { status: 'READY_FOR_REVIEW', page: 1, limit: 50 }),
    challanService.listChallans(tenantId, { status: 'APPROVED', page: 1, limit: 50 }),
  ])
  return sendSuccess(res, 'Challan review queue', [...ready.items, ...approved.items])
})

export const workbenchChallansIssued = asyncHandler(async (req: Request, res: Response) => {
  const result = await challanService.listChallans(getTenantId(req), { status: 'ISSUED', page: 1, limit: 50 })
  return sendSuccess(res, 'Issued challans', result.items)
})

export const workbenchReadyForDispatch = asyncHandler(async (req: Request, res: Response) => {
  const result = await challanService.listChallans(getTenantId(req), { status: 'ISSUED', page: 1, limit: 50 })
  return sendSuccess(res, 'Ready for dispatch (issued challans)', result.items)
})

export const workbenchChallanExceptions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const [sentBack, cancelled] = await Promise.all([
    challanService.listChallans(tenantId, { status: 'SENT_BACK', page: 1, limit: 50 }),
    challanService.listChallans(tenantId, { status: 'CANCELLED', page: 1, limit: 50 }),
  ])
  return sendSuccess(res, 'Challan exceptions', [...sentBack.items, ...cancelled.items])
})

export const reconcileOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await reconService.reconcileDispatchForChallan(getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Packing-to-challan reconciliation', data)
})
