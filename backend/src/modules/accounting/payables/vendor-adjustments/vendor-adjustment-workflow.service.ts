import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { buildSupplierReferenceUniquenessKey } from './vendor-adjustment-number-normalization.js'
import { recalculateVendorAdjustment } from './vendor-adjustment-draft.service.js'
import * as repo from './vendor-adjustment.repository.js'
import {
  VendorAdjustmentDuplicateUniquenessKeyError,
  VendorAdjustmentExactDuplicateError,
  VendorAdjustmentInvalidStatusError,
  VendorAdjustmentNotReadyError,
  VendorAdjustmentStaleVersionError,
} from './vendor-adjustment.errors.js'
import type {
  CancelVendorAdjustmentInput,
  MarkVendorAdjustmentReadyInput,
  ReviseVendorAdjustmentInput,
  SubmitVendorAdjustmentInput,
} from './vendor-adjustment.schemas.js'
import type { VendorAdjustmentWithLines } from './vendor-adjustment.types.js'
import { serializeVendorAdjustment } from './vendor-adjustment-read.service.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_adjustment',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function assertExpectedUpdatedAt(invoice: VendorAdjustmentWithLines, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (invoice.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorAdjustmentStaleVersionError()
}

/** Phase 4A3 — claim `supplierReferenceUniquenessKey`; the DB `@unique` column enforces the conflict. */
export async function claimUniquenessKey(tx: Prisma.TransactionClient, invoice: VendorAdjustmentWithLines): Promise<string> {
  const key = buildSupplierReferenceUniquenessKey({
    tenantId: invoice.tenantId,
    legalEntityId: invoice.legalEntityId,
    vendorId: invoice.vendorId,
    financialYearId: invoice.financialYearId,
    supplierReferenceNumberNormalized: invoice.supplierReferenceNumberNormalized,
  })
  try {
    await tx.vendorAdjustment.update({ where: { id: invoice.id }, data: { supplierReferenceUniquenessKey: key } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorAdjustmentDuplicateUniquenessKeyError()
    }
    throw err
  }
  return key
}

export async function releaseUniquenessKey(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  await tx.vendorAdjustment.update({ where: { id: invoiceId }, data: { supplierReferenceUniquenessKey: null } })
}

async function assertReadyForWorkflow(tenantId: string, invoice: VendorAdjustmentWithLines, userId?: string | null) {
  const result = await recalculateVendorAdjustment(tenantId, invoice, userId)
  if (result.duplicateAssessment.isBlocking) {
    throw new VendorAdjustmentExactDuplicateError()
  }
  if (!result.validation.isValid) {
    throw new VendorAdjustmentNotReadyError(
      result.validation.errors[0]?.message ?? 'Vendor invoice failed validation',
      result.validation.errors.map((e) => ({ field: e.field ?? 'invoice', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, invoice.id, result, userId)
  return result
}

export async function submitVendorAdjustment(req: Request, tenantId: string, id: string, input: SubmitVendorAdjustmentInput) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'DRAFT' || !invoice.approvalRequired) {
    throw new VendorAdjustmentInvalidStatusError('Only approval-required draft vendor invoices can be submitted')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, invoice, userId)

  const cycleNumber = (await prisma.financeApprovalRequest.count({
    where: { tenantId, legalEntityId: invoice.legalEntityId, documentType: 'VENDOR_ADJUSTMENT', documentId: id },
  })) + 1

  await prisma.$transaction(async (tx) => {
    await claimUniquenessKey(tx, invoice)
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: invoice.legalEntityId,
        documentType: 'VENDOR_ADJUSTMENT',
        documentId: id,
        documentNumberSnapshot: invoice.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: invoice.vendorPayableAmount,
        currencyCode: invoice.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.vendorAdjustment.update({
      where: { id, tenantId },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestId: approval.id,
        submittedAt: new Date(),
        submittedBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_ADJUSTMENT_SUBMITTED')
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}

export async function markVendorAdjustmentReady(req: Request, tenantId: string, id: string, input: MarkVendorAdjustmentReadyInput) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'DRAFT' || invoice.approvalRequired) {
    throw new VendorAdjustmentInvalidStatusError('Only non-approval draft vendor invoices can be marked ready to post')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, invoice, userId)

  await prisma.$transaction(async (tx) => {
    await claimUniquenessKey(tx, invoice)
    await tx.vendorAdjustment.update({
      where: { id, tenantId },
      data: { status: 'READY_TO_POST', readyToPostAt: new Date(), readyToPostBy: userId, updatedBy: userId },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_ADJUSTMENT_READY_TO_POST')
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}

export async function reviseVendorAdjustment(req: Request, tenantId: string, id: string, input: ReviseVendorAdjustmentInput) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (!['REJECTED', 'READY_TO_POST'].includes(invoice.status)) {
    throw new VendorAdjustmentInvalidStatusError('Only rejected or ready-to-post vendor invoices can be revised')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.vendorAdjustment.update({
    where: { id, tenantId },
    data: {
      status: 'DRAFT',
      readyToPostAt: null,
      readyToPostBy: null,
      rejectedAt: null,
      rejectedBy: null,
      approvalRequestId: null,
      updatedBy: userId,
    },
  })

  await audit(req, tenantId, id, 'VENDOR_ADJUSTMENT_REVISED', { reason: input.reason })
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}

export async function cancelVendorAdjustment(req: Request, tenantId: string, id: string, input: CancelVendorAdjustmentInput) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(invoice.status)) {
    throw new VendorAdjustmentInvalidStatusError('Vendor invoice cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (invoice.status === 'PENDING_APPROVAL' && invoice.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: invoice.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await releaseUniquenessKey(tx, id)
    await tx.vendorAdjustment.update({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED',
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_ADJUSTMENT_CANCELLED', { reason: input.reason })
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}
