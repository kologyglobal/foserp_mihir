import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import * as consentService from './bank-connector-consent.service.js'
import * as service from './bank-connector.service.js'
import type { ListBankConnectorsQuery } from './bank-connector.schemas.js'

export const listProviders = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, 'bank connector providers listed', service.listProviders()))

export const listBankConnectors = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listBankConnectors(getTenantId(req), req.query as unknown as ListBankConnectorsQuery)
  return sendPaginated(res, 'bank connectors listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getBankConnector = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'bank connector fetched', await service.getBankConnector(getTenantId(req), getRouteParam(req, 'id'))))

export const createBankConnector = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'bank connector created', await service.createBankConnector(req, getTenantId(req), req.body)))

export const updateBankConnector = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector updated',
    await service.updateBankConnector(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const enableBankConnector = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector enabled',
    await service.enableBankConnector(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const disableBankConnector = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector disabled',
    await service.disableBankConnector(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const testBankConnectorConnection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector test completed',
    await service.testBankConnectorConnection(req, getTenantId(req), getRouteParam(req, 'id')),
  ))

export const syncBankConnector = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector sync completed',
    await service.syncBankConnector(req, getTenantId(req), getRouteParam(req, 'id')),
  ))

export const startBankConnectorConsent = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'bank connector consent started',
    await consentService.startConsent(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const bankConnectorConsentCallback = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector consent callback processed',
    await consentService.consentCallback(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const revokeBankConnectorConsent = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'bank connector consent revoked',
    await consentService.revokeConsent(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))
