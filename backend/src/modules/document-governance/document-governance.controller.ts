import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import { listDocumentTypes } from './document-registry.js'
import { documentGovernanceFeatureFlagStatus } from './feature-flag.js'
import * as govService from './document-governance.service.js'
import type {
  CreateDateControlInput,
  CreateProfileInput,
  ListDateControlsQuery,
  UpdateDateControlInput,
  UpdateProfileInput,
} from './document-governance.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function listDateControls(req: Request, res: Response): Promise<void> {
  const result = await govService.listDateControls(
    getTenantId(req),
    req.query as unknown as ListDateControlsQuery,
  )
  sendPaginated(res, 'Document date controls retrieved', result.items, result.meta)
}

export async function getDateControl(req: Request, res: Response): Promise<void> {
  const item = await govService.getDateControl(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Document date control retrieved', item)
}

export async function createDateControl(req: Request, res: Response): Promise<void> {
  const item = await govService.createDateControl(
    getTenantId(req),
    req.body as CreateDateControlInput,
    auditMeta(req),
  )
  sendCreated(res, 'Document date control created', item)
}

export async function updateDateControl(req: Request, res: Response): Promise<void> {
  const item = await govService.updateDateControl(
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as UpdateDateControlInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Document date control updated', item)
}

export async function activateDateControl(req: Request, res: Response): Promise<void> {
  const item = await govService.activateDateControl(
    getTenantId(req),
    getRouteParam(req, 'id'),
    auditMeta(req),
  )
  sendSuccess(res, 'Document date control activated', item)
}

export async function deactivateDateControl(req: Request, res: Response): Promise<void> {
  const item = await govService.deactivateDateControl(
    getTenantId(req),
    getRouteParam(req, 'id'),
    auditMeta(req),
  )
  sendSuccess(res, 'Document date control deactivated', item)
}

export async function resetDateControl(req: Request, res: Response): Promise<void> {
  const item = await govService.resetDateControlToCurrentBehaviour(
    getTenantId(req),
    getRouteParam(req, 'id'),
    auditMeta(req),
  )
  sendSuccess(res, 'Document date control reset to current behaviour', item)
}

export async function listDocumentTypesHandler(req: Request, res: Response): Promise<void> {
  const moduleKey = typeof req.query.moduleKey === 'string' ? req.query.moduleKey : undefined
  sendSuccess(res, 'Document types retrieved', {
    items: listDocumentTypes(moduleKey),
    featureFlag: documentGovernanceFeatureFlagStatus(),
  })
}

export async function listProfiles(req: Request, res: Response): Promise<void> {
  const items = await govService.listProfiles(getTenantId(req))
  sendSuccess(res, 'Document governance profiles retrieved', items)
}

export async function createProfile(req: Request, res: Response): Promise<void> {
  const item = await govService.createProfile(
    getTenantId(req),
    req.body as CreateProfileInput,
    auditMeta(req),
  )
  sendCreated(res, 'Profile created', item)
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const item = await govService.updateProfile(
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body as UpdateProfileInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Profile updated', item)
}

export async function featureFlagStatus(req: Request, res: Response): Promise<void> {
  sendSuccess(res, 'Feature flag status', documentGovernanceFeatureFlagStatus())
}
