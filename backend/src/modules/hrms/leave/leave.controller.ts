import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as setup from './leave-setup.service.js'
import * as requests from './leave-request.service.js'
import { findLinkedEmployeeId } from './leave-request.service.js'
import type {
  AdjustBalanceInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  CreatePolicyInput,
  ListBalancesQuery,
  ListRequestsQuery,
  PostAccrualInput,
  PreviewLeaveInput,
  UpdateLeaveRequestInput,
  UpdateLeaveTypeInput,
  UpdatePolicyInput,
  UpsertBalanceInput,
} from './leave.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

function hasPerm(req: Request, name: string): boolean {
  return Boolean(req.context?.permissions?.includes(name))
}

export const listTypes = asyncHandler(async (req: Request, res: Response) => {
  const result = await setup.listLeaveTypes(getTenantId(req), req.query as never)
  return sendPaginated(
    res,
    'Leave types listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createType = asyncHandler(async (req: Request, res: Response) => {
  const item = await setup.createLeaveType(
    getTenantId(req),
    req.body as CreateLeaveTypeInput,
    auditMeta(req),
  )
  return sendCreated(res, 'Leave type created', item)
})

export const updateType = asyncHandler(async (req: Request, res: Response) => {
  const item = await setup.updateLeaveType(
    getTenantId(req),
    getRouteParam(req, 'leaveTypeId'),
    req.body as UpdateLeaveTypeInput,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave type updated', item)
})

export const listPolicies = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await setup.listPolicies(getTenantId(req), scope, req.query as never)
  return sendPaginated(
    res,
    'Leave policies listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createPolicy = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await setup.createPolicy(
    getTenantId(req),
    req.body as CreatePolicyInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Leave policy created', item)
})

export const updatePolicy = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await setup.updatePolicy(
    getTenantId(req),
    getRouteParam(req, 'policyId'),
    req.body as UpdatePolicyInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave policy updated', item)
})

export const listBalances = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const query = req.query as unknown as ListBalancesQuery
  const effectiveQuery = query.mine
    ? { ...query, employeeId: await findLinkedEmployeeId(getTenantId(req), req.context!.userId) ?? '__none__' }
    : query
  const result = await setup.listBalances(
    getTenantId(req),
    scope,
    effectiveQuery,
  )
  return sendPaginated(
    res,
    'Leave balances listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const upsertBalance = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await setup.upsertBalance(
    getTenantId(req),
    req.body as UpsertBalanceInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave balance saved', item)
})

export const adjustBalance = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await setup.adjustBalance(
    getTenantId(req),
    req.body as AdjustBalanceInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave balance adjusted', item)
})

export const postAccrual = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await setup.postAccrual(
    getTenantId(req),
    req.body as PostAccrualInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave accrual posted', item)
})

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.previewLeave(
    getTenantId(req),
    req.context!.userId,
    req.body as PreviewLeaveInput,
    scope,
  )
  return sendSuccess(res, 'Leave preview', item)
})

export const listRequests = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await requests.listRequests(
    getTenantId(req),
    req.context!.userId,
    scope,
    req.query as unknown as ListRequestsQuery,
  )
  return sendPaginated(
    res,
    'Leave requests listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.getRequest(getTenantId(req), getRouteParam(req, 'requestId'), scope)
  return sendSuccess(res, 'Leave request fetched', item)
})

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.createRequest(
    getTenantId(req),
    req.context!.userId,
    req.body as CreateLeaveRequestInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Leave request created', item)
})

export const updateRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.updateDraft(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'requestId'),
    req.body as UpdateLeaveRequestInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave request updated', item)
})

export const submitRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.submitRequest(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'requestId'),
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave request submitted', item)
})

export const approveRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.approveRequest(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'requestId'),
    scope,
    hasPerm(req, 'hrms.leave.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave request approved', item)
})

export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.rejectRequest(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'requestId'),
    (req.body as { reason: string }).reason,
    scope,
    hasPerm(req, 'hrms.leave.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave request rejected', item)
})

export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.cancelRequest(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'requestId'),
    (req.body as { reason?: string }).reason,
    scope,
    hasPerm(req, 'hrms.leave.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Leave request cancelled', item)
})

export const approvedSource = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requests.listApprovedLeaveDays(
    getTenantId(req),
    String(req.query.employeeId),
    String(req.query.from),
    String(req.query.to),
    scope,
  )
  return sendSuccess(res, 'Approved leave source', item)
})
