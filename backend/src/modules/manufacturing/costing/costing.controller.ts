import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import type {
  CreateCostingPolicyInput,
  ListCostingPoliciesQuery,
  UpdateCostingPolicyInput,
} from './costing.schemas.js'
import * as policy from './costing-policy.service.js'
import * as costing from './work-order-cost.service.js'
import { getManufacturingAccountingReadiness } from './accounting-readiness.service.js'
import * as posting from './posting-orchestrator.service.js'
import * as workspace from './workspace.service.js'

export const listPolicies = asyncHandler(async (req: Request, res: Response) => {
  const result = await policy.listCostingPolicies(getTenantId(req), req.query as unknown as ListCostingPoliciesQuery)
  return sendPaginated(res, 'Costing policies listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const getPolicy = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Costing policy fetched', await policy.getCostingPolicy(getTenantId(req), getRouteParam(req, 'id'))))
export const createPolicy = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Costing policy created', await policy.createCostingPolicy(req, getTenantId(req), req.body as CreateCostingPolicyInput)))
export const updatePolicy = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Costing policy updated', await policy.updateCostingPolicy(req, getTenantId(req), getRouteParam(req, 'id'), req.body as UpdateCostingPolicyInput)))
export const deletePolicy = asyncHandler(async (req: Request, res: Response) => {
  await policy.deleteCostingPolicy(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Costing policy deleted', null)
})
export const activatePolicy = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Costing policy activated', await policy.activateCostingPolicy(req, getTenantId(req), getRouteParam(req, 'id'))))

export const calculateCost = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Work-order cost calculated', await costing.calculateWorkOrderCost(
    getTenantId(req),
    getRouteParam(req, 'id'),
    { persist: req.body.persist !== false, req },
  )))
export const getCostSummary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Work-order cost summary fetched', await costing.getCostSummary(getTenantId(req), getRouteParam(req, 'id'))))
export const getCostDetails = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Work-order cost details fetched', await costing.listCostDetails(getTenantId(req), getRouteParam(req, 'id'))))
export const getCostSnapshots = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Work-order cost snapshots fetched', await costing.listCostSnapshots(getTenantId(req), getRouteParam(req, 'id'))))

export const getTenantReadiness = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Manufacturing accounting readiness fetched', await getManufacturingAccountingReadiness(getTenantId(req))))
export const getWorkOrderReadiness = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Work-order accounting readiness fetched', await getManufacturingAccountingReadiness(getTenantId(req), getRouteParam(req, 'id'))))
export const previewFinancialClose = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Financial close preview fetched', await posting.financialClosePreview(getTenantId(req), getRouteParam(req, 'id'))))
export const financialClose = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Financial close event recorded', await posting.financialClose(req, getTenantId(req), getRouteParam(req, 'id'))))

export const recordAbsorption = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Absorption events recorded', await posting.recordAbsorptionEvents(req, getTenantId(req), getRouteParam(req, 'id'))))
export const recordAndPostAbsorption = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Absorption events recorded and posted', await posting.recordAndPostAbsorptionEvents(req, getTenantId(req), getRouteParam(req, 'id'))))

export const validateEvent = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Manufacturing event validated', await posting.validateEvent(getTenantId(req), getRouteParam(req, 'id'))))
export const postEvent = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Manufacturing event posted', await posting.postEvent(req, getTenantId(req), getRouteParam(req, 'id'))))
export const retryEvent = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Manufacturing event retried', await posting.retryEvent(req, getTenantId(req), getRouteParam(req, 'id'))))

export const getWorkspaceSummary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Manufacturing accounting workspace summary fetched', await workspace.getWorkspaceSummary(getTenantId(req))))
export const getUnposted = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Unposted manufacturing events listed', await workspace.listUnposted(getTenantId(req))))
export const getFailed = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Failed manufacturing events listed', await workspace.listFailed(getTenantId(req))))
export const getProvisional = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Provisional manufacturing costs listed', await workspace.listProvisional(getTenantId(req))))
export const getCloseReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Close-ready work orders listed', await workspace.listCloseReady(getTenantId(req))))
export const getReconciliation = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Manufacturing reconciliation listed', await workspace.listReconciliation(getTenantId(req))))
