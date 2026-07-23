import type { Request, Response } from 'express'
import { z } from 'zod'
import { getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { resolveLineGstFromMasters } from '../accounting/shared/master-resolvers/accounting-tax-resolver.js'

export const resolveGstTaxQuerySchema = z.object({
  applicableFor: z.enum(['SALES', 'PURCHASE']),
  asOfDate: z.string().trim().min(1).optional(),
  fromState: z.string().trim().min(1).max(100).optional(),
  toState: z.string().trim().min(1).max(100).optional(),
  gstGroupId: z.string().uuid().optional(),
  hsnId: z.string().uuid().optional(),
  hsnCode: z.string().trim().min(1).max(16).optional(),
  itemId: z.string().uuid().optional(),
})

/** GET /masters/tax/resolve — CGST/SGST/IGST from tax masters (no form-hardcoded rates). */
export const resolveGstTax = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = resolveGstTaxQuerySchema.parse(req.query)
  const rate = await resolveLineGstFromMasters({
    tenantId,
    applicableFor: q.applicableFor,
    asOfDate: q.asOfDate,
    fromState: q.fromState,
    toState: q.toState,
    gstGroupId: q.gstGroupId,
    hsnId: q.hsnId,
    hsnCode: q.hsnCode,
    itemId: q.itemId,
  })
  return sendSuccess(res, rate ? 'GST rate resolved from tax master' : 'No matching GST rate', rate)
})
