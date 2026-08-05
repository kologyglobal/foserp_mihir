import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import {
  cancelGstDocumentSchema,
  generateEInvoiceSchema,
  generateEWayBillSchema,
  gstExtractQuerySchema,
  gstLedgerQuerySchema,
  gstRegisterQuerySchema,
  gstSummaryQuerySchema,
  gstr2bImportBatchSchema,
  gstr2bListBatchesQuerySchema,
  gstr2bListFollowUpsQuerySchema,
  gstr2bListRowsQuerySchema,
  gstr2bReconcileBatchSchema,
  gstr2bUpdateFollowUpSchema,
  gstr2bVoidBatchSchema,
  gstrReturnActionBodySchema,
  gstrReturnMarkFiledBodySchema,
  gstrReturnPeriodQuerySchema,
  gstrReturnPrepQuerySchema,
  gstrReturnTypeParamSchema,
  gstrReturnUnlockBodySchema,
  listGstDocumentQuerySchema,
  markRcmItcNotClaimableSchema,
  markRcmLiabilityPaidSchema,
  recognizeRcmItcSchema,
  rcmRegisterQuerySchema,
  updateEWayVehicleSchema,
  extendEWayBillSchema,
  ewayPanelQuerySchema,
  gstPaymentListQuerySchema,
  gstPaymentProposeSchema,
  gstPaymentConfirmSchema,
  gstPaymentPostGlSchema,
  gstPaymentVoidSchema,
  gstRegistrationListQuerySchema,
  gstRegistrationUpsertSchema,
  gstBranchTransferPolicySchema,
  gstBranchTransferEvalSchema,
  gstIsolationStatusQuerySchema,
  gstLutListQuerySchema,
  gstLutUpsertSchema,
  gstExportValidateSchema,
  gstExportRegisterQuerySchema,
  gstExportRefundListQuerySchema,
  gstExportRefundProposeSchema,
  gstExportRefundSubmitSchema,
  gstSpecialsNilRegisterQuerySchema,
  gstClassifyBodySchema,
  gstJobWorkEvalBodySchema,
  gstWithholdingListQuerySchema,
  gstWithholdingCreateSchema,
  gstWithholdingMarkPaidSchema,
  gstWithholdingVoidSchema,
  gstAdvanceListQuerySchema,
  gstAdvanceCreateSchema,
  gstAdvanceAdjustSchema,
  gstCompositionGatesQuerySchema,
  gstHardeningPeriodQuerySchema,
  gstGoLiveGateQuerySchema,
  gstUatSignOffListQuerySchema,
  gstUatSignOffCreateSchema,
  gstUatSignOffUpdateSchema,
  gstUatSignOffRevokeSchema,
  gstrFilingListQuerySchema,
  gstrFilingCreatePackageSchema,
  gstrFilingCaptureArnSchema,
  gstrFilingMarkFiledSchema,
  gstrFilingCheckerSchema,
  gstAnnualListQuerySchema,
  gstAnnualGetQuerySchema,
  gstAnnualPrepareBodySchema,
  gstAnnualActionBodySchema,
  gstAnnualUnlockBodySchema,
  gstAnnualMarkFiledBodySchema,
  gstCockpitQuerySchema,
  gstFyArchiveListQuerySchema,
  gstFyArchiveBodySchema,
  gstComplianceCockpitQuerySchema,
  gstMultiPeriodHealthQuerySchema,
  gstGstr9AnnualQuerySchema,
  gstAuditPackListQuerySchema,
  gstAuditPackCreateSchema,
  gstAuditPackVoidSchema,
  gstComplianceNoticeListQuerySchema,
  gstComplianceNoticeCreateSchema,
  gstComplianceNoticeUpdateSchema,
  gstRateOpsReportQuerySchema,
  gstRateOpsDriftQuerySchema,
  gstRateOpsRunCreateSchema,
  gstRateOpsRunListQuerySchema,
  gstRateOpsAckSchema,
  gstDataQualityPeriodQuerySchema,
  gstDataQualityBackfillSchema,
  gstDataQualityRunCreateSchema,
  gstDataQualityRunListQuerySchema,
  gstDataQualityAckSchema,
  gstGlReconQuerySchema,
  gstGlReconRunCreateSchema,
  gstGlReconRunListQuerySchema,
  gstGlReconAckSchema,
} from './tax-compliance.schemas.js'
import * as controller from './tax-compliance.controller.js'

/** Keep mergeParams fields (e.g. :id) when re-validating tenant slug. */
const tenantParamsPassthrough = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
  })
  .passthrough()
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const taxDocumentIdParamSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
    id: z.string().uuid(),
  })
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const gstr2bBatchIdParamSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
    batchId: z.string().uuid(),
  })
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const gstr2bFollowUpIdParamSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
    followUpId: z.string().uuid(),
  })
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantParamsPassthrough),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/outward-supplies',
  requirePermission('finance.tax.view'),
  validateQuery(gstExtractQuerySchema),
  controller.listOutwardSupplies,
)

router.get(
  '/inward-supplies',
  requirePermission('finance.tax.view'),
  validateQuery(gstExtractQuerySchema),
  controller.listInwardSupplies,
)

router.get(
  '/summary',
  requirePermission('finance.tax.view'),
  validateQuery(gstSummaryQuerySchema),
  controller.getSummary,
)

router.get(
  '/gst-ledger',
  requirePermission('finance.tax.view'),
  validateQuery(gstLedgerQuerySchema),
  controller.listGstLedger,
)

router.get(
  '/e-invoices',
  requirePermission('finance.tax.view'),
  validateQuery(listGstDocumentQuerySchema),
  controller.listEInvoices,
)

router.get(
  '/e-invoices/provider-status',
  requirePermission('finance.tax.view'),
  controller.getEInvoiceProviderStatus,
)

router.post(
  '/e-invoices/generate',
  requirePermission('finance.tax.einvoice.manage'),
  validateBody(generateEInvoiceSchema),
  controller.generateEInvoice,
)

router.get(
  '/e-invoices/:id',
  requirePermission('finance.tax.view'),
  validateParams(taxDocumentIdParamSchema),
  controller.getEInvoice,
)

router.post(
  '/e-invoices/:id/cancel',
  requirePermission('finance.tax.einvoice.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(cancelGstDocumentSchema),
  controller.cancelEInvoice,
)

router.get(
  '/e-way-bills',
  requirePermission('finance.tax.view'),
  validateQuery(listGstDocumentQuerySchema),
  controller.listEWayBills,
)

router.get(
  '/e-way-bills/provider-status',
  requirePermission('finance.tax.view'),
  controller.getEWayProviderStatus,
)

router.get(
  '/e-way-bills/panel',
  requirePermission('finance.tax.view'),
  validateQuery(ewayPanelQuerySchema),
  controller.getEWayPanel,
)

router.post(
  '/e-way-bills/generate',
  requirePermission('finance.tax.eway.manage'),
  validateBody(generateEWayBillSchema),
  controller.generateEWayBill,
)

router.get(
  '/e-way-bills/:id',
  requirePermission('finance.tax.view'),
  validateParams(taxDocumentIdParamSchema),
  controller.getEWayBill,
)

router.post(
  '/e-way-bills/:id/cancel',
  requirePermission('finance.tax.eway.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(cancelGstDocumentSchema),
  controller.cancelEWayBill,
)

router.post(
  '/e-way-bills/:id/update-vehicle',
  requirePermission('finance.tax.eway.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(updateEWayVehicleSchema),
  controller.updateEWayVehicle,
)

router.post(
  '/e-way-bills/:id/extend',
  requirePermission('finance.tax.eway.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(extendEWayBillSchema),
  controller.extendEWayBill,
)

// ─── Phase 4 — Reverse charge (RCM) ──────────────────────────────────────────

router.get(
  '/rcm-register',
  requireAnyPermission('tax.gst.view', 'finance.tax.view'),
  validateQuery(rcmRegisterQuerySchema),
  controller.listRcmRegister,
)

router.post(
  '/rcm-register/:id/mark-liability-paid',
  requireAnyPermission('tax.gst.setup.manage', 'tax.gst.reconcile'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(markRcmLiabilityPaidSchema),
  controller.markRcmLiabilityPaid,
)

router.post(
  '/rcm-register/:id/recognize-itc',
  requireAnyPermission('tax.gst.setup.manage', 'tax.gst.reconcile'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(recognizeRcmItcSchema),
  controller.recognizeRcmItc,
)

router.post(
  '/rcm-register/:id/mark-not-claimable',
  requireAnyPermission('tax.gst.setup.manage', 'tax.gst.reconcile'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(markRcmItcNotClaimableSchema),
  controller.markRcmItcNotClaimable,
)

// ─── Phase 3 — GSTR-2B / ITC ────────────────────────────────────────────────

router.post(
  '/gstr2b/batches',
  requirePermission('tax.gst.reconcile'),
  validateBody(gstr2bImportBatchSchema),
  controller.importGstr2bBatch,
)

router.get(
  '/gstr2b/batches',
  requireAnyPermission('tax.gst.view', 'tax.gst.reconcile', 'finance.tax.view'),
  validateQuery(gstr2bListBatchesQuerySchema),
  controller.listGstr2bBatches,
)

router.get(
  '/gstr2b/follow-ups',
  requireAnyPermission('tax.gst.view', 'tax.gst.reconcile', 'finance.tax.view'),
  validateQuery(gstr2bListFollowUpsQuerySchema),
  controller.listGstr2bFollowUps,
)

router.patch(
  '/gstr2b/follow-ups/:followUpId',
  requirePermission('tax.gst.reconcile'),
  validateParams(gstr2bFollowUpIdParamSchema),
  validateBody(gstr2bUpdateFollowUpSchema),
  controller.updateGstr2bFollowUp,
)

router.get(
  '/gstr2b/batches/:batchId',
  requireAnyPermission('tax.gst.view', 'tax.gst.reconcile', 'finance.tax.view'),
  validateParams(gstr2bBatchIdParamSchema),
  controller.getGstr2bBatch,
)

router.get(
  '/gstr2b/batches/:batchId/rows',
  requireAnyPermission('tax.gst.view', 'tax.gst.reconcile', 'finance.tax.view'),
  validateParams(gstr2bBatchIdParamSchema),
  validateQuery(gstr2bListRowsQuerySchema),
  controller.listGstr2bRows,
)

router.get(
  '/gstr2b/batches/:batchId/summary',
  requireAnyPermission('tax.gst.view', 'tax.gst.reconcile', 'finance.tax.view'),
  validateParams(gstr2bBatchIdParamSchema),
  controller.getGstr2bReconSummary,
)

router.post(
  '/gstr2b/batches/:batchId/reconcile',
  requirePermission('tax.gst.reconcile'),
  validateParams(gstr2bBatchIdParamSchema),
  validateBody(gstr2bReconcileBatchSchema),
  controller.reconcileGstr2bBatch,
)

router.post(
  '/gstr2b/batches/:batchId/void',
  requirePermission('tax.gst.reconcile'),
  validateParams(gstr2bBatchIdParamSchema),
  validateBody(gstr2bVoidBatchSchema),
  controller.voidGstr2bBatch,
)

// ─── Phase 5 — Registers & GSTR-1 / 3B preparation ───────────────────────────

router.get(
  '/registers',
  requireAnyPermission('tax.gst.view', 'finance.tax.view'),
  validateQuery(gstRegisterQuerySchema),
  controller.getGstRegister,
)

router.get(
  '/returns',
  requireAnyPermission('tax.gst.view', 'finance.tax.view'),
  validateQuery(gstrReturnPeriodQuerySchema),
  controller.listGstrReturnPeriods,
)

router.get(
  '/returns/:returnType',
  requireAnyPermission('tax.gst.view', 'finance.tax.view'),
  validateParams(gstrReturnTypeParamSchema),
  validateQuery(gstrReturnPrepQuerySchema),
  controller.getGstrReturnPrep,
)

router.post(
  '/returns/:returnType/prepare',
  requirePermission('tax.gst.returns.prepare'),
  validateParams(gstrReturnTypeParamSchema),
  validateBody(gstrReturnActionBodySchema),
  controller.prepareGstrReturn,
)

router.post(
  '/returns/:returnType/lock',
  requirePermission('tax.gst.returns.lock'),
  validateParams(gstrReturnTypeParamSchema),
  validateBody(gstrReturnActionBodySchema),
  controller.lockGstrReturn,
)

router.post(
  '/returns/:returnType/unlock',
  requirePermission('tax.gst.returns.lock'),
  validateParams(gstrReturnTypeParamSchema),
  validateBody(gstrReturnUnlockBodySchema),
  controller.unlockGstrReturn,
)

router.post(
  '/returns/:returnType/mark-filed-external',
  requirePermission('tax.gst.returns.mark_filed'),
  validateParams(gstrReturnTypeParamSchema),
  validateBody(gstrReturnMarkFiledBodySchema),
  controller.markGstrReturnFiledExternal,
)

// ─── Phase 12 — Portal filing sessions (SIMULATED default) ────────────────────

router.get(
  '/filing/capability',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.returns.file'),
  controller.getGstrFilingCapability,
)

router.get(
  '/filing/sessions',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.returns.file'),
  validateQuery(gstrFilingListQuerySchema),
  controller.listGstrFilingSessions,
)

router.post(
  '/filing/sessions',
  requirePermission('tax.gst.returns.file'),
  validateBody(gstrFilingCreatePackageSchema),
  controller.createGstrFilingPackage,
)

router.get(
  '/filing/sessions/:id',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.returns.file'),
  validateParams(taxDocumentIdParamSchema),
  controller.getGstrFilingSession,
)

router.post(
  '/filing/sessions/:id/approve-checker',
  requirePermission('tax.gst.returns.file'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstrFilingCheckerSchema),
  controller.approveGstrFilingChecker,
)

router.post(
  '/filing/sessions/:id/submit',
  requirePermission('tax.gst.returns.file'),
  validateParams(taxDocumentIdParamSchema),
  controller.submitGstrFilingSession,
)

router.post(
  '/filing/sessions/:id/capture-arn',
  requireAnyPermission('tax.gst.returns.file', 'tax.gst.returns.mark_filed'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstrFilingCaptureArnSchema),
  controller.captureGstrFilingArn,
)

router.post(
  '/filing/sessions/:id/mark-filed',
  requirePermission('tax.gst.returns.mark_filed'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstrFilingMarkFiledSchema),
  controller.markGstrFilingFiled,
)

// ─── Phase 8 — GST payment / PMT-06 style challan ─────────────────────────────

router.get(
  '/payments',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.payment.prepare'),
  validateQuery(gstPaymentListQuerySchema),
  controller.listGstPaymentChallans,
)

router.post(
  '/payments/preview',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.payment.prepare'),
  validateBody(gstPaymentProposeSchema),
  controller.previewGstPaymentLiability,
)

router.post(
  '/payments/propose',
  requirePermission('tax.gst.payment.prepare'),
  validateBody(gstPaymentProposeSchema),
  controller.proposeGstPaymentChallan,
)

router.get(
  '/payments/:id',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.payment.prepare'),
  validateParams(taxDocumentIdParamSchema),
  controller.getGstPaymentChallan,
)

router.post(
  '/payments/:id/confirm-external',
  requirePermission('tax.gst.payment.confirm'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstPaymentConfirmSchema),
  controller.confirmGstPaymentExternal,
)

router.post(
  '/payments/:id/post-gl',
  requirePermission('tax.gst.payment.post'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstPaymentPostGlSchema),
  controller.postGstPaymentGl,
)

router.post(
  '/payments/:id/close-period',
  requirePermission('tax.gst.payment.close'),
  validateParams(taxDocumentIdParamSchema),
  controller.closeGstPaymentPeriod,
)

router.post(
  '/payments/:id/void',
  requireAnyPermission('tax.gst.payment.prepare', 'tax.gst.payment.confirm'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstPaymentVoidSchema),
  controller.voidGstPaymentChallan,
)

// ─── Phase 9 — Multi-GSTIN / multi-branch ────────────────────────────────────

router.get(
  '/registrations',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.setup.manage'),
  validateQuery(gstRegistrationListQuerySchema),
  controller.listGstRegistrations,
)

router.post(
  '/registrations',
  requirePermission('tax.gst.setup.manage'),
  validateBody(gstRegistrationUpsertSchema),
  controller.upsertGstRegistration,
)

router.post(
  '/registrations/branch-transfer-policy',
  requirePermission('tax.gst.setup.manage'),
  validateBody(gstBranchTransferPolicySchema),
  controller.updateBranchTransferPolicy,
)

router.post(
  '/registrations/evaluate-branch-transfer',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.setup.manage'),
  validateBody(gstBranchTransferEvalSchema),
  controller.evaluateBranchTransfer,
)

router.get(
  '/registrations/isolation-status',
  requireAnyPermission('tax.gst.view', 'finance.tax.view'),
  validateQuery(gstIsolationStatusQuerySchema),
  controller.getGstIsolationStatus,
)

// ─── Phase 10 — Export / SEZ / LUT ───────────────────────────────────────────

router.get(
  '/export/luts',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.export.view', 'tax.gst.setup.manage'),
  validateQuery(gstLutListQuerySchema),
  controller.listGstLuts,
)

router.post(
  '/export/luts',
  requireAnyPermission('tax.gst.setup.manage', 'tax.gst.lut.manage'),
  validateBody(gstLutUpsertSchema),
  controller.upsertGstLut,
)

router.post(
  '/export/validate',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.export.view'),
  validateBody(gstExportValidateSchema),
  controller.validateExportSupply,
)

router.get(
  '/export/register',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.export.view'),
  validateQuery(gstExportRegisterQuerySchema),
  controller.listExportSezRegister,
)

router.get(
  '/export/refund-claims',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.export.view'),
  validateQuery(gstExportRefundListQuerySchema),
  controller.listExportRefundClaims,
)

router.post(
  '/export/refund-claims/propose',
  requireAnyPermission('tax.gst.setup.manage', 'tax.gst.lut.manage', 'tax.gst.returns.prepare'),
  validateBody(gstExportRefundProposeSchema),
  controller.proposeExportRefundClaim,
)

router.post(
  '/export/refund-claims/:id/submit-external',
  requireAnyPermission('tax.gst.setup.manage', 'tax.gst.lut.manage', 'tax.gst.returns.mark_filed'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstExportRefundSubmitSchema),
  controller.markExportRefundSubmitted,
)

// ─── Phase 11 — Specials / advances / GST TDS-TCS ────────────────────────────

router.get(
  '/specials/capability-matrix',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view'),
  controller.getSpecialsCapabilityMatrix,
)

router.get(
  '/specials/composition-gates',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view', 'tax.gst.setup.manage'),
  validateQuery(gstCompositionGatesQuerySchema),
  controller.getCompositionGates,
)

router.post(
  '/specials/classify',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view'),
  validateBody(gstClassifyBodySchema),
  controller.classifyGstSupplySpecial,
)

router.post(
  '/specials/job-work/evaluate',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view'),
  validateBody(gstJobWorkEvalBodySchema),
  controller.evaluateJobWorkGst,
)

router.get(
  '/specials/nil-exempt',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view'),
  validateQuery(gstSpecialsNilRegisterQuerySchema),
  controller.listNilExemptRegister,
)

router.get(
  '/specials/withholding',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view'),
  validateQuery(gstWithholdingListQuerySchema),
  controller.listGstWithholding,
)

router.post(
  '/specials/withholding',
  requireAnyPermission('tax.gst.specials.manage', 'tax.gst.setup.manage'),
  validateBody(gstWithholdingCreateSchema),
  controller.createGstWithholding,
)

router.post(
  '/specials/withholding/:id/mark-paid',
  requireAnyPermission('tax.gst.specials.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstWithholdingMarkPaidSchema),
  controller.markGstWithholdingPaid,
)

router.post(
  '/specials/withholding/:id/void',
  requireAnyPermission('tax.gst.specials.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstWithholdingVoidSchema),
  controller.voidGstWithholding,
)

router.get(
  '/specials/advances',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view'),
  validateQuery(gstAdvanceListQuerySchema),
  controller.listGstAdvances,
)

router.post(
  '/specials/advances',
  requireAnyPermission('tax.gst.specials.manage', 'tax.gst.setup.manage'),
  validateBody(gstAdvanceCreateSchema),
  controller.createGstAdvance,
)

router.post(
  '/specials/advances/:id/adjust',
  requireAnyPermission('tax.gst.specials.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstAdvanceAdjustSchema),
  controller.adjustGstAdvance,
)

router.post(
  '/specials/advances/:id/close',
  requireAnyPermission('tax.gst.specials.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  controller.closeGstAdvance,
)

// ─── Phase 13 — Go-live UAT / period books readiness ──────────────────────────

router.get(
  '/hardening/capability-matrix',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.compliance.view'),
  controller.getHardeningCapabilityMatrix,
)

router.get(
  '/hardening/period-health',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.compliance.view'),
  validateQuery(gstHardeningPeriodQuerySchema),
  controller.getPeriodComplianceHealth,
)

router.get(
  '/hardening/reconcile',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.compliance.view', 'tax.gst.reconcile'),
  validateQuery(gstHardeningPeriodQuerySchema),
  controller.getPeriodComplianceReconcile,
)

router.get(
  '/hardening/go-live-gate',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.compliance.view'),
  validateQuery(gstGoLiveGateQuerySchema),
  controller.getGstGoLiveGate,
)

router.get(
  '/hardening/uat-signoffs',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.compliance.view', 'tax.gst.compliance.uat'),
  validateQuery(gstUatSignOffListQuerySchema),
  controller.listUatSignOffs,
)

router.post(
  '/hardening/uat-signoffs',
  requireAnyPermission('tax.gst.compliance.uat', 'tax.gst.setup.manage'),
  validateBody(gstUatSignOffCreateSchema),
  controller.createUatSignOff,
)

router.patch(
  '/hardening/uat-signoffs/:id',
  requireAnyPermission('tax.gst.compliance.uat', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstUatSignOffUpdateSchema),
  controller.updateUatSignOff,
)

router.post(
  '/hardening/uat-signoffs/:id/submit',
  requireAnyPermission('tax.gst.compliance.uat', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  controller.submitUatSignOff,
)

router.post(
  '/hardening/uat-signoffs/:id/approve',
  requireAnyPermission('tax.gst.compliance.uat', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  controller.approveUatSignOff,
)

router.post(
  '/hardening/uat-signoffs/:id/revoke',
  requireAnyPermission('tax.gst.compliance.uat', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstUatSignOffRevokeSchema),
  controller.revokeUatSignOff,
)

// ─── Phase 14 — Annual worksheet + FY archive ────────────────────────────────

router.get(
  '/annual/capability-matrix',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view'),
  controller.getPhase14CapabilityMatrix,
)

router.get(
  '/annual/returns',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view'),
  validateQuery(gstAnnualListQuerySchema),
  controller.listGstAnnualReturns,
)

router.get(
  '/annual/return',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view'),
  validateQuery(gstAnnualGetQuerySchema),
  controller.getGstAnnualReturn,
)

router.post(
  '/annual/returns/prepare',
  requireAnyPermission('tax.gst.annual.prepare', 'tax.gst.returns.prepare', 'tax.gst.setup.manage'),
  validateBody(gstAnnualPrepareBodySchema),
  controller.prepareGstAnnualReturn,
)

router.post(
  '/annual/returns/lock',
  requireAnyPermission('tax.gst.annual.prepare', 'tax.gst.returns.lock', 'tax.gst.setup.manage'),
  validateBody(gstAnnualActionBodySchema),
  controller.lockGstAnnualReturn,
)

router.post(
  '/annual/returns/unlock',
  requireAnyPermission('tax.gst.annual.prepare', 'tax.gst.returns.lock', 'tax.gst.setup.manage'),
  validateBody(gstAnnualUnlockBodySchema),
  controller.unlockGstAnnualReturn,
)

router.post(
  '/annual/returns/mark-filed-external',
  requireAnyPermission('tax.gst.returns.mark_filed', 'tax.gst.annual.prepare', 'tax.gst.setup.manage'),
  validateBody(gstAnnualMarkFiledBodySchema),
  controller.markGstAnnualFiledExternal,
)

router.post(
  '/annual/returns/archive',
  requireAnyPermission('tax.gst.annual.archive', 'tax.gst.annual.prepare', 'tax.gst.setup.manage'),
  validateBody(gstAnnualActionBodySchema),
  controller.archiveGstAnnualReturn,
)

router.get(
  '/annual/cockpit',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view'),
  validateQuery(gstCockpitQuerySchema),
  controller.getAnnualFyCockpit,
)

router.get(
  '/annual/fy-archives',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view'),
  validateQuery(gstFyArchiveListQuerySchema),
  controller.listGstFyArchives,
)

router.post(
  '/annual/fy-archives',
  requireAnyPermission('tax.gst.annual.archive', 'tax.gst.setup.manage'),
  validateBody(gstFyArchiveBodySchema),
  controller.archiveGstFinancialYear,
)

// ─── Phase 15 — Compliance ops (cockpit / health / audit pack / notices / GSTR-9 foundation) ─

router.get(
  '/ops/capability-matrix',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  controller.getOpsCapabilityMatrix,
)

router.get(
  '/ops/cockpit',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  validateQuery(gstComplianceCockpitQuerySchema),
  controller.getComplianceCockpit,
)

router.get(
  '/ops/period-health',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  validateQuery(gstMultiPeriodHealthQuerySchema),
  controller.getMultiPeriodHealth,
)

router.get(
  '/ops/gstr9-annual',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  validateQuery(gstGstr9AnnualQuerySchema),
  controller.getGstr9AnnualFoundation,
)

router.get(
  '/ops/audit-packs',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  validateQuery(gstAuditPackListQuerySchema),
  controller.listAuditExportPacks,
)

router.post(
  '/ops/audit-packs',
  requireAnyPermission('tax.gst.ops.manage', 'tax.gst.setup.manage', 'tax.gst.ops.export'),
  validateBody(gstAuditPackCreateSchema),
  controller.createAuditExportPack,
)

router.get(
  '/ops/audit-packs/:id',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  validateParams(taxDocumentIdParamSchema),
  controller.getAuditExportPack,
)

router.post(
  '/ops/audit-packs/:id/void',
  requireAnyPermission('tax.gst.ops.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstAuditPackVoidSchema),
  controller.voidAuditExportPack,
)

router.get(
  '/ops/notices',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view'),
  validateQuery(gstComplianceNoticeListQuerySchema),
  controller.listComplianceNotices,
)

router.post(
  '/ops/notices',
  requireAnyPermission('tax.gst.ops.manage', 'tax.gst.setup.manage'),
  validateBody(gstComplianceNoticeCreateSchema),
  controller.createComplianceNotice,
)

router.patch(
  '/ops/notices/:id',
  requireAnyPermission('tax.gst.ops.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstComplianceNoticeUpdateSchema),
  controller.updateComplianceNotice,
)

// ─── Phase 16 — Rate master ops / determination continuity ───────────────────

router.get(
  '/rate-ops/capability',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage'),
  controller.getRateOpsCapability,
)

router.get(
  '/rate-ops/coverage',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage'),
  validateQuery(gstRateOpsReportQuerySchema),
  controller.getRateOpsCoverage,
)

router.get(
  '/rate-ops/drift',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.reconcile', 'tax.gst.setup.manage'),
  validateQuery(gstRateOpsDriftQuerySchema),
  controller.getRateOpsDrift,
)

router.get(
  '/rate-ops/report',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage'),
  validateQuery(gstRateOpsDriftQuerySchema),
  controller.getRateOpsFullReport,
)

router.get(
  '/rate-ops/runs',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage'),
  validateQuery(gstRateOpsRunListQuerySchema),
  controller.listRateOpsRuns,
)

router.post(
  '/rate-ops/runs',
  requireAnyPermission('tax.gst.rates.manage', 'tax.gst.setup.manage'),
  validateBody(gstRateOpsRunCreateSchema),
  controller.createRateOpsRun,
)

router.post(
  '/rate-ops/runs/:id/acknowledge',
  requireAnyPermission('tax.gst.rates.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstRateOpsAckSchema),
  controller.acknowledgeRateOpsRun,
)

// ─── Phase 17 — Data quality / GSTIN backfill / freeze checklist ─────────────

router.get(
  '/data-quality/capability',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.setup.manage'),
  controller.getDataQualityCapability,
)

router.get(
  '/data-quality/scan',
  requireAnyPermission(
    'tax.gst.view',
    'finance.tax.view',
    'tax.gst.quality.view',
    'tax.gst.reconcile',
    'tax.gst.setup.manage',
  ),
  validateQuery(gstDataQualityPeriodQuerySchema),
  controller.scanDataQuality,
)

router.get(
  '/data-quality/freeze-readiness',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.setup.manage'),
  validateQuery(gstDataQualityPeriodQuerySchema),
  controller.getDataQualityFreezeReadiness,
)

router.post(
  '/data-quality/backfill/dry-run',
  requireAnyPermission('tax.gst.quality.manage', 'tax.gst.setup.manage', 'tax.gst.reconcile'),
  validateBody(gstDataQualityBackfillSchema),
  controller.dryRunDataQualityBackfill,
)

router.post(
  '/data-quality/backfill/apply',
  requireAnyPermission('tax.gst.quality.manage', 'tax.gst.setup.manage'),
  validateBody(gstDataQualityBackfillSchema),
  controller.applyDataQualityBackfill,
)

router.get(
  '/data-quality/runs',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.setup.manage'),
  validateQuery(gstDataQualityRunListQuerySchema),
  controller.listDataQualityRuns,
)

router.post(
  '/data-quality/runs',
  requireAnyPermission('tax.gst.quality.manage', 'tax.gst.setup.manage'),
  validateBody(gstDataQualityRunCreateSchema),
  controller.createDataQualityRun,
)

router.post(
  '/data-quality/runs/:id/acknowledge',
  requireAnyPermission('tax.gst.quality.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstDataQualityAckSchema),
  controller.acknowledgeDataQualityRun,
)

// ─── Phase 18 — GST subledger vs GL control recon ────────────────────────────

router.get(
  '/gl-recon/capability',
  requireAnyPermission(
    'tax.gst.view',
    'finance.tax.view',
    'tax.gst.gl_recon.view',
    'tax.gst.reconcile',
    'tax.gst.setup.manage',
  ),
  controller.getGlReconCapability,
)

router.get(
  '/gl-recon/report',
  requireAnyPermission(
    'tax.gst.view',
    'finance.tax.view',
    'tax.gst.gl_recon.view',
    'tax.gst.reconcile',
    'tax.gst.setup.manage',
  ),
  validateQuery(gstGlReconQuerySchema),
  controller.getGlReconReport,
)

router.get(
  '/gl-recon/runs',
  requireAnyPermission('tax.gst.view', 'finance.tax.view', 'tax.gst.gl_recon.view', 'tax.gst.setup.manage'),
  validateQuery(gstGlReconRunListQuerySchema),
  controller.listGlReconRuns,
)

router.post(
  '/gl-recon/runs',
  requireAnyPermission('tax.gst.gl_recon.manage', 'tax.gst.setup.manage', 'tax.gst.reconcile'),
  validateBody(gstGlReconRunCreateSchema),
  controller.createGlReconRun,
)

router.post(
  '/gl-recon/runs/:id/acknowledge',
  requireAnyPermission('tax.gst.gl_recon.manage', 'tax.gst.setup.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(gstGlReconAckSchema),
  controller.acknowledgeGlReconRun,
)

export default router
