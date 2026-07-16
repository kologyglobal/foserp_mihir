import type { Request, Response } from 'express'
import { getContext, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './import.service.js'

export const getCompanyImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const csv = service.companyImportTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="company-import-template.csv"')
  res.send(csv)
})

export const getContactImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const csv = service.contactImportTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="contact-import-template.csv"')
  res.send(csv)
})

export const getLeadImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const csv = service.leadImportTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="lead-import-template.csv"')
  res.send(csv)
})

export const importCompanies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.importCompanies(tenantId, userId, req.body)
  sendSuccess(res, 'Company import completed', result)
})

export const importContacts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.importContacts(tenantId, userId, req.body)
  sendSuccess(res, 'Contact import completed', result)
})

export const importLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.importLeads(tenantId, userId, req.body)
  sendSuccess(res, 'Lead import completed', result)
})
