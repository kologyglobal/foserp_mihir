import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../../utils/response.js'
import { postTreasuryTransferDirect } from './treasury-transfer-posting-direct.service.js'
import { dispatchTreasuryTransfer } from './treasury-transfer-posting-dispatch.service.js'
import { receiveTreasuryTransfer } from './treasury-transfer-posting-receive.service.js'
import { getTreasuryTransferReversalPreview, reverseTreasuryTransferFromRequest } from './treasury-transfer-reverse.service.js'

export const postTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer posted', await postTreasuryTransferDirect(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const dispatchTreasuryTransferHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer dispatched', await dispatchTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const receiveTreasuryTransferHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer received', await receiveTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getTreasuryTransferReversalPreviewHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer reversal preview fetched', await getTreasuryTransferReversalPreview(req, getTenantId(req), getRouteParam(req, 'id'))))

export const reverseTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer reversed', await reverseTreasuryTransferFromRequest(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
