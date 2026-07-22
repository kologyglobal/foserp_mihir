import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../utils/response.js'
import * as dashboard from './dashboard/dashboard.service.js'
import * as settings from './settings/settings.service.js'
import * as visitors from './visitors/visitors.service.js'
import * as vehicles from './vehicles/vehicles.service.js'
import * as inward from './material-inward/material-inward.service.js'
import * as outward from './material-outward/material-outward.service.js'
import * as passes from './passes/passes.service.js'
import * as contractors from './contractors/contractors.service.js'
import * as couriers from './couriers/couriers.service.js'
import * as approvals from './approvals/approvals.service.js'
import type { GateListFilter } from './shared/gate-shared.js'

const actor = (req: Request) => getContext(req).userId
const tenant = (req: Request) => getTenantId(req)
const id = (req: Request) => getRouteParam(req, 'id')

function filterFromQuery(req: Request): GateListFilter {
  const q = req.query as Record<string, string | undefined>
  return {
    search: q.search,
    status: q.status,
    gate: q.gate,
    company: q.company,
    date: q.date,
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    entryType: q.entryType,
    insideOnly: q.insideOnly === 'true',
    missingExitOnly: q.missingExitOnly === 'true',
    limit: q.limit ? Number(q.limit) : undefined,
  }
}

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate dashboard retrieved', await dashboard.getGateDashboard(tenant(req)))
})

export const getRegister = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate register retrieved', await dashboard.getGateRegister(tenant(req), filterFromQuery(req)))
})

export const getActivities = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20
  sendSuccess(res, 'Gate activities retrieved', await dashboard.getGateActivities(tenant(req), limit))
})

export const getLocations = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate locations retrieved', await settings.listGateLocations(tenant(req)))
})

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate settings retrieved', await settings.getGateSettings(tenant(req), actor(req)))
})

export const putSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate settings saved', await settings.updateGateSettings(tenant(req), actor(req), req.body))
})

export const listVisitors = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitors listed', await visitors.listVisitors(tenant(req), filterFromQuery(req)))
})

export const getVisitor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor retrieved', await visitors.getVisitorById(tenant(req), id(req)))
})

export const searchVisitor = asyncHandler(async (req: Request, res: Response) => {
  const mobile = String(req.query.mobile ?? '')
  sendSuccess(res, 'Visitor search completed', await visitors.searchVisitorByMobile(tenant(req), mobile))
})

export const createVisitor = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Visitor entry created', await visitors.createVisitorEntry(tenant(req), actor(req), req.body))
})

export const updateVisitor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor updated', await visitors.updateVisitorEntry(tenant(req), actor(req), id(req), req.body))
})

export const requestVisitorApproval = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor approval requested', await visitors.requestVisitorApproval(tenant(req), actor(req), id(req)))
})

export const approveVisitor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor approved', await visitors.approveVisitor(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const rejectVisitor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor rejected', await visitors.rejectVisitor(tenant(req), actor(req), id(req), req.body.remarks))
})

export const visitorEntry = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor entry recorded', await visitors.recordVisitorEntry(tenant(req), actor(req), id(req)))
})

export const visitorExit = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor exit recorded', await visitors.recordVisitorExit(tenant(req), actor(req), id(req), req.body))
})

export const cancelVisitor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Visitor cancelled', await visitors.cancelVisitor(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const listExpected = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Expected visitors listed', await visitors.listExpectedVisitors(tenant(req), filterFromQuery(req)))
})

export const createExpected = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Expected visitor created', await visitors.createExpectedVisitor(tenant(req), req.body))
})

export const cancelExpected = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Expected visitor cancelled', await visitors.cancelExpectedVisitor(tenant(req), id(req)))
})

export const listVehicles = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vehicles listed', await vehicles.listVehicles(tenant(req), filterFromQuery(req)))
})

export const getVehicle = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vehicle retrieved', await vehicles.getVehicleById(tenant(req), id(req)))
})

export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Vehicle entry created', await vehicles.createVehicleEntry(tenant(req), actor(req), req.body))
})

export const vehicleArrived = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vehicle marked arrived', await vehicles.markVehicleArrived(tenant(req), actor(req), id(req)))
})

export const vehicleAllowInside = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vehicle allowed inside', await vehicles.allowVehicleInside(tenant(req), actor(req), id(req)))
})

export const vehicleLocation = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Vehicle location updated',
    await vehicles.updateVehicleLocation(tenant(req), actor(req), id(req), req.body.location, req.body.status),
  )
})

export const vehicleReadyExit = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vehicle ready for exit', await vehicles.markVehicleReadyForExit(tenant(req), actor(req), id(req)))
})

export const vehicleExit = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vehicle exit recorded', await vehicles.recordVehicleExit(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const listInward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material inward listed', await inward.listMaterialInward(tenant(req), filterFromQuery(req)))
})

export const getInward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material inward retrieved', await inward.getMaterialInwardById(tenant(req), id(req)))
})

export const createInward = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Material inward created', await inward.createMaterialInward(tenant(req), actor(req), req.body))
})

export const inwardStatus = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Material inward status updated',
    await inward.updateMaterialInwardStatus(tenant(req), actor(req), id(req), req.body.status, req.body.note),
  )
})

export const cancelInward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material inward cancelled', await inward.cancelMaterialInward(tenant(req), actor(req), id(req), req.body.remarks))
})

export const listOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material outward listed', await outward.listMaterialOutward(tenant(req), filterFromQuery(req)))
})

export const getOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material outward retrieved', await outward.getMaterialOutwardById(tenant(req), id(req)))
})

export const searchOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Outward documents searched', await outward.searchOutwardDocuments(tenant(req), String(req.query.q ?? '')))
})

export const verifyOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material outward verified', await outward.verifyMaterialOutward(tenant(req), actor(req), id(req), req.body))
})

export const holdOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material outward held', await outward.holdMaterialOutward(tenant(req), actor(req), id(req), req.body.remarks))
})

export const mismatchOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material mismatch reported', await outward.reportMaterialMismatch(tenant(req), actor(req), id(req), req.body.remarks))
})

export const releaseOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material outward released', await outward.releaseMaterialOutward(tenant(req), actor(req), id(req)))
})

export const rejectOutward = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Material outward rejected', await outward.rejectMaterialOutward(tenant(req), actor(req), id(req), req.body.remarks))
})

export const listPasses = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate passes listed', await passes.listGatePasses(tenant(req), filterFromQuery(req)))
})

export const getPass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass retrieved', await passes.getGatePassById(tenant(req), id(req)))
})

export const createPass = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Gate pass created', await passes.createGatePass(tenant(req), actor(req), req.body))
})

export const submitPass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass submitted', await passes.submitGatePass(tenant(req), actor(req), id(req)))
})

export const approvePass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass approved', await passes.approveGatePass(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const rejectPass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass rejected', await passes.rejectGatePass(tenant(req), actor(req), id(req), req.body.remarks))
})

export const sentOutPass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass sent out', await passes.markGatePassSentOut(tenant(req), actor(req), id(req)))
})

export const returnPass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass return recorded', await passes.recordGatePassReturn(tenant(req), actor(req), id(req), req.body))
})

export const closePass = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate pass closed', await passes.closeGatePass(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const listContractors = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Contractors listed', await contractors.listContractors(tenant(req), filterFromQuery(req)))
})

export const getContractor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Contractor retrieved', await contractors.getContractorById(tenant(req), id(req)))
})

export const createContractor = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Contractor entry created', await contractors.createContractorEntry(tenant(req), actor(req), req.body))
})

export const contractorExit = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Contractor exit recorded', await contractors.recordContractorExit(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const listCouriers = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Couriers listed', await couriers.listCouriers(tenant(req), filterFromQuery(req)))
})

export const getCourier = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Courier retrieved', await couriers.getCourierById(tenant(req), id(req)))
})

export const createCourier = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, 'Courier entry created', await couriers.createCourierEntry(tenant(req), actor(req), req.body))
})

export const courierHandover = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Courier handed over', await couriers.markCourierHandedOver(tenant(req), actor(req), id(req), req.body.handedOverTo))
})

export const listApprovals = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate approvals listed', await approvals.listApprovals(tenant(req), filterFromQuery(req)))
})

export const getApproval = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate approval retrieved', await approvals.getApprovalById(tenant(req), id(req)))
})

export const approveRequest = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate request approved', await approvals.approveGateRequest(tenant(req), actor(req), id(req), req.body?.remarks))
})

export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate request rejected', await approvals.rejectGateRequest(tenant(req), actor(req), id(req), req.body.remarks))
})

export const sendBackRequest = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Gate request sent back', await approvals.sendBackGateRequest(tenant(req), actor(req), id(req), req.body.remarks))
})
