import type { Request, Response } from 'express'
import type { ManufacturingBom, ManufacturingBomLine, ManufacturingBomVersion } from '@prisma/client'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as service from './bom.service.js'
import * as importService from './bom-import.service.js'
import type {
  CompareBomVersionsQuery,
  ConfirmBomImportInput,
  CreateBomInput,
  CreateBomLineInput,
  CreateBomVersionInput,
  ListBomVersionsQuery,
  ListBomsQuery,
  PreviewBomImportInput,
  UpdateBomInput,
  UpdateBomLineInput,
  UpdateBomVersionInput,
} from './bom.schemas.js'

type ItemSnap = { id: string; code: string; name: string }
type UomSnap = { id: string; code: string; name: string }
type BomLineWithMasters = ManufacturingBomLine & { item?: ItemSnap | null; uom?: UomSnap | null }
type BomVersionListSnap = Pick<
  ManufacturingBomVersion,
  'id' | 'versionNumber' | 'revisionCode' | 'status' | 'effectiveFrom'
> & { _count?: { lines: number } }
type BomWithProduct = ManufacturingBom & {
  productItem?: ItemSnap | null
  versions?: BomVersionListSnap[]
}

export const getBomImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="bom-combined-import-template.csv"')
  return res.send(importService.bomImportTemplateCsv())
})

export const previewBomImport = asyncHandler(async (req: Request, res: Response) => {
  const result = await importService.previewBomImport(getTenantId(req), req.body as PreviewBomImportInput)
  return sendSuccess(res, result.ready ? 'BOM import is ready' : 'BOM import has validation errors', result)
})

export const confirmBomImport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await importService.confirmBomImport(req, tenantId, userId, req.body as ConfirmBomImportInput)
  return sendCreated(res, 'BOM CSV import completed', result)
})

export function mapBom(bom: BomWithProduct) {
  const { productItem, versions, ...rest } = bom
  return {
    ...rest,
    productItemCode: productItem?.code ?? null,
    productItemName: productItem?.name ?? null,
    ...(versions
      ? {
          versions: versions.map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
            revisionCode: version.revisionCode,
            status: version.status,
            effectiveFrom: version.effectiveFrom,
            lineCount: version._count?.lines ?? 0,
          })),
        }
      : {}),
  }
}

export function mapBomVersion(version: ManufacturingBomVersion) {
  return {
    ...version,
    baseQuantity: dec(version.baseQuantity),
    expectedYieldPercent: dec(version.expectedYieldPercent),
  }
}

export function mapBomLine(line: BomLineWithMasters) {
  const { item, uom, ...rest } = line
  return {
    ...rest,
    quantity: dec(line.quantity),
    fixedQuantity: dec(line.fixedQuantity),
    scrapPercent: dec(line.scrapPercent),
    yieldPercent: dec(line.yieldPercent),
    itemCode: item?.code ?? null,
    itemName: item?.name ?? null,
    uomCode: uom?.code ?? null,
  }
}

function mapTreeNode(node: unknown): unknown {
  const typed = node as BomLineWithMasters & { children: unknown[] }
  return { ...mapBomLine(typed), children: typed.children.map(mapTreeNode) }
}

export const listBoms = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listBoms(tenantId, req.query as unknown as ListBomsQuery)
  return sendPaginated(
    res,
    'BOMs listed',
    result.items.map((row) => mapBom(row as BomWithProduct)),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createBom = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createBom(req, tenantId, req.body as CreateBomInput)
  return sendCreated(res, 'BOM created', item)
})

export const updateBom = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  const item = await service.updateBom(req, tenantId, bomId, req.body as UpdateBomInput)
  return sendSuccess(res, 'BOM updated', mapBom(item as BomWithProduct))
})

export const deleteBom = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  await service.softDeleteBom(req, tenantId, bomId)
  return sendSuccess(res, 'BOM deleted', null)
})

export const activateBom = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  const item = await service.setBomActive(req, tenantId, bomId, true)
  return sendSuccess(res, 'BOM activated', mapBom(item as BomWithProduct))
})

export const deactivateBom = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  const item = await service.setBomActive(req, tenantId, bomId, false)
  return sendSuccess(res, 'BOM deactivated', mapBom(item as BomWithProduct))
})

export const getBom = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  const { bom, versions } = await service.getBom(tenantId, bomId)
  return sendSuccess(res, 'BOM fetched', { ...mapBom(bom), versions: versions.map(mapBomVersion) })
})

export const listBomVersions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  const result = await service.listBomVersions(tenantId, bomId, req.query as unknown as ListBomVersionsQuery)
  return sendPaginated(
    res,
    'BOM versions listed',
    result.items.map(mapBomVersion),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createBomVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const bomId = getRouteParam(req, 'bomId')
  const item = await service.createBomVersion(req, tenantId, bomId, req.body as CreateBomVersionInput)
  return sendCreated(res, 'BOM version created', mapBomVersion(item))
})

export const getBomVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const { version, lines } = await service.getBomVersion(tenantId, versionId)
  return sendSuccess(res, 'BOM version fetched', { ...mapBomVersion(version), lines: lines.map(mapBomLine) })
})

export const updateBomVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.updateBomVersionMeta(req, tenantId, versionId, req.body as UpdateBomVersionInput)
  return sendSuccess(res, 'BOM version updated', mapBomVersion(item))
})

export const getBomVersionTree = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const { version, tree } = await service.getBomVersionTree(tenantId, versionId)
  return sendSuccess(res, 'BOM tree fetched', { version: mapBomVersion(version), tree: tree.map(mapTreeNode) })
})

export const createBomLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.createBomLine(req, tenantId, versionId, req.body as CreateBomLineInput)
  return sendCreated(res, 'BOM line created', mapBomLine(item))
})

export const validateBomVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const result = await service.validateBomVersion(tenantId, versionId)
  return sendSuccess(res, 'BOM version validated', result)
})

export const activateBomVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.activateBomVersion(req, tenantId, versionId)
  return sendSuccess(res, 'BOM version activated', mapBomVersion(item))
})

export const reviseBomVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.reviseBomVersion(req, tenantId, versionId)
  return sendCreated(res, 'BOM version revised', mapBomVersion(item))
})

export const compareBomVersions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const query = req.query as unknown as CompareBomVersionsQuery
  const fromId = query.from ?? versionId
  const result = await service.compareBomVersions(tenantId, fromId, query.to)
  return sendSuccess(res, 'BOM versions compared', result)
})

export const updateBomLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const lineId = getRouteParam(req, 'lineId')
  const item = await service.updateBomLine(req, tenantId, lineId, req.body as UpdateBomLineInput)
  return sendSuccess(res, 'BOM line updated', mapBomLine(item))
})

export const deleteBomLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const lineId = getRouteParam(req, 'lineId')
  await service.deleteBomLine(req, tenantId, lineId)
  return sendSuccess(res, 'BOM line deleted', null)
})
