import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as service from './certificate.service.js'

export const list = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Certificates listed', await service.listCertificates(getTenantId(req), req.query.inspectionId as string | undefined)))
export const create = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Certificate created', await service.createCertificate(req, getTenantId(req), req.body)))
export const verify = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Certificate verified', await service.verifyCertificate(req, getTenantId(req), getRouteParam(req, 'id'))))
