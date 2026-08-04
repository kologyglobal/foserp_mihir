import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendCreated, sendSuccess } from '../../utils/response.js'
import { NotFoundError } from '../../utils/errors.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const ruleSchema = z.object({
  documentType: z.string().min(1).max(64),
  amountFrom: z.number().nonnegative().default(0),
  amountTo: z.number().positive().optional().nullable(),
  roleId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  legalEntityId: z.string().uuid().optional().nullable(),
  selfApprovalAllowed: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  notes: z.string().max(500).optional().nullable(),
})

router.get(
  '/',
  requirePermission('user.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await prisma.approvalAuthorityRule.findMany({
      where: { tenantId: getTenantId(req), deletedAt: null },
      orderBy: [{ documentType: 'asc' }, { amountFrom: 'asc' }],
    })
    sendSuccess(res, 'Approval authority rules', rows)
  }),
)

router.post(
  '/',
  requirePermission('user.update'),
  validateBody(ruleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getContext(req)
    const body = req.body as z.infer<typeof ruleSchema>
    const row = await prisma.approvalAuthorityRule.create({
      data: {
        tenantId: getTenantId(req),
        documentType: body.documentType,
        amountFrom: body.amountFrom,
        amountTo: body.amountTo ?? null,
        roleId: body.roleId ?? null,
        userId: body.userId ?? null,
        branchId: body.branchId ?? null,
        legalEntityId: body.legalEntityId ?? null,
        selfApprovalAllowed: body.selfApprovalAllowed ?? false,
        isActive: body.isActive ?? true,
        notes: body.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    sendCreated(res, 'Rule created', row)
  }),
)

router.patch(
  '/:ruleId',
  requirePermission('user.update'),
  validateBody(ruleSchema.partial()),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req)
    const ruleId = getRouteParam(req, 'ruleId')
    const existing = await prisma.approvalAuthorityRule.findFirst({
      where: { id: ruleId, tenantId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Rule not found')
    const ctx = getContext(req)
    const body = req.body as Partial<z.infer<typeof ruleSchema>>
    const row = await prisma.approvalAuthorityRule.update({
      where: { id: ruleId },
      data: {
        documentType: body.documentType,
        amountFrom: body.amountFrom,
        amountTo: body.amountTo,
        roleId: body.roleId,
        userId: body.userId,
        branchId: body.branchId,
        legalEntityId: body.legalEntityId,
        selfApprovalAllowed: body.selfApprovalAllowed,
        isActive: body.isActive,
        notes: body.notes,
        updatedBy: ctx.userId,
      },
    })
    sendSuccess(res, 'Rule updated', row)
  }),
)

router.delete(
  '/:ruleId',
  requirePermission('user.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req)
    const ruleId = getRouteParam(req, 'ruleId')
    const existing = await prisma.approvalAuthorityRule.findFirst({
      where: { id: ruleId, tenantId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Rule not found')
    await prisma.approvalAuthorityRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date(), updatedBy: getContext(req).userId },
    })
    sendSuccess(res, 'Rule deactivated', { id: ruleId })
  }),
)

export default router
