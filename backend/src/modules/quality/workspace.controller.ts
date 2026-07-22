import type { Request, Response } from 'express'
import { getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { getIncomingQueue, getWorkspaceSummary } from './workspace.service.js'

export const summary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality workspace summary fetched', await getWorkspaceSummary(getTenantId(req))))

export const incoming = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Incoming QC queue fetched', await getIncomingQueue(getTenantId(req))))
