import type { Request, Response } from 'express'
import { z } from 'zod'
import { getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { resolveGstTax as resolveGstTaxService } from '../tax/gst-tax-resolve.service.js'

/** Query string booleans arrive as 'true'|'false'; after validateQuery they may already be boolean. */
const queryBoolean = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return undefined
  if (v === true || v === 'true' || v === 1 || v === '1') return true
  if (v === false || v === 'false' || v === 0 || v === '0') return false
  return v
}, z.boolean().optional())

export const resolveGstTaxQuerySchema = z.object({
  applicableFor: z.enum(['SALES', 'PURCHASE']),
  asOfDate: z.string().trim().min(1).optional(),
  fromState: z.string().trim().min(1).max(100).optional(),
  toState: z.string().trim().min(1).max(100).optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  gstGroupId: z.string().uuid().optional(),
  hsnId: z.string().uuid().optional(),
  hsnCode: z.string().trim().min(1).max(16).optional(),
  itemId: z.string().uuid().optional(),
  reverseCharge: queryBoolean,
  /** Phase 10 export/SEZ treatment */
  taxTreatment: z
    .enum([
      'EXPORT_WITH_TAX',
      'EXPORT_WITHOUT_TAX',
      'SEZ_WITH_TAX',
      'SEZ_WITHOUT_TAX',
      'REGISTERED',
      'UNREGISTERED',
      'NON_GST',
    ])
    .optional(),
  lutPresent: queryBoolean,
  companyGstin: z.string().trim().min(3).max(20).optional(),
  /** Phase 11 special classification */
  taxCategoryHint: z
    .enum(['TAXABLE', 'NIL_RATED', 'EXEMPT', 'ZERO_RATED', 'NON_GST', 'REVERSE_CHARGE', 'COMPOSITION', 'UNRESOLVED'])
    .optional(),
  registrationScheme: z.string().trim().max(40).optional(),
  partyRegistrationScheme: z.string().trim().max(40).optional(),
})

export type ResolveGstTaxQuery = z.infer<typeof resolveGstTaxQuerySchema>

/**
 * GET /masters/tax/resolve
 * Phase 1: full tax determination (HSN, scheme, components, blockers). Never invents 18%.
 * Phase 10: taxTreatment export/SEZ zero-rated overrides.
 * Phase 11: taxCategoryHint / composition scheme flags.
 *
 * Note: validateQuery already parses this schema onto req.query — do not re-parse with
 * a schema that only accepts string enums (that breaks after boolean transform).
 */
export const resolveGstTax = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as ResolveGstTaxQuery
  const result = await resolveGstTaxService({
    tenantId,
    applicableFor: q.applicableFor,
    asOfDate: q.asOfDate,
    fromState: q.fromState,
    toState: q.toState,
    legalEntityId: q.legalEntityId,
    branchId: q.branchId,
    gstGroupId: q.gstGroupId,
    hsnId: q.hsnId,
    hsnCode: q.hsnCode,
    itemId: q.itemId,
    reverseChargeHint: q.reverseCharge,
    taxTreatmentHint: q.taxTreatment,
    lutPresent: q.lutPresent,
    companyGstin: q.companyGstin,
    taxCategoryHint: q.taxCategoryHint,
    registrationScheme: q.registrationScheme,
    partyRegistrationScheme: q.partyRegistrationScheme,
  })
  return sendSuccess(
    res,
    result.resolved ? 'GST resolved from tax masters' : 'GST unresolved — review blockers',
    result,
  )
})
