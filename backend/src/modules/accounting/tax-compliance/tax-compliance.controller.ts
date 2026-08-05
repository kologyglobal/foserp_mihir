import type { Request, Response } from 'express'
import type { GstrReturnType } from '@prisma/client'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendSuccess } from '../../../utils/response.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import * as einvoiceService from './einvoice.service.js'
import * as ewayBillService from './eway-bill.service.js'
import * as gstExtractService from './gst-extract.service.js'
import * as gstLedgerService from './gst-ledger.service.js'
import * as gstRcmService from './gst-rcm.service.js'
import * as gstRegistersService from './gst-registers.service.js'
import * as gstrReturnService from './gstr-return.service.js'
import * as gstr2bImportService from './gstr2b-import.service.js'
import * as gstr2bReconcileService from './gstr2b-reconcile.service.js'
import * as gstPaymentService from './gst-payment.service.js'
import * as gstRegistrationService from './gst-registration.service.js'
import * as gstExportLutService from './gst-export-lut.service.js'
import * as gstSpecialsService from './gst-specials.service.js'
import * as gstrPortalFilingService from './gstr-portal-filing.service.js'
import * as gstAnnualService from './gst-annual.service.js'
import * as gstComplianceOpsService from './gst-compliance-ops.service.js'
import * as gstRateOpsService from './gst-rate-ops.service.js'
import * as gstDataQualityService from './gst-data-quality.service.js'
import * as gstGlReconService from './gst-gl-recon.service.js'
import * as gstHardeningService from './gst-compliance-hardening.service.js'
import type {
  CancelGstDocumentInput,
  EWayPanelQueryInput,
  GenerateEInvoiceInput,
  GenerateEWayBillInput,
  GstExtractQueryInput,
  GstLedgerQueryInput,
  GstRegisterQueryInput,
  GstSummaryQueryInput,
  Gstr2bImportBatchInput,
  Gstr2bListBatchesQueryInput,
  Gstr2bListFollowUpsQueryInput,
  Gstr2bListRowsQueryInput,
  Gstr2bReconcileBatchInput,
  Gstr2bUpdateFollowUpInput,
  Gstr2bVoidBatchInput,
  GstrReturnActionBodyInput,
  GstrReturnMarkFiledBodyInput,
  GstrReturnPeriodQueryInput,
  GstrReturnPrepQueryInput,
  GstrReturnUnlockBodyInput,
  ListGstDocumentQueryInput,
  MarkRcmItcNotClaimableInput,
  MarkRcmLiabilityPaidInput,
  RecognizeRcmItcInput,
  RcmRegisterQueryInput,
  UpdateEWayVehicleInput,
  ExtendEWayBillInput,
  GstPaymentListQueryInput,
  GstPaymentProposeInput,
  GstPaymentConfirmInput,
  GstPaymentPostGlInput,
  GstPaymentVoidInput,
  GstRegistrationListQueryInput,
  GstRegistrationUpsertInput,
  GstBranchTransferPolicyInput,
  GstBranchTransferEvalInput,
  GstIsolationStatusQueryInput,
  GstLutListQueryInput,
  GstLutUpsertInput,
  GstExportValidateInput,
  GstExportRegisterQueryInput,
  GstExportRefundListQueryInput,
  GstExportRefundProposeInput,
  GstExportRefundSubmitInput,
  GstSpecialsNilRegisterQueryInput,
  GstClassifyBodyInput,
  GstJobWorkEvalBodyInput,
  GstWithholdingListQueryInput,
  GstWithholdingCreateInput,
  GstWithholdingMarkPaidInput,
  GstWithholdingVoidInput,
  GstAdvanceListQueryInput,
  GstAdvanceCreateInput,
  GstAdvanceAdjustInput,
  GstCompositionGatesQueryInput,
  GstrFilingListQueryInput,
  GstrFilingCreatePackageInput,
  GstrFilingCaptureArnInput,
  GstrFilingMarkFiledInput,
  GstrFilingCheckerInput,
  GstAnnualListQueryInput,
  GstAnnualGetQueryInput,
  GstAnnualPrepareBodyInput,
  GstAnnualActionBodyInput,
  GstAnnualUnlockBodyInput,
  GstAnnualMarkFiledBodyInput,
  GstCockpitQueryInput,
  GstFyArchiveListQueryInput,
  GstFyArchiveBodyInput,
  GstComplianceCockpitQueryInput,
  GstMultiPeriodHealthQueryInput,
  GstGstr9AnnualQueryInput,
  GstAuditPackListQueryInput,
  GstAuditPackCreateInput,
  GstAuditPackVoidInput,
  GstComplianceNoticeListQueryInput,
  GstComplianceNoticeCreateInput,
  GstComplianceNoticeUpdateInput,
  GstRateOpsReportQueryInput,
  GstRateOpsDriftQueryInput,
  GstRateOpsRunCreateInput,
  GstRateOpsRunListQueryInput,
  GstRateOpsAckInput,
  GstDataQualityPeriodQueryInput,
  GstDataQualityBackfillInput,
  GstDataQualityRunCreateInput,
  GstDataQualityRunListQueryInput,
  GstDataQualityAckInput,
  GstGlReconQueryInput,
  GstGlReconRunCreateInput,
  GstGlReconRunListQueryInput,
  GstGlReconAckInput,
  GstHardeningPeriodQueryInput,
  GstGoLiveGateQueryInput,
  GstUatSignOffListQueryInput,
  GstUatSignOffCreateInput,
  GstUatSignOffUpdateInput,
  GstUatSignOffRevokeInput,
} from './tax-compliance.schemas.js'

function normalizeReturnType(raw: string): GstrReturnType {
  const u = raw.toUpperCase().replace(/-/g, '')
  if (u === 'GSTR1') return 'GSTR1'
  if (u === 'GSTR3B') return 'GSTR3B'
  throw new Error(`Unsupported return type: ${raw}`)
}

export const listOutwardSupplies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstExtractQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstExtractService.listOutwardSupplies({
    tenantId,
    legalEntityId: query.legalEntityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  })

  return sendSuccess(
    res,
    'outward supplies extract fetched',
    {
      fromDate: query.fromDate,
      toDate: query.toDate,
      legalEntityId: query.legalEntityId,
      items: result.items,
      summary: result.summary,
    },
    200,
    buildPaginationMeta(result.total, query.page, query.pageSize),
  )
})

export const listInwardSupplies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstExtractQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstExtractService.listInwardSupplies({
    tenantId,
    legalEntityId: query.legalEntityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  })

  return sendSuccess(
    res,
    'inward supplies extract fetched',
    {
      fromDate: query.fromDate,
      toDate: query.toDate,
      legalEntityId: query.legalEntityId,
      items: result.items,
      summary: result.summary,
    },
    200,
    buildPaginationMeta(result.total, query.page, query.pageSize),
  )
})

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstSummaryQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstExtractService.getGstComplianceSummary({
    tenantId,
    legalEntityId: query.legalEntityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
  })

  return sendSuccess(res, 'GST compliance summary fetched', {
    fromDate: query.fromDate,
    toDate: query.toDate,
    legalEntityId: query.legalEntityId,
    outward: result.outward,
    inward: result.inward,
  })
})

/** Phase 2 — line-level GST subledger (posted document tax snapshots). */
export const listGstLedger = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstLedgerQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstLedgerService.listGstLedgerEntries({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    fromDate: query.fromDate,
    toDate: query.toDate,
    direction: query.direction,
    page: query.page,
    pageSize: query.pageSize,
  })

  return sendSuccess(
    res,
    'GST ledger fetched',
    {
      legalEntityId: query.legalEntityId,
      returnPeriod: query.returnPeriod ?? null,
      items: result.items,
    },
    200,
    buildPaginationMeta(result.total, query.page, query.pageSize),
  )
})

export const listEInvoices = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListGstDocumentQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await einvoiceService.listEInvoices(req, tenantId, query)
  return sendSuccess(
    res,
    'e-invoices fetched',
    { items: result.items, providerMode: result.providerMode },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getEInvoiceProviderStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = einvoiceService.getEInvoiceProviderStatus(req)
  return sendSuccess(res, 'e-invoice provider status', status)
})

export const getEInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await einvoiceService.getEInvoice(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'e-invoice fetched', item)
})

export const generateEInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GenerateEInvoiceInput
  const result = await einvoiceService.generateEInvoice(req, tenantId, body)
  return sendSuccess(
    res,
    result.idempotentReplay ? 'e-invoice already generated' : 'e-invoice generated',
    result,
    result.idempotentReplay ? 200 : 201,
  )
})

export const cancelEInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as CancelGstDocumentInput
  const item = await einvoiceService.cancelEInvoice(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'e-invoice cancelled', item)
})

export const listEWayBills = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListGstDocumentQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await ewayBillService.listEWayBills(req, tenantId, query)
  return sendSuccess(
    res,
    'e-way bills fetched',
    { items: result.items, providerMode: result.providerMode },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getEWayProviderStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = ewayBillService.getEWayProviderStatus(req)
  return sendSuccess(res, 'e-way provider status', status)
})

export const getEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await ewayBillService.getEWayBill(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'e-way bill fetched', item)
})

export const generateEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GenerateEWayBillInput
  const result = await ewayBillService.generateEWayBill(req, tenantId, body)
  return sendSuccess(
    res,
    result.idempotentReplay ? 'e-way bill already generated' : 'e-way bill generated',
    result,
    result.idempotentReplay ? 200 : 201,
  )
})

export const cancelEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as CancelGstDocumentInput
  const item = await ewayBillService.cancelEWayBill(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'e-way bill cancelled', item)
})

export const getEWayPanel = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as EWayPanelQueryInput
  const panel = await ewayBillService.getEWayPanel(req, tenantId, query)
  return sendSuccess(res, 'e-way bill panel', panel)
})

export const updateEWayVehicle = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as UpdateEWayVehicleInput
  const item = await ewayBillService.updateEWayVehicle(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'e-way bill vehicle updated', item)
})

export const extendEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as ExtendEWayBillInput
  const item = await ewayBillService.extendEWayBill(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'e-way bill validity extended', item)
})

// ─── Phase 4 — Reverse charge register ───────────────────────────────────────

export const listRcmRegister = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as RcmRegisterQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await gstRcmService.listRcmRegister({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    fromDate: query.fromDate,
    toDate: query.toDate,
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  })
  return sendSuccess(
    res,
    'RCM register fetched',
    {
      legalEntityId: query.legalEntityId,
      returnPeriod: query.returnPeriod ?? null,
      items: result.items,
      disclaimer:
        'RCM liability payment confirmation is a compliance gate. Full GST cash-ledger / PMT-06 posting is Phase 8. INPUT tax may already be in GL from concurrent VIP post.',
    },
    200,
    buildPaginationMeta(result.total, query.page, query.pageSize),
  )
})

export const markRcmLiabilityPaid = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = req.body as MarkRcmLiabilityPaidInput
  const item = await gstRcmService.markRcmLiabilityPaid({
    tenantId,
    id: String(req.params.id),
    userId,
    liabilityPaidDate: body.liabilityPaidDate,
    liabilityPaymentRef: body.liabilityPaymentRef,
    notes: body.notes,
  })
  return sendSuccess(res, 'RCM liability marked paid', item)
})

export const recognizeRcmItc = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = (req.body ?? {}) as RecognizeRcmItcInput
  const item = await gstRcmService.recognizeRcmItc({
    tenantId,
    id: String(req.params.id),
    userId,
    notes: body.notes,
  })
  return sendSuccess(res, 'RCM ITC recognized on register', item)
})

export const markRcmItcNotClaimable = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = (req.body ?? {}) as MarkRcmItcNotClaimableInput
  const item = await gstRcmService.markRcmItcNotClaimable({
    tenantId,
    id: String(req.params.id),
    userId,
    notes: body.notes,
  })
  return sendSuccess(res, 'RCM ITC marked not claimable', item)
})

// ─── Phase 3 — GSTR-2B / ITC ────────────────────────────────────────────────

export const importGstr2bBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = req.body as Gstr2bImportBatchInput
  const result = await gstr2bImportService.importGstr2bBatch({ tenantId, userId, input: body })
  return sendSuccess(res, 'GSTR-2B batch imported', result, 201)
})

export const listGstr2bBatches = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as Gstr2bListBatchesQueryInput
  const result = await gstr2bImportService.listGstr2bBatches({ tenantId, query })
  return sendSuccess(
    res,
    'GSTR-2B batches fetched',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getGstr2bBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const batch = await gstr2bImportService.getGstr2bBatch({
    tenantId,
    batchId: String(req.params.batchId),
  })
  return sendSuccess(res, 'GSTR-2B batch fetched', batch)
})

export const voidGstr2bBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = req.body as Gstr2bVoidBatchInput
  const batch = await gstr2bImportService.voidGstr2bBatch({
    tenantId,
    userId,
    batchId: String(req.params.batchId),
    input: body,
  })
  return sendSuccess(res, 'GSTR-2B batch voided', batch)
})

export const listGstr2bRows = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as Gstr2bListRowsQueryInput
  const result = await gstr2bImportService.listGstr2bRows({
    tenantId,
    batchId: String(req.params.batchId),
    query,
  })
  return sendSuccess(
    res,
    'GSTR-2B rows fetched',
    { batchId: result.batchId, status: result.status, items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const reconcileGstr2bBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = (req.body ?? {}) as Gstr2bReconcileBatchInput
  const result = await gstr2bReconcileService.reconcileGstr2bBatch({
    tenantId,
    userId,
    batchId: String(req.params.batchId),
    openFollowUps: body.openFollowUps,
  })
  return sendSuccess(res, 'GSTR-2B batch reconciled', result)
})

export const getGstr2bReconSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const summary = await gstr2bReconcileService.getGstr2bReconSummary({
    tenantId,
    batchId: String(req.params.batchId),
  })
  return sendSuccess(res, 'GSTR-2B recon summary', summary)
})

export const listGstr2bFollowUps = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as Gstr2bListFollowUpsQueryInput
  const result = await gstr2bReconcileService.listGstr2bFollowUps({ tenantId, query })
  return sendSuccess(
    res,
    'GSTR-2B follow-ups fetched',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const updateGstr2bFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = req.context?.userId
  if (!userId) throw new Error('User context required')
  const body = req.body as Gstr2bUpdateFollowUpInput
  const item = await gstr2bReconcileService.updateGstr2bFollowUp({
    tenantId,
    userId,
    followUpId: String(req.params.followUpId),
    input: body,
  })
  return sendSuccess(res, 'GSTR-2B follow-up updated', item)
})

// ─── Phase 5 — Registers & GSTR preparation ──────────────────────────────────

export const getGstRegister = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstRegisterQueryInput
  const data = await gstRegistersService.getGstRegister({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    companyGstin: query.companyGstin,
    kind: query.kind,
  })
  return sendSuccess(res, 'GST register prepared', data)
})

export const listGstrReturnPeriods = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstrReturnPeriodQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const items = await gstrReturnService.listReturnPeriods({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    companyGstin: query.companyGstin,
  })
  return sendSuccess(res, 'GSTR return periods listed', { items })
})

export const getGstrReturnPrep = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstrReturnPrepQueryInput
  const returnType = normalizeReturnType(String(req.params.returnType))
  const data = await gstrReturnService.getReturnPrep({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    returnType,
    companyGstin: query.companyGstin,
  })
  return sendSuccess(res, 'GSTR return preparation fetched', data)
})

export const prepareGstrReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrReturnActionBodyInput
  const returnType = normalizeReturnType(String(req.params.returnType))
  const data = await gstrReturnService.prepareReturn({
    tenantId,
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    returnType,
    companyGstin: body.companyGstin,
    actorUserId: req.context?.userId,
  })
  return sendSuccess(res, 'GSTR return prepared (DRAFT)', data)
})

export const lockGstrReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrReturnActionBodyInput
  const returnType = normalizeReturnType(String(req.params.returnType))
  const data = await gstrReturnService.lockReturn({
    tenantId,
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    returnType,
    companyGstin: body.companyGstin,
    actorUserId: req.context?.userId,
  })
  return sendSuccess(res, 'GSTR return locked', data)
})

export const unlockGstrReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrReturnUnlockBodyInput
  const returnType = normalizeReturnType(String(req.params.returnType))
  const data = await gstrReturnService.unlockReturn({
    tenantId,
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    returnType,
    companyGstin: body.companyGstin,
    actorUserId: req.context?.userId,
    reason: body.reason,
  })
  return sendSuccess(res, 'GSTR return unlocked', data)
})

export const markGstrReturnFiledExternal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrReturnMarkFiledBodyInput
  const returnType = normalizeReturnType(String(req.params.returnType))
  const data = await gstrReturnService.markFiledExternally({
    tenantId,
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    returnType,
    companyGstin: body.companyGstin,
    actorUserId: req.context?.userId,
    acknowledgmentRef: body.acknowledgmentRef,
    filedOnPortalDate: body.filedOnPortalDate,
    remarks: body.remarks,
  })
  return sendSuccess(res, 'GSTR return marked filed externally (not submitted by FOS)', data)
})

// ─── Phase 12 — Portal filing ────────────────────────────────────────────────

function normalizeFilingReturnType(raw: string): 'GSTR1' | 'GSTR3B' {
  return normalizeReturnType(raw)
}

export const getGstrFilingCapability = asyncHandler(async (req: Request, res: Response) => {
  const data = gstrPortalFilingService.getFilingCapability(req)
  return sendSuccess(res, 'GSTR portal filing capability', data)
})

export const listGstrFilingSessions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstrFilingListQueryInput
  const returnType = query.returnType
    ? normalizeFilingReturnType(query.returnType)
    : undefined
  const result = await gstrPortalFilingService.listFilingSessions(req, tenantId, {
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    companyGstin: query.companyGstin,
    returnType,
    page: query.page,
    pageSize: query.pageSize,
  })
  return sendSuccess(
    res,
    'GSTR filing sessions fetched',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getGstrFilingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstrPortalFilingService.getFilingSession(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'GSTR filing session fetched', item)
})

export const createGstrFilingPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrFilingCreatePackageInput
  const item = await gstrPortalFilingService.createFilingPackage(req, tenantId, {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    returnType: normalizeFilingReturnType(body.returnType),
    companyGstin: body.companyGstin,
    requireChecker: body.requireChecker,
    remarks: body.remarks,
  })
  return sendSuccess(res, 'GSTR filing package created (from locked Phase 5 snapshot)', item, 201)
})

export const approveGstrFilingChecker = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrFilingCheckerInput
  const item = await gstrPortalFilingService.approveChecker(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GSTR filing checker approved', item)
})

export const submitGstrFilingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstrPortalFilingService.submitFiling(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'GSTR filing submit processed (SIMULATED or LIVE-gated)', item)
})

export const captureGstrFilingArn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrFilingCaptureArnInput
  const item = await gstrPortalFilingService.captureArn(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GSTR filing ARN captured', item)
})

export const markGstrFilingFiled = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstrFilingMarkFiledInput
  const item = await gstrPortalFilingService.markFiledFromSession(
    req,
    tenantId,
    String(req.params.id),
    body,
  )
  return sendSuccess(res, 'Return marked filed via filing session (Phase 5 lock path)', item)
})

// ─── Phase 8 — GST payment challans ──────────────────────────────────────────

export const listGstPaymentChallans = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstPaymentListQueryInput
  const result = await gstPaymentService.listPaymentChallans(req, tenantId, query)
  return sendSuccess(
    res,
    'GST payment challans fetched',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getGstPaymentChallan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstPaymentService.getPaymentChallan(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'GST payment challan fetched', item)
})

export const previewGstPaymentLiability = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstPaymentProposeInput
  const data = await gstPaymentService.previewLiability(req, tenantId, {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    companyGstin: body.companyGstin ?? undefined,
    interestAmount: body.interestAmount,
    lateFeeAmount: body.lateFeeAmount,
    roundOffAmount: body.roundOffAmount,
  })
  return sendSuccess(res, 'GST liability proposal preview', data)
})

export const proposeGstPaymentChallan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstPaymentProposeInput
  const item = await gstPaymentService.proposePaymentChallan(req, tenantId, {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    companyGstin: body.companyGstin ?? undefined,
    interestAmount: body.interestAmount,
    lateFeeAmount: body.lateFeeAmount,
    roundOffAmount: body.roundOffAmount,
    remarks: body.remarks ?? undefined,
  })
  return sendSuccess(res, 'GST payment challan proposed', item, 201)
})

export const confirmGstPaymentExternal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstPaymentConfirmInput
  const item = await gstPaymentService.confirmPaymentExternal(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GST payment confirmed externally (CPIN/CIN not portal-generated)', item)
})

export const postGstPaymentGl = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstPaymentPostGlInput
  const item = await gstPaymentService.postPaymentToGl(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GST payment posted to GL via central posting engine', item)
})

export const closeGstPaymentPeriod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstPaymentService.closePaymentPeriod(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'GST payment period closed', item)
})

export const voidGstPaymentChallan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstPaymentVoidInput
  const item = await gstPaymentService.voidPaymentChallan(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GST payment challan voided', item)
})

// ─── Phase 9 — Multi-GSTIN ───────────────────────────────────────────────────

export const listGstRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstRegistrationListQueryInput
  const data = await gstRegistrationService.listGstRegistrations(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'GST registrations fetched', data)
})

export const upsertGstRegistration = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstRegistrationUpsertInput
  const item = await gstRegistrationService.upsertGstRegistration(req, tenantId, body)
  return sendSuccess(res, 'GST registration upserted', item, 201)
})

export const updateBranchTransferPolicy = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstBranchTransferPolicyInput
  const item = await gstRegistrationService.updateBranchTransferPolicy(
    req,
    tenantId,
    body.legalEntityId,
    body.policy,
  )
  return sendSuccess(res, 'Branch transfer tax policy updated', item)
})

export const evaluateBranchTransfer = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstBranchTransferEvalInput
  const data = await gstRegistrationService.evaluateBranchTransfer(req, tenantId, body)
  return sendSuccess(res, 'Branch transfer tax evaluation', data)
})

export const getGstIsolationStatus = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstIsolationStatusQueryInput
  const data = await gstRegistrationService.isolationStatus(
    req,
    tenantId,
    query.legalEntityId,
    query.returnPeriod,
  )
  return sendSuccess(res, 'GSTIN isolation status', data)
})

// ─── Phase 10 — Export / SEZ / LUT ───────────────────────────────────────────

export const listGstLuts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstLutListQueryInput
  const data = await gstExportLutService.listLuts(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'GST LUTs fetched', data)
})

export const upsertGstLut = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstLutUpsertInput
  const item = await gstExportLutService.upsertLut(req, tenantId, body)
  return sendSuccess(res, 'LUT saved', item, 201)
})

export const validateExportSupply = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstExportValidateInput
  const data = await gstExportLutService.validateExportSupply(req, tenantId, body)
  return sendSuccess(res, 'Export/SEZ supply validation', data)
})

export const listExportSezRegister = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstExportRegisterQueryInput
  const data = await gstExportLutService.listExportSezRegister(req, tenantId, query)
  return sendSuccess(res, 'Export/SEZ register', data)
})

export const listExportRefundClaims = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstExportRefundListQueryInput
  const data = await gstExportLutService.listRefundClaims(
    req,
    tenantId,
    query.legalEntityId,
    query.returnPeriod,
  )
  return sendSuccess(res, 'Export refund claims', data)
})

export const proposeExportRefundClaim = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstExportRefundProposeInput
  const item = await gstExportLutService.proposeRefundClaim(req, tenantId, body)
  return sendSuccess(res, 'Export refund claim proposed from ledger', item, 201)
})

export const markExportRefundSubmitted = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstExportRefundSubmitInput
  const item = await gstExportLutService.markRefundClaimSubmitted(
    req,
    tenantId,
    String(req.params.id),
    body,
  )
  return sendSuccess(res, 'Export refund marked submitted externally', item)
})

// ─── Phase 11 — Specials ────────────────────────────────────────────────────

export const getSpecialsCapabilityMatrix = asyncHandler(async (req: Request, res: Response) => {
  const data = gstSpecialsService.getCapabilityMatrix(req)
  return sendSuccess(res, 'GST Phase 11 capability matrix (not FULL GST COMPLIANT)', data)
})

export const getCompositionGates = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstCompositionGatesQueryInput
  const data = await gstSpecialsService.getCompositionGates(req, tenantId, query.legalEntityId)
  return sendSuccess(res, 'Composition feature gates', data)
})

export const classifyGstSupplySpecial = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as GstClassifyBodyInput
  const data = gstSpecialsService.classifySupplyBody(req, body)
  return sendSuccess(res, 'Supply classification', data)
})

export const evaluateJobWorkGst = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as GstJobWorkEvalBodyInput
  const data = gstSpecialsService.evaluateJobWorkBody(req, body)
  return sendSuccess(res, 'Job-work GST evaluation (boundary notes only)', data)
})

export const listNilExemptRegister = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstSpecialsNilRegisterQueryInput
  const result = await gstSpecialsService.listNilExemptRegister(req, tenantId, query)
  return sendSuccess(res, 'Nil/exempt/non-GST ledger register', result, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const listGstWithholding = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstWithholdingListQueryInput
  const result = await gstSpecialsService.listWithholding(req, tenantId, query)
  return sendSuccess(res, 'GST TDS/TCS books register', result)
})

export const createGstWithholding = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstWithholdingCreateInput
  const item = await gstSpecialsService.createWithholding(req, tenantId, body)
  return sendSuccess(res, 'GST withholding liability recorded (books-side)', item, 201)
})

export const markGstWithholdingPaid = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstWithholdingMarkPaidInput
  const item = await gstSpecialsService.markWithholdingPaid(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GST withholding marked paid', item)
})

export const voidGstWithholding = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstWithholdingVoidInput
  const item = await gstSpecialsService.voidWithholding(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GST withholding voided', item)
})

export const listGstAdvances = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstAdvanceListQueryInput
  const result = await gstSpecialsService.listAdvances(req, tenantId, query)
  return sendSuccess(res, 'GST advance register', result)
})

export const createGstAdvance = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAdvanceCreateInput
  const item = await gstSpecialsService.createAdvance(req, tenantId, body)
  return sendSuccess(res, 'GST advance recorded (books-side prep)', item, 201)
})

export const adjustGstAdvance = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAdvanceAdjustInput
  const result = await gstSpecialsService.adjustAdvance(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'Advance adjusted against invoice', result)
})

export const closeGstAdvance = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstSpecialsService.closeAdvance(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'GST advance closed', item)
})

// ─── Phase 13 — go-live UAT / period readiness ────────────────────────────────

export const getHardeningCapabilityMatrix = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, 'GST Phase 13 capability matrix', gstHardeningService.getReadinessMatrix())
})

export const getPeriodComplianceHealth = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstHardeningPeriodQueryInput
  const data = await gstHardeningService.getPeriodHealth({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    companyGstin: query.companyGstin,
  })
  return sendSuccess(res, 'GST period books readiness', data)
})

export const getPeriodComplianceReconcile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstHardeningPeriodQueryInput
  const data = await gstHardeningService.getPeriodReconcile({
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    companyGstin: query.companyGstin,
  })
  return sendSuccess(res, 'GST period books reconciliation', data)
})

export const getGstGoLiveGate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstGoLiveGateQueryInput
  const data = await gstHardeningService.getGoLiveGate({
    tenantId,
    legalEntityId: query.legalEntityId,
    companyGstin: query.companyGstin,
  })
  return sendSuccess(res, 'GST go-live / UAT gate', data)
})

export const listUatSignOffs = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstUatSignOffListQueryInput
  const data = await gstHardeningService.listUatSignOffs({
    tenantId,
    legalEntityId: query.legalEntityId,
    companyGstin: query.companyGstin,
  })
  return sendSuccess(res, 'UAT sign-off register', data)
})

export const createUatSignOff = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstUatSignOffCreateInput
  const item = await gstHardeningService.createUatSignOff({
    tenantId,
    legalEntityId: body.legalEntityId,
    companyGstin: body.companyGstin,
    checklist: body.checklist,
    notes: body.notes,
    userId: req.context?.user?.id ?? null,
  })
  return sendSuccess(res, 'UAT sign-off draft created', item, 201)
})

export const updateUatSignOff = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstUatSignOffUpdateInput
  const item = await gstHardeningService.updateUatSignOffChecklist({
    tenantId,
    id: String(req.params.id),
    checklist: body.checklist,
    notes: body.notes,
    userId: req.context?.user?.id ?? null,
  })
  return sendSuccess(res, 'UAT checklist updated', item)
})

export const submitUatSignOff = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstHardeningService.submitUatSignOff({
    tenantId,
    id: String(req.params.id),
    userId: req.context?.user?.id ?? null,
  })
  return sendSuccess(res, 'UAT sign-off submitted for checker', item)
})

export const approveUatSignOff = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstHardeningService.approveUatSignOff({
    tenantId,
    id: String(req.params.id),
    userId: req.context?.user?.id ?? null,
  })
  return sendSuccess(res, 'UAT sign-off approved (still not FULL GST COMPLIANT)', item)
})

export const revokeUatSignOff = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstUatSignOffRevokeInput
  const item = await gstHardeningService.revokeUatSignOff({
    tenantId,
    id: String(req.params.id),
    reason: body.reason,
    userId: req.context?.user?.id ?? null,
  })
  return sendSuccess(res, 'UAT sign-off revoked', item)
})

// ─── Phase 14 — Annual worksheet + FY archive ────────────────────────────────

export const getPhase14CapabilityMatrix = asyncHandler(async (req: Request, res: Response) => {
  const data = gstAnnualService.getPhase14CapabilityMatrix(req)
  return sendSuccess(res, 'GST Phase 14 capability matrix (not FULL GST COMPLIANT)', data)
})

export const listGstAnnualReturns = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstAnnualListQueryInput
  const result = await gstAnnualService.listAnnualReturns(req, tenantId, query)
  return sendSuccess(res, 'GST annual returns', result)
})

export const getGstAnnualReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstAnnualGetQueryInput
  const result = await gstAnnualService.getAnnualReturn(req, tenantId, query)
  return sendSuccess(res, 'GST annual return', result)
})

export const prepareGstAnnualReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAnnualPrepareBodyInput
  const item = await gstAnnualService.prepareAnnualReturn(req, tenantId, body)
  return sendSuccess(res, 'GSTR-9 annual worksheet prepared (books-side)', item, 201)
})

export const lockGstAnnualReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAnnualActionBodyInput
  const item = await gstAnnualService.lockAnnualReturn(req, tenantId, body)
  return sendSuccess(res, 'Annual return locked', item)
})

export const unlockGstAnnualReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAnnualUnlockBodyInput
  const item = await gstAnnualService.unlockAnnualReturn(req, tenantId, body)
  return sendSuccess(res, 'Annual return unlocked', item)
})

export const markGstAnnualFiledExternal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAnnualMarkFiledBodyInput
  const item = await gstAnnualService.markAnnualFiledExternal(req, tenantId, body)
  return sendSuccess(res, 'Annual return marked filed externally', item)
})

export const archiveGstAnnualReturn = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAnnualActionBodyInput
  const item = await gstAnnualService.archiveAnnualReturn(req, tenantId, body)
  return sendSuccess(res, 'Annual return archived', item)
})

export const getAnnualFyCockpit = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstCockpitQueryInput
  const result = await gstAnnualService.getAnnualFyCockpit(req, tenantId, query)
  return sendSuccess(res, 'GST annual FY cockpit (books-side)', result)
})

export const listGstFyArchives = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstFyArchiveListQueryInput
  const result = await gstAnnualService.listFyArchives(req, tenantId, query)
  return sendSuccess(res, 'GST FY archives', result)
})

export const archiveGstFinancialYear = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstFyArchiveBodyInput
  const item = await gstAnnualService.archiveFinancialYear(req, tenantId, body)
  return sendSuccess(res, 'Financial year archived (retention marker)', item, 201)
})

// ─── Phase 15 — Compliance ops ───────────────────────────────────────────────

export const getOpsCapabilityMatrix = asyncHandler(async (req: Request, res: Response) => {
  const result = gstComplianceOpsService.getCapabilityMatrix(req)
  return sendSuccess(res, 'GST compliance ops capability matrix', result)
})

export const getComplianceCockpit = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstComplianceCockpitQueryInput
  const result = await gstComplianceOpsService.getCockpit(req, tenantId, query)
  return sendSuccess(res, 'GST compliance cockpit', result)
})

export const getMultiPeriodHealth = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstMultiPeriodHealthQueryInput
  const result = await gstComplianceOpsService.getMultiPeriodHealth(req, tenantId, query)
  return sendSuccess(res, 'GST multi-period compliance health', result)
})

export const getGstr9AnnualFoundation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstGstr9AnnualQueryInput
  const result = await gstComplianceOpsService.getGstr9AnnualFoundation(req, tenantId, query)
  return sendSuccess(res, 'GSTR-9 annual foundation (books)', result)
})

export const listAuditExportPacks = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstAuditPackListQueryInput
  const result = await gstComplianceOpsService.listAuditPacks(req, tenantId, query)
  return sendSuccess(res, 'GST audit export packs', result)
})

export const createAuditExportPack = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAuditPackCreateInput
  const item = await gstComplianceOpsService.createAuditPack(req, tenantId, body)
  return sendSuccess(res, 'GST audit export pack generated (books evidence)', item, 201)
})

export const getAuditExportPack = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await gstComplianceOpsService.getAuditPack(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'GST audit export pack', item)
})

export const voidAuditExportPack = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstAuditPackVoidInput
  const item = await gstComplianceOpsService.voidAuditPack(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'GST audit export pack voided', item)
})

export const listComplianceNotices = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstComplianceNoticeListQueryInput
  const result = await gstComplianceOpsService.listNotices(req, tenantId, query)
  return sendSuccess(res, 'GST compliance notices', result)
})

export const createComplianceNotice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstComplianceNoticeCreateInput
  const item = await gstComplianceOpsService.createNotice(req, tenantId, body)
  return sendSuccess(res, 'Compliance notice recorded', item, 201)
})

export const updateComplianceNotice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstComplianceNoticeUpdateInput
  const item = await gstComplianceOpsService.updateNotice(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'Compliance notice updated', item)
})

// ─── Phase 16 — Rate master ops ──────────────────────────────────────────────

export const getRateOpsCapability = asyncHandler(async (req: Request, res: Response) => {
  const data = gstRateOpsService.getRateOpsCapability(req)
  return sendSuccess(res, 'GST rate ops capability (not FULL GST COMPLIANT)', data)
})

export const getRateOpsCoverage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstRateOpsReportQueryInput
  const data = await gstRateOpsService.getRateOpsCoverage(req, tenantId, query)
  return sendSuccess(res, 'GST rate coverage report', data)
})

export const getRateOpsDrift = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstRateOpsDriftQueryInput
  const data = await gstRateOpsService.getRateOpsDrift(req, tenantId, query)
  return sendSuccess(res, 'GST ledger vs master rate drift (advisory)', data)
})

export const getRateOpsFullReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstRateOpsDriftQueryInput
  const data = await gstRateOpsService.getRateOpsFullReport(req, tenantId, query)
  return sendSuccess(res, 'GST rate ops full report (READY WITH CONDITIONS)', data)
})

export const listRateOpsRuns = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstRateOpsRunListQueryInput
  const result = await gstRateOpsService.listRateOpsRuns(
    req,
    tenantId,
    query.legalEntityId,
    query.page,
    query.pageSize,
  )
  return sendSuccess(
    res,
    'GST rate ops runs',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const createRateOpsRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstRateOpsRunCreateInput
  const item = await gstRateOpsService.createRateOpsRun(req, tenantId, body)
  return sendSuccess(res, 'GST rate ops run stored (books evidence)', item, 201)
})

export const acknowledgeRateOpsRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstRateOpsAckInput
  const item = await gstRateOpsService.acknowledgeRateOpsRun(
    req,
    tenantId,
    String(req.params.id),
    body.notes,
  )
  return sendSuccess(res, 'GST rate ops run acknowledged', item)
})

// ─── Phase 17 — Data quality / backfill / freeze ─────────────────────────────

export const getDataQualityCapability = asyncHandler(async (req: Request, res: Response) => {
  const data = gstDataQualityService.getDataQualityCapability(req)
  return sendSuccess(res, 'GST data quality capability (not FULL GST COMPLIANT)', data)
})

export const scanDataQuality = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstDataQualityPeriodQueryInput
  const data = await gstDataQualityService.scanDataQuality(req, tenantId, query)
  return sendSuccess(res, 'GST ledger data quality scan', data)
})

export const getDataQualityFreezeReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstDataQualityPeriodQueryInput
  const data = await gstDataQualityService.getFreezeReadiness(req, tenantId, query)
  return sendSuccess(res, 'GST books freeze readiness checklist', data)
})

export const dryRunDataQualityBackfill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstDataQualityBackfillInput
  const data = await gstDataQualityService.dryRunGstinBackfill(req, tenantId, body)
  return sendSuccess(res, 'GSTIN backfill dry-run', data)
})

export const applyDataQualityBackfill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstDataQualityBackfillInput
  const data = await gstDataQualityService.applyGstinBackfill(req, tenantId, body)
  return sendSuccess(res, 'GSTIN backfill applied (null rows only)', data)
})

export const listDataQualityRuns = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstDataQualityRunListQueryInput
  const result = await gstDataQualityService.listDataQualityRuns(
    req,
    tenantId,
    query.legalEntityId,
    query.page,
    query.pageSize,
  )
  return sendSuccess(
    res,
    'GST data quality runs',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const createDataQualityRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstDataQualityRunCreateInput
  const item = await gstDataQualityService.createDataQualityRun(req, tenantId, body)
  return sendSuccess(res, 'GST data quality evidence run stored', item, 201)
})

export const acknowledgeDataQualityRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstDataQualityAckInput
  const item = await gstDataQualityService.acknowledgeDataQualityRun(
    req,
    tenantId,
    String(req.params.id),
    body.notes,
  )
  return sendSuccess(res, 'GST data quality run acknowledged', item)
})

// ─── Phase 18 — GST vs GL control recon ──────────────────────────────────────

export const getGlReconCapability = asyncHandler(async (req: Request, res: Response) => {
  const data = gstGlReconService.getGlReconCapability(req)
  return sendSuccess(res, 'GST vs GL recon capability (not FULL GST COMPLIANT)', data)
})

export const getGlReconReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstGlReconQueryInput
  const data = await gstGlReconService.runGlRecon(req, tenantId, query)
  return sendSuccess(res, 'GST subledger vs GL control recon (advisory)', data)
})

export const listGlReconRuns = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstGlReconRunListQueryInput
  const result = await gstGlReconService.listGlReconRuns(
    req,
    tenantId,
    query.legalEntityId,
    query.page,
    query.pageSize,
  )
  return sendSuccess(
    res,
    'GST GL recon runs',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const createGlReconRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstGlReconRunCreateInput
  const item = await gstGlReconService.createGlReconRun(req, tenantId, body)
  return sendSuccess(res, 'GST GL recon evidence run stored', item, 201)
})

export const acknowledgeGlReconRun = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GstGlReconAckInput
  const item = await gstGlReconService.acknowledgeGlReconRun(
    req,
    tenantId,
    String(req.params.id),
    body.notes,
  )
  return sendSuccess(res, 'GST GL recon run acknowledged', item)
})
