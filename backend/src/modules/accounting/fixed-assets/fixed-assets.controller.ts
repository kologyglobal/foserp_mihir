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
import type {
  CapitalizeFixedAssetInput,
  CompleteFixedAssetTransferInput,
  CreateDepreciationRunInput,
  CreateFixedAssetCategoryInput,
  CreateFixedAssetInput,
  CreateFixedAssetTransferInput,
  DepreciationPreviewInput,
  DisposeFixedAssetInput,
  DisposePreviewInput,
  FixedAssetOverviewQueryInput,
  ListDepreciationRunsQueryInput,
  ListFixedAssetCategoriesQueryInput,
  ListFixedAssetTransfersQueryInput,
  ListFixedAssetsQueryInput,
  UpdateFixedAssetCategoryInput,
  UpdateFixedAssetInput,
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
