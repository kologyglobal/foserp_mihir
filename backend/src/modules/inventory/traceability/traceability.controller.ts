import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './traceability.service.js'

function id(req: Request): string {
  return String(req.params.id)
}

export const getBatchLineage = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Batch lineage fetched', await service.getBatchLineage(getTenantId(req), id(req))),
)

export const getSerialLineage = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Serial lineage fetched', await service.getSerialLineage(getTenantId(req), id(req))),
)

export const getItemLineage = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Item lineage fetched', await service.getItemLineage(getTenantId(req), id(req))),
)
