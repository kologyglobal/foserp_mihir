import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import { regenerateOtCandidate } from './ot-detection.service.js'
import * as policyService from './ot-policy.service.js'
import * as requestService from './ot-request.service.js'
import type {
  ApproveOtInput,
  BulkOtActionInput,
  CancelOtInput,
  CreateManualOtInput,
  CreateOtPolicyInput,
  ListOtPoliciesQuery,
  ListOtQuery,
  MonthlySummaryQuery,
  RegenerateOtInput,
  RejectOtInput,
  UpdateOtPolicyInput,
} from './overtime.schemas.js'

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

// ─── Policies ──────────────────────────────────────────────────────────────

export const listPolicies = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await policyService.listPolicies(
    getTenantId(req),
    scope,
    req.query as unknown as ListOtPoliciesQuery,
  )
  return sendPaginated(
    res,
    'Overtime policies listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createPolicy = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await policyService.createPolicy(
    getTenantId(req),
    req.body as CreateOtPolicyInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Overtime policy created', item)
})

export const updatePolicy = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await policyService.updatePolicy(
    getTenantId(req),
    getRouteParam(req, 'policyId'),
    req.body as UpdateOtPolicyInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Overtime policy updated', item)
})

// ─── Records ───────────────────────────────────────────────────────────────

export const listOt = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await requestService.listOt(
    getTenantId(req),
    req.context!.userId,
    scope,
    req.query as unknown as ListOtQuery,
  )
  return sendPaginated(
    res,
    'Overtime records listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getOt = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requestService.getOt(getTenantId(req), getRouteParam(req, 'otId'), scope)
  return sendSuccess(res, 'Overtime record fetched', item)
})

export const createManualOt = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requestService.createManualOt(
    getTenantId(req),
    req.context!.userId,
    req.body as CreateManualOtInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Overtime request created', item)
})

export const approveOt = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requestService.approveOt(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'otId'),
    req.body as ApproveOtInput,
    scope,
    hasPerm(req, 'hrms.overtime.manage'),
    hasPerm(req, 'hrms.overtime.override_limit'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Overtime request approved', item)
})

export const rejectOt = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requestService.rejectOt(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'otId'),
    (req.body as RejectOtInput).reason,
    scope,
    hasPerm(req, 'hrms.overtime.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Overtime request rejected', item)
})

export const cancelOt = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requestService.cancelOt(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'otId'),
    (req.body as CancelOtInput).reason,
    scope,
    hasPerm(req, 'hrms.overtime.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Overtime request cancelled', item)
})

export const bulkApprove = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await requestService.bulkApprove(
    getTenantId(req),
    req.context!.userId,
    req.body as BulkOtActionInput,
    scope,
    hasPerm(req, 'hrms.overtime.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Bulk overtime approval processed', result)
})

export const bulkReject = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await requestService.bulkReject(
    getTenantId(req),
    req.context!.userId,
    req.body as BulkOtActionInput,
    scope,
    hasPerm(req, 'hrms.overtime.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Bulk overtime rejection processed', result)
})

export const monthlySummary = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await requestService.monthlySummary(
    getTenantId(req),
    scope,
    req.query as unknown as MonthlySummaryQuery,
  )
  return sendSuccess(res, 'Overtime monthly summary', item)
})

/** Manual trigger — mainly for HR/support to force-refresh a candidate outside the punch/finalize flow. */
export const regenerate = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegenerateOtInput
  const result = await regenerateOtCandidate(getTenantId(req), body.employeeId, body.date, req.context?.userId)
  return sendSuccess(res, 'Overtime candidate regenerated', result)
})
