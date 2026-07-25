import type { Request, Response } from 'express'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import { IndiaMartError } from './indiamart.errors.js'
import * as service from './indiamart.service.js'
import * as settingsService from './indiamart.settings.js'
import type {
  ListEnquiriesQuery,
  SyncIndiaMartInput,
  UpdateIndiaMartSettingsInput,
} from './indiamart.validation.js'

function tenantId(req: Request) {
  return req.context!.tenantId
}
function userId(req: Request) {
  return req.context!.userId
}

function handleIndiaMartError(err: unknown, res: Response) {
  if (err instanceof IndiaMartError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code, details: err.details },
    })
  }
  throw err
}

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'IndiaMART settings', await settingsService.getSettings(tenantId(req)))
})

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await settingsService.updateSettings(
      tenantId(req),
      userId(req),
      req.body as UpdateIndiaMartSettingsInput,
    )
    sendSuccess(res, 'IndiaMART settings updated', data)
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await settingsService.testConnection(tenantId(req), userId(req))
    sendSuccess(res, 'IndiaMART connection test', data)
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const syncNow = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await service.syncNow(tenantId(req), userId(req), req.body as SyncIndiaMartInput)
    sendCreated(res, 'IndiaMART sync started', data)
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const listSyncRuns = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)
  const result = await service.listSyncRuns(tenantId(req), page, limit)
  sendPaginated(
    res,
    'IndiaMART sync history',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const listEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listEnquiries(tenantId(req), req.query as unknown as ListEnquiriesQuery)
  sendPaginated(
    res,
    'IndiaMART enquiries',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getEnquiry = asyncHandler(async (req: Request, res: Response) => {
  try {
    const includeRaw =
      req.context?.permissions.includes('crm.indiamart.credentials.manage') === true ||
      req.context?.permissions.includes('crm.indiamart.settings.manage') === true
    sendSuccess(
      res,
      'IndiaMART enquiry',
      await service.getEnquiry(tenantId(req), String(req.params.id), includeRaw),
    )
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await service.createLeadFromEnquiry(tenantId(req), userId(req), String(req.params.id), req.body)
    sendCreated(res, 'Lead created from IndiaMART enquiry', data)
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const linkLead = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await service.linkLead(
      tenantId(req),
      userId(req),
      String(req.params.id),
      req.body.leadId,
      req.body.createActivity,
    )
    sendSuccess(res, 'Enquiry linked to lead', { leadId: data.id, leadCode: data.leadCode })
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const assignEnquiry = asyncHandler(async (req: Request, res: Response) => {
  try {
    sendSuccess(
      res,
      'Enquiry assigned',
      await service.assignEnquiry(tenantId(req), userId(req), String(req.params.id), req.body.assignedUserId),
    )
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const ignoreEnquiry = asyncHandler(async (req: Request, res: Response) => {
  try {
    sendSuccess(
      res,
      'Enquiry ignored',
      await service.ignoreEnquiry(tenantId(req), userId(req), String(req.params.id), req.body.reason),
    )
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const retryEnquiry = asyncHandler(async (req: Request, res: Response) => {
  try {
    sendSuccess(
      res,
      'Enquiry retry completed',
      await service.retryEnquiry(tenantId(req), userId(req), String(req.params.id)),
    )
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const bulkCreateLeads = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Bulk create leads',
    await service.bulkCreateLeads(tenantId(req), userId(req), req.body.enquiryIds),
  )
})

export const bulkAssign = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Bulk assign',
    await service.bulkAssign(tenantId(req), userId(req), req.body.enquiryIds, req.body.assignedUserId),
  )
})

export const bulkIgnore = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Bulk ignore',
    await service.bulkIgnore(tenantId(req), userId(req), req.body.enquiryIds, req.body.reason),
  )
})

export const listProductMappings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Product mappings', await service.listProductMappings(tenantId(req)))
})

export const updateProductMapping = asyncHandler(async (req: Request, res: Response) => {
  try {
    sendSuccess(
      res,
      'Product mapping updated',
      await service.updateProductMapping(tenantId(req), userId(req), String(req.params.id), req.body),
    )
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'IndiaMART dashboard', await service.getDashboard(tenantId(req)))
})

export const listAlerts = asyncHandler(async (req: Request, res: Response) => {
  const unreadOnly = String(req.query.unreadOnly ?? '') === 'true'
  sendSuccess(res, 'IndiaMART alerts', await service.listAlerts(tenantId(req), unreadOnly))
})

export const markAlertRead = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Alert marked read', await service.markAlertRead(tenantId(req), userId(req), String(req.params.id)))
})

export const markAllAlertsRead = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Alerts marked read', await service.markAllAlertsRead(tenantId(req), userId(req)))
})

export const enableWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:5000'
    const publicBaseUrl = `${proto}://${host}`
    sendCreated(res, 'Push webhook enabled', await service.enableWebhook(tenantId(req), userId(req), publicBaseUrl))
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const rotateWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:5000'
    const publicBaseUrl = `${proto}://${host}`
    sendSuccess(res, 'Push webhook rotated', await service.rotateWebhook(tenantId(req), userId(req), publicBaseUrl))
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const disableWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    sendSuccess(res, 'Push webhook disabled', await service.disableWebhook(tenantId(req), userId(req)))
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const createProductMapping = asyncHandler(async (req: Request, res: Response) => {
  try {
    sendCreated(
      res,
      'Product mapping created',
      await service.createProductMapping(tenantId(req), userId(req), req.body),
    )
  } catch (err) {
    handleIndiaMartError(err, res)
  }
})

export const suggestProductMappings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Product mappings suggested',
    await service.suggestProductMappingsFromEnquiries(tenantId(req), userId(req)),
  )
})
