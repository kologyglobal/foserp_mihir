import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import * as ctrl from './gate.controller.js'
import {
  courierHandoverSchema,
  createContractorSchema,
  createCourierSchema,
  createExpectedVisitorSchema,
  createInwardSchema,
  createPassSchema,
  createVehicleSchema,
  createVisitorSchema,
  gateListFilterSchema,
  gateSettingsSchema,
  inwardStatusSchema,
  passReturnSchema,
  remarksBodySchema,
  requiredRemarksSchema,
  updateVisitorSchema,
  vehicleLocationSchema,
  verifyOutwardSchema,
  visitorExitSchema,
} from './shared/gate.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

// Dashboard & register
router.get('/dashboard', requirePermission('gate.dashboard.view'), ctrl.getDashboard)
router.get('/register', requirePermission('gate.register.view'), validateQuery(gateListFilterSchema), ctrl.getRegister)
router.get('/activities', requirePermission('gate.register.view'), validateQuery(gateListFilterSchema), ctrl.getActivities)
router.get('/locations', requirePermission('gate.dashboard.view'), ctrl.getLocations)

// Settings — GET readable by operators; PUT requires manage
router.get('/settings', requirePermission('gate.dashboard.view'), ctrl.getSettings)
router.put('/settings', requirePermission('gate.settings.manage'), validateBody(gateSettingsSchema), ctrl.putSettings)

// Visitors — search before :id
router.get('/visitors/search', requirePermission('gate.visitor.view'), validateQuery(gateListFilterSchema), ctrl.searchVisitor)
router.get('/visitors', requirePermission('gate.visitor.view'), validateQuery(gateListFilterSchema), ctrl.listVisitors)
router.post('/visitors', requirePermission('gate.visitor.create'), validateBody(createVisitorSchema), ctrl.createVisitor)
router.get('/visitors/:id', requirePermission('gate.visitor.view'), validateParams(uuidParamSchema), ctrl.getVisitor)
router.put('/visitors/:id', requirePermission('gate.visitor.edit'), validateParams(uuidParamSchema), validateBody(updateVisitorSchema), ctrl.updateVisitor)
router.post('/visitors/:id/request-approval', requirePermission('gate.visitor.approve'), validateParams(uuidParamSchema), ctrl.requestVisitorApproval)
router.post('/visitors/:id/approve', requirePermission('gate.visitor.approve'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.approveVisitor)
router.post('/visitors/:id/reject', requirePermission('gate.visitor.approve'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.rejectVisitor)
router.post('/visitors/:id/entry', requirePermission('gate.visitor.entry'), validateParams(uuidParamSchema), ctrl.visitorEntry)
router.post('/visitors/:id/exit', requirePermission('gate.visitor.exit'), validateParams(uuidParamSchema), validateBody(visitorExitSchema), ctrl.visitorExit)
router.post('/visitors/:id/cancel', requirePermission('gate.visitor.edit'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.cancelVisitor)

// Expected visitors
router.get('/expected-visitors', requirePermission('gate.visitor.view'), validateQuery(gateListFilterSchema), ctrl.listExpected)
router.post('/expected-visitors', requirePermission('gate.visitor.create'), validateBody(createExpectedVisitorSchema), ctrl.createExpected)
router.post('/expected-visitors/:id/cancel', requirePermission('gate.visitor.edit'), validateParams(uuidParamSchema), ctrl.cancelExpected)

// Vehicles
router.get('/vehicles', requirePermission('gate.vehicle.view'), validateQuery(gateListFilterSchema), ctrl.listVehicles)
router.post('/vehicles', requirePermission('gate.vehicle.create'), validateBody(createVehicleSchema), ctrl.createVehicle)
router.get('/vehicles/:id', requirePermission('gate.vehicle.view'), validateParams(uuidParamSchema), ctrl.getVehicle)
router.post('/vehicles/:id/arrived', requirePermission('gate.vehicle.entry'), validateParams(uuidParamSchema), ctrl.vehicleArrived)
router.post('/vehicles/:id/allow-inside', requirePermission('gate.vehicle.entry'), validateParams(uuidParamSchema), ctrl.vehicleAllowInside)
router.post('/vehicles/:id/location', requirePermission('gate.vehicle.edit'), validateParams(uuidParamSchema), validateBody(vehicleLocationSchema), ctrl.vehicleLocation)
router.post('/vehicles/:id/ready-exit', requirePermission('gate.vehicle.exit'), validateParams(uuidParamSchema), ctrl.vehicleReadyExit)
router.post('/vehicles/:id/exit', requirePermission('gate.vehicle.exit'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.vehicleExit)

// Material inward
router.get('/material-inward', requirePermission('gate.material_inward.view'), validateQuery(gateListFilterSchema), ctrl.listInward)
router.post('/material-inward', requirePermission('gate.material_inward.create'), validateBody(createInwardSchema), ctrl.createInward)
router.get('/material-inward/:id', requirePermission('gate.material_inward.view'), validateParams(uuidParamSchema), ctrl.getInward)
router.post('/material-inward/:id/status', requirePermission('gate.material_inward.edit'), validateParams(uuidParamSchema), validateBody(inwardStatusSchema), ctrl.inwardStatus)
router.post('/material-inward/:id/cancel', requirePermission('gate.material_inward.edit'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.cancelInward)

// Material outward — search before :id
router.get('/material-outward/search-documents', requirePermission('gate.material_outward.view'), validateQuery(gateListFilterSchema), ctrl.searchOutward)
router.get('/material-outward', requirePermission('gate.material_outward.view'), validateQuery(gateListFilterSchema), ctrl.listOutward)
router.get('/material-outward/:id', requirePermission('gate.material_outward.view'), validateParams(uuidParamSchema), ctrl.getOutward)
router.post('/material-outward/:id/verify', requirePermission('gate.material_outward.verify'), validateParams(uuidParamSchema), validateBody(verifyOutwardSchema), ctrl.verifyOutward)
router.post('/material-outward/:id/hold', requirePermission('gate.material_outward.verify'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.holdOutward)
router.post('/material-outward/:id/mismatch', requirePermission('gate.material_outward.verify'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.mismatchOutward)
router.post('/material-outward/:id/release', requirePermission('gate.material_outward.release'), validateParams(uuidParamSchema), ctrl.releaseOutward)
router.post('/material-outward/:id/reject', requirePermission('gate.material_outward.verify'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.rejectOutward)

// Gate passes
router.get('/passes', requirePermission('gate.pass.view'), validateQuery(gateListFilterSchema), ctrl.listPasses)
router.post('/passes', requirePermission('gate.pass.create'), validateBody(createPassSchema), ctrl.createPass)
router.get('/passes/:id', requirePermission('gate.pass.view'), validateParams(uuidParamSchema), ctrl.getPass)
router.post('/passes/:id/submit', requirePermission('gate.pass.edit'), validateParams(uuidParamSchema), ctrl.submitPass)
router.post('/passes/:id/approve', requirePermission('gate.pass.approve'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.approvePass)
router.post('/passes/:id/reject', requirePermission('gate.pass.approve'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.rejectPass)
router.post('/passes/:id/sent-out', requirePermission('gate.pass.edit'), validateParams(uuidParamSchema), ctrl.sentOutPass)
router.post('/passes/:id/returns', requirePermission('gate.pass.return'), validateParams(uuidParamSchema), validateBody(passReturnSchema), ctrl.returnPass)
router.post('/passes/:id/close', requirePermission('gate.pass.edit'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.closePass)

// Contractors
router.get('/contractors', requirePermission('gate.contractor.view'), validateQuery(gateListFilterSchema), ctrl.listContractors)
router.post('/contractors', requirePermission('gate.contractor.create'), validateBody(createContractorSchema), ctrl.createContractor)
router.get('/contractors/:id', requirePermission('gate.contractor.view'), validateParams(uuidParamSchema), ctrl.getContractor)
router.post('/contractors/:id/exit', requirePermission('gate.contractor.exit'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.contractorExit)

// Couriers
router.get('/couriers', requirePermission('gate.courier.view'), validateQuery(gateListFilterSchema), ctrl.listCouriers)
router.post('/couriers', requirePermission('gate.courier.create'), validateBody(createCourierSchema), ctrl.createCourier)
router.get('/couriers/:id', requirePermission('gate.courier.view'), validateParams(uuidParamSchema), ctrl.getCourier)
router.post('/couriers/:id/handover', requirePermission('gate.courier.handover'), validateParams(uuidParamSchema), validateBody(courierHandoverSchema), ctrl.courierHandover)

// Approvals
router.get('/approvals', requirePermission('gate.approval.view'), validateQuery(gateListFilterSchema), ctrl.listApprovals)
router.get('/approvals/:id', requirePermission('gate.approval.view'), validateParams(uuidParamSchema), ctrl.getApproval)
router.post('/approvals/:id/approve', requirePermission('gate.approval.action'), validateParams(uuidParamSchema), validateBody(remarksBodySchema), ctrl.approveRequest)
router.post('/approvals/:id/reject', requirePermission('gate.approval.action'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.rejectRequest)
router.post('/approvals/:id/send-back', requirePermission('gate.approval.action'), validateParams(uuidParamSchema), validateBody(requiredRemarksSchema), ctrl.sendBackRequest)

export default router
