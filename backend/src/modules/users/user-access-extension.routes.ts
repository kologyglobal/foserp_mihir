import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendSuccess } from '../../utils/response.js'
import {
  applyCopyAccess,
  bulkUserActions,
  bulkUsersSchema,
  copyAccessSchema,
  listUserOverrides,
  previewCopyAccess,
  removeUserOverride,
  setOverrideSchema,
  updateUserDataAccessLevel,
  upsertUserOverride,
} from './user-access-extension.service.js'
import { prisma } from '../../config/prisma.js'
import { NotFoundError } from '../../utils/errors.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

const userIdOnly = z.object({ userId: z.string().uuid() })

router.post(
  '/bulk',
  requirePermission('user.update'),
  validateBody(bulkUsersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await bulkUserActions(getTenantId(req), req.body, auditMeta(req))
    sendSuccess(res, 'Bulk action applied', result)
  }),
)

router.get(
  '/:userId/overrides',
  requirePermission('user.view'),
  validateParams(userIdOnly),
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await listUserOverrides(getTenantId(req), getRouteParam(req, 'userId'))
    sendSuccess(res, 'Overrides retrieved', rows)
  }),
)

router.put(
  '/:userId/overrides',
  requirePermission('user.update'),
  validateParams(userIdOnly),
  validateBody(setOverrideSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const row = await upsertUserOverride(
      getTenantId(req),
      getRouteParam(req, 'userId'),
      req.body,
      auditMeta(req),
    )
    sendSuccess(res, 'Override saved', row)
  }),
)

router.delete(
  '/:userId/overrides/:permissionName',
  requirePermission('user.update'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await removeUserOverride(
      getTenantId(req),
      getRouteParam(req, 'userId'),
      decodeURIComponent(getRouteParam(req, 'permissionName')),
      auditMeta(req),
    )
    sendSuccess(res, 'Override removed', result)
  }),
)

router.post(
  '/:userId/copy-access/preview',
  requirePermission('user.view'),
  validateParams(userIdOnly),
  validateBody(z.object({ fromUserId: z.string().uuid() })),
  asyncHandler(async (req: Request, res: Response) => {
    const preview = await previewCopyAccess(
      getTenantId(req),
      getRouteParam(req, 'userId'),
      req.body.fromUserId,
    )
    sendSuccess(res, 'Copy preview', preview)
  }),
)

router.post(
  '/:userId/copy-access',
  requirePermission('user.assign_role'),
  validateParams(userIdOnly),
  validateBody(copyAccessSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applyCopyAccess(
      getTenantId(req),
      getRouteParam(req, 'userId'),
      req.body,
      auditMeta(req),
    )
    sendSuccess(res, 'Access copied', result)
  }),
)

router.patch(
  '/:userId/data-access-level',
  requirePermission('scope.manage'),
  validateParams(userIdOnly),
  validateBody(
    z.object({
      dataAccessLevel: z.enum([
        'OWN',
        'TEAM',
        'DEPARTMENT',
        'BRANCH',
        'LEGAL_ENTITY',
        'WAREHOUSE',
        'ALL',
      ]),
    }),
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await updateUserDataAccessLevel(
      getTenantId(req),
      getRouteParam(req, 'userId'),
      req.body.dataAccessLevel,
      auditMeta(req),
    )
    sendSuccess(res, 'Data access level updated', result)
  }),
)

router.get(
  '/:userId/approval-limits',
  requirePermission('user.view'),
  validateParams(userIdOnly),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req)
    const userId = getRouteParam(req, 'userId')
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: { userRoles: true },
    })
    if (!user) throw new NotFoundError('User not found')
    const roleIds = user.userRoles.map((r) => r.roleId)
    const rules = await prisma.approvalAuthorityRule.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        OR: [{ userId }, ...(roleIds.length ? [{ roleId: { in: roleIds } }] : [])],
      },
      orderBy: [{ documentType: 'asc' }, { amountFrom: 'asc' }],
    })
    sendSuccess(res, 'Approval limits', rules)
  }),
)

export default router
