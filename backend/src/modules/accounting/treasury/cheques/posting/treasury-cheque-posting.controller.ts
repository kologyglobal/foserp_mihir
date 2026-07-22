import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../../utils/response.js'
import { issueTreasuryCheque } from './treasury-cheque-posting-issue.service.js'
import { depositTreasuryCheque } from './treasury-cheque-posting-deposit.service.js'
import { bounceTreasuryCheque, clearTreasuryCheque, reverseTreasuryCheque, stopTreasuryCheque } from './treasury-cheque-posting-lifecycle.service.js'

export const issueTreasuryChequeHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque issued', await issueTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const depositTreasuryChequeHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque deposited', await depositTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const clearTreasuryChequeHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque cleared', await clearTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const bounceTreasuryChequeHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque bounced', await bounceTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const stopTreasuryChequeHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque stopped', await stopTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reverseTreasuryChequeHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque reversed', await reverseTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
