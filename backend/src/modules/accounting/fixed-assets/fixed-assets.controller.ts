import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import * as categoryService from './fixed-asset-category.service.js'
import * as assetService from './fixed-asset.service.js'
import * as capitalizeService from './fixed-asset-capitalize.service.js'
import * as disposeService from './fixed-asset-dispose.service.js'
import * as transferService from './fixed-asset-transfer.service.js'
import * as depreciationService from './fixed-asset-depreciation.service.js'
import * as overviewService from './fixed-asset-overview.service.js'
import * as phase4Service from './fixed-asset-phase4.service.js'
import type {
  CapitalizeFixedAssetInput,
  CompleteFixedAssetMaintenanceInput,
  CompleteFixedAssetTransferInput,
  CreateDepreciationRunInput,
  CreateFixedAssetCategoryInput,
  CreateFixedAssetImpairmentInput,
  CreateFixedAssetInput,
  CreateFixedAssetMaintenanceInput,
  CreateFixedAssetRevaluationInput,
  CreateFixedAssetTransferInput,
  DepreciationPreviewInput,
  DisposeFixedAssetInput,
  DisposePreviewInput,
  FixedAssetOverviewQueryInput,
  FixedAssetReportQueryInput,
  ListDepreciationRunsQueryInput,
  ListFixedAssetCategoriesQueryInput,
  ListFixedAssetPhase4QueryInput,
  ListFixedAssetTransfersQueryInput,
  ListFixedAssetsQueryInput,
  UpdateFixedAssetCategoryInput,
  UpdateFixedAssetInput,
  UpdateFixedAssetMaintenanceInput,
} from './fixed-assets.schemas.js'

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as FixedAssetOverviewQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const data = await overviewService.getOverview(tenantId, query)
  return sendSuccess(res, 'fixed assets overview fetched', data)
})

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListFixedAssetCategoriesQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await categoryService.listCategories(req, tenantId, query)
  return sendSuccess(
    res,
    'fixed asset categories listed',
    result.items,
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await categoryService.getCategory(req, tenantId, id)
  return sendSuccess(res, 'fixed asset category fetched', data)
})

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await categoryService.createCategory(req, tenantId, req.body as CreateFixedAssetCategoryInput)
  return sendCreated(res, 'fixed asset category created', data)
})

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await categoryService.updateCategory(req, tenantId, id, req.body as UpdateFixedAssetCategoryInput)
  return sendSuccess(res, 'fixed asset category updated', data)
})

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListFixedAssetsQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await assetService.listAssets(req, tenantId, query)
  return sendSuccess(
    res,
    'fixed assets listed',
    result.items,
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await assetService.getAsset(req, tenantId, id)
  return sendSuccess(res, 'fixed asset fetched', data)
})

export const createAsset = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await assetService.createAsset(req, tenantId, req.body as CreateFixedAssetInput)
  return sendCreated(res, 'fixed asset created', data)
})

export const updateAsset = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await assetService.updateAsset(req, tenantId, id, req.body as UpdateFixedAssetInput)
  return sendSuccess(res, 'fixed asset updated', data)
})

export const capitalizeAsset = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await capitalizeService.capitalizeAsset(req, tenantId, id, req.body as CapitalizeFixedAssetInput)
  return sendSuccess(res, result.idempotentReplay ? 'fixed asset capitalization replayed' : 'fixed asset capitalized', result)
})

export const previewDisposeAsset = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await disposeService.previewDisposal(req, tenantId, id, req.body as DisposePreviewInput)
  return sendSuccess(res, 'fixed asset disposal preview generated', data)
})

export const disposeAsset = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await disposeService.disposeAsset(req, tenantId, id, req.body as DisposeFixedAssetInput)
  return sendSuccess(res, result.idempotentReplay ? 'fixed asset disposal replayed' : 'fixed asset disposed', result)
})

export const listTransfers = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListFixedAssetTransfersQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await transferService.listTransfers(req, tenantId, query)
  return sendSuccess(
    res,
    'fixed asset transfers listed',
    result.items,
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getTransfer = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await transferService.getTransfer(req, tenantId, id)
  return sendSuccess(res, 'fixed asset transfer fetched', data)
})

export const createTransfer = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await transferService.createTransfer(req, tenantId, req.body as CreateFixedAssetTransferInput)
  return sendCreated(res, 'fixed asset transfer created', data)
})

export const completeTransfer = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await transferService.completeTransfer(
    req,
    tenantId,
    id,
    req.body as CompleteFixedAssetTransferInput,
  )
  return sendSuccess(res, 'fixed asset transfer completed', data)
})

export const listDepreciationRuns = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListDepreciationRunsQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await depreciationService.listDepreciationRuns(req, tenantId, query)
  return sendSuccess(
    res,
    'depreciation runs listed',
    result.items,
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getDepreciationRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await depreciationService.getDepreciationRun(req, tenantId, id)
  return sendSuccess(res, 'depreciation run fetched', data)
})

export const previewDepreciationRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await depreciationService.previewDepreciation(req, tenantId, req.body as DepreciationPreviewInput)
  return sendSuccess(res, 'depreciation preview generated', data)
})

export const createDepreciationRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await depreciationService.createAndPostDepreciationRun(
    req,
    tenantId,
    req.body as CreateDepreciationRunInput,
  )
  return sendCreated(
    res,
    result.idempotentReplay ? 'depreciation run replayed' : 'depreciation run posted',
    result,
  )
})

// ─── Phase 4 ─────────────────────────────────────────────────────────────────

export const listRevaluations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListFixedAssetPhase4QueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await phase4Service.listRevaluations(req, tenantId, query)
  return sendSuccess(res, 'revaluations listed', result.items, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getRevaluation = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.getRevaluation(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'revaluation fetched', data)
})

export const createRevaluation = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.createRevaluation(req, getTenantId(req), req.body as CreateFixedAssetRevaluationInput)
  return sendCreated(res, 'revaluation created', data)
})

export const postRevaluation = asyncHandler(async (req: Request, res: Response) => {
  const result = await phase4Service.postRevaluation(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, result.idempotentReplay ? 'revaluation replayed' : 'revaluation posted', result)
})

export const cancelRevaluation = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.cancelRevaluation(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'revaluation cancelled', data)
})

export const listImpairments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListFixedAssetPhase4QueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await phase4Service.listImpairments(req, tenantId, query)
  return sendSuccess(res, 'impairments listed', result.items, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getImpairment = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.getImpairment(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'impairment fetched', data)
})

export const createImpairment = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.createImpairment(req, getTenantId(req), req.body as CreateFixedAssetImpairmentInput)
  return sendCreated(res, 'impairment created', data)
})

export const recognizeImpairment = asyncHandler(async (req: Request, res: Response) => {
  const result = await phase4Service.recognizeImpairment(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, result.idempotentReplay ? 'impairment replayed' : 'impairment recognized', result)
})

export const cancelImpairment = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.cancelImpairment(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'impairment cancelled', data)
})

export const listMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListFixedAssetPhase4QueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await phase4Service.listMaintenance(req, tenantId, query)
  return sendSuccess(res, 'maintenance listed', result.items, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.getMaintenance(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'maintenance fetched', data)
})

export const createMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.createMaintenance(req, getTenantId(req), req.body as CreateFixedAssetMaintenanceInput)
  return sendCreated(res, 'maintenance created', data)
})

export const updateMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.updateMaintenance(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as UpdateFixedAssetMaintenanceInput,
  )
  return sendSuccess(res, 'maintenance updated', data)
})

export const completeMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CompleteFixedAssetMaintenanceInput
  const data = await phase4Service.completeMaintenance(req, getTenantId(req), getRouteParam(req, 'id'), body.completedDate)
  return sendSuccess(res, 'maintenance completed', data)
})

export const cancelMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const data = await phase4Service.cancelMaintenance(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'maintenance cancelled', data)
})

export const reportSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as FixedAssetReportQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const data = await phase4Service.reportSummary(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'fixed asset report summary', data)
})

export const reportNbvByCategory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as FixedAssetReportQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const data = await phase4Service.reportNbvByCategory(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'nbv by category', data)
})

export const reportRegister = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as FixedAssetReportQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const data = await phase4Service.reportRegister(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'fixed asset register report', data)
})

export const reportDisposals = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as FixedAssetReportQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const data = await phase4Service.reportDisposals(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'fixed asset disposal report', data)
})
