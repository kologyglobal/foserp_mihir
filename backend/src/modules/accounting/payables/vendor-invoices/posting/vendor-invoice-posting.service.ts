import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import * as repo from '../vendor-invoice.repository.js'
import { findPayableOpenItemBySourceVendorInvoice } from '../../open-items/payable-open-item.repository.js'
import { createVendorInvoicePayableOpenItem, finalizePostedVendorInvoice } from '../vendor-invoice.repository.js'
import { reserveVendorInvoiceNumber } from './vendor-invoice-number.service.js'
import { validateVendorInvoiceForPosting } from './vendor-invoice-posting-validation.service.js'
import { buildVendorInvoicePostEventKey } from './vendor-invoice-posting.types.js'
import type {
  PostVendorInvoiceContext,
  PostVendorInvoiceInput,
  PostVendorInvoiceResult,
} from './vendor-invoice-posting.types.js'
import {
  mapPostingErrorToVendorInvoiceError,
  VendorInvoiceAlreadyPostedError,
  VendorInvoiceConcurrentPostError,
  VendorInvoicePayableGlMismatchError,
  VendorInvoicePayableOpenItemCreationFailedError,
  VendorInvoicePostingNotAllowedError,
} from './vendor-invoice-posting.errors.js'
import { VendorInvoiceNotFoundError } from '../vendor-invoice.errors.js'
import { compare } from '../../../shared/finance-decimal.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.ap.vendor_invoice.post')) {
    throw new VendorInvoicePostingNotAllowedError()
  }
}

async function loadPostedResult(
  tenantId: string,
  vendorInvoiceId: string,
  posting: PostVendorInvoiceResult['posting'],
  idempotentReplay: boolean,
): Promise<PostVendorInvoiceResult> {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, vendorInvoiceId)
  if (!invoice.vendorInvoiceNumber || !invoice.accountingVoucherId || !invoice.postingEventId) {
    throw new VendorInvoiceAlreadyPostedError('Posted vendor invoice is missing accounting links')
  }

  const openItem = await findPayableOpenItemBySourceVendorInvoice(
    tenantId,
    invoice.legalEntityId,
    vendorInvoiceId,
  )
  if (!openItem) {
    throw new Error('Payable open item missing after successful post')
  }

  return {
    idempotentReplay,
    vendorInvoiceId: invoice.id,
    draftReference: invoice.draftReference,
    vendorInvoiceNumber: invoice.vendorInvoiceNumber,
    supplierInvoiceNumber: invoice.supplierInvoiceNumber,
    status: 'POSTED',
    accountingVoucherId: invoice.accountingVoucherId,
    accountingVoucherNumber: posting.voucherNumber,
    postingEventId: invoice.postingEventId,
    payableOpenItemId: openItem.id,
    vendorId: invoice.vendorId,
    vendorCode: invoice.vendorCodeSnapshot,
    vendorName: invoice.vendorNameSnapshot,
    documentDate: invoice.documentDate.toISOString().slice(0, 10),
    supplierInvoiceDate: invoice.supplierInvoiceDate.toISOString().slice(0, 10),
    postingDate: (invoice.postingDate ?? invoice.documentDate).toISOString().slice(0, 10),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
    currencyCode: invoice.currencyCode,
    invoiceGrandTotal: formatForPersistence(invoice.invoiceGrandTotal),
    tdsAmount: formatForPersistence(invoice.tdsAmount),
    vendorPayableAmount: formatForPersistence(invoice.vendorPayableAmount),
    payableOutstandingAmount: formatForPersistence(openItem.outstandingAmount),
    ledgerEntryCount: posting.ledgerEntryCount,
    posting,
  }
}

export async function postVendorInvoiceFromRequest(
  req: Request,
  tenantId: string,
  vendorInvoiceId: string,
  body: { expectedUpdatedAt: string },
): Promise<PostVendorInvoiceResult> {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const audit = auditFromRequest(req)
  return postVendorInvoice(
    {
      vendorInvoiceId,
      expectedUpdatedAt: body.expectedUpdatedAt,
    },
    {
      tenantId,
      userId,
      authorization: { permissionChecked: true },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    },
  )
}

export async function postVendorInvoice(
  input: PostVendorInvoiceInput,
  context: PostVendorInvoiceContext,
): Promise<PostVendorInvoiceResult> {
  let existingInvoice
  try {
    existingInvoice = await repo.findVendorInvoiceWithLinesOrThrow(context.tenantId, input.vendorInvoiceId)
  } catch {
    throw new VendorInvoiceNotFoundError()
  }

  if (existingInvoice.status === 'POSTED') {
    if (!existingInvoice.accountingVoucherId || !existingInvoice.postingEventId) {
      throw new VendorInvoiceAlreadyPostedError()
    }
    const posting = await buildPostedResult(
      context.tenantId,
      existingInvoice.postingEventId,
      existingInvoice.accountingVoucherId,
      true,
    )
    return loadPostedResult(context.tenantId, input.vendorInvoiceId, posting, true)
  }

  const validated = await validateVendorInvoiceForPosting(
    context.tenantId,
    input.vendorInvoiceId,
    input.expectedUpdatedAt,
  )
  const { invoice, postingRequest, context: postingCtx } = validated

  const postingContext: PostingContext = {
    tenantId: context.tenantId,
    userId: context.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }

  let openItemId: string | null = null

  try {
    const posting = await post(postingRequest, postingContext, {
      beforeTransaction: async (event) => {
        await reserveVendorInvoiceNumber(
          context.tenantId,
          invoice.legalEntityId,
          postingCtx.financialYearId,
          event,
        )
        return undefined
      },
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId, voucherNumber, validated: postingValidated }) => {
        const event = await tx.postingEvent.findFirstOrThrow({
          where: { id: eventId, tenantId: txContext.tenantId },
        })
        const vendorInvoiceNumber = event.reservedSourceDocumentNumber
        if (!vendorInvoiceNumber) {
          throw new VendorInvoiceConcurrentPostError()
        }

        await tx.accountingVoucher.update({
          where: { id: voucherId },
          data: { referenceNumber: vendorInvoiceNumber },
        })

        const vendorPayableCredit = postingValidated.resolvedLines.find(
          (line) =>
            line.accountId === postingCtx.vendorPayableAccountId &&
            compare(line.creditAmount, '0') > 0,
        )
        if (
          !vendorPayableCredit ||
          compare(vendorPayableCredit.creditAmount, invoice.vendorPayableAmount) !== 0 ||
          compare(vendorPayableCredit.baseCreditAmount, invoice.baseVendorPayableAmount) !== 0
        ) {
          throw new VendorInvoicePayableGlMismatchError()
        }

        let openItem
        try {
          openItem = await createVendorInvoicePayableOpenItem(tx, {
            tenantId: txContext.tenantId,
            legalEntityId: invoice.legalEntityId,
            branchId: invoice.branchId,
            vendorId: invoice.vendorId,
            vendorCodeSnapshot: invoice.vendorCodeSnapshot,
            vendorNameSnapshot: invoice.vendorNameSnapshot,
            documentId: invoice.id,
            documentNumber: vendorInvoiceNumber,
            documentDate: invoice.documentDate,
            postingDate: invoice.postingDate ?? invoice.documentDate,
            dueDate: invoice.dueDate,
            currencyCode: invoice.currencyCode,
            exchangeRate: invoice.exchangeRate,
            originalAmount: invoice.vendorPayableAmount,
            outstandingAmount: invoice.vendorPayableAmount,
            baseOriginalAmount: invoice.baseVendorPayableAmount,
            baseOutstandingAmount: invoice.baseVendorPayableAmount,
            vendorPayableAccountId: postingCtx.vendorPayableAccountId,
            sourceVendorInvoiceId: invoice.id,
            accountingVoucherId: voucherId,
            postingEventId: eventId,
            createdBy: txContext.userId ?? null,
          })
        } catch {
          throw new VendorInvoicePayableOpenItemCreationFailedError()
        }
        openItemId = openItem.id

        const updated = await finalizePostedVendorInvoice(tx, {
          tenantId: txContext.tenantId,
          vendorInvoiceId: invoice.id,
          expectedUpdatedAt: postingCtx.expectedUpdatedAt,
          vendorInvoiceNumber,
          accountingVoucherId: voucherId,
          postingEventId: eventId,
          postedById: txContext.userId ?? null,
          financialYearId: postingCtx.financialYearId,
        })

        if (updated.count !== 1) {
          throw new VendorInvoiceConcurrentPostError()
        }

        void voucherNumber
      },
    })

    if (posting.idempotentReplay) {
      return loadPostedResult(context.tenantId, input.vendorInvoiceId, posting, true)
    }

    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'vendor_invoice',
      entityId: input.vendorInvoiceId,
      action: 'VENDOR_INVOICE_POSTED',
      newValues: {
        vendorInvoiceNumber: (await prisma.vendorInvoice.findFirst({
          where: { id: input.vendorInvoiceId, tenantId: context.tenantId },
          select: { vendorInvoiceNumber: true },
        }))?.vendorInvoiceNumber,
        draftReference: invoice.draftReference,
        supplierInvoiceNumber: invoice.supplierInvoiceNumber,
        vendorId: invoice.vendorId,
        invoiceType: invoice.invoiceType,
        documentDate: invoice.documentDate.toISOString().slice(0, 10),
        postingDate: (invoice.postingDate ?? invoice.documentDate).toISOString().slice(0, 10),
        invoiceGrandTotal: formatForPersistence(invoice.invoiceGrandTotal),
        tdsAmount: formatForPersistence(invoice.tdsAmount),
        vendorPayableAmount: formatForPersistence(invoice.vendorPayableAmount),
        voucherNumber: posting.voucherNumber,
        payableOpenItemId: openItemId,
        postingEventId: posting.postingEventId,
        postedBy: context.userId,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    return loadPostedResult(context.tenantId, input.vendorInvoiceId, posting, false)
  } catch (error) {
    const eventKey = buildVendorInvoicePostEventKey(input.vendorInvoiceId)
    const failedEvent = await prisma.postingEvent.findFirst({
      where: {
        tenantId: context.tenantId,
        legalEntityId: invoice.legalEntityId,
        eventKey,
        status: 'FAILED',
      },
      orderBy: { updatedAt: 'desc' },
    })
    if (failedEvent) {
      await createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        module: 'finance',
        entity: 'vendor_invoice',
        entityId: input.vendorInvoiceId,
        action: 'VENDOR_INVOICE_POSTING_FAILED',
        newValues: {
          vendorInvoiceId: input.vendorInvoiceId,
          draftReference: invoice.draftReference,
          supplierInvoiceNumber: invoice.supplierInvoiceNumber,
          failureCode: failedEvent.errorCode,
          attemptNumber: failedEvent.attemptCount,
          postingEventId: failedEvent.id,
          userId: context.userId,
        },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      }).catch(() => {})
    }
    mapPostingErrorToVendorInvoiceError(error)
  }
}

export async function canPostVendorInvoice(req: Request, status: string): Promise<boolean> {
  if (status !== 'READY_TO_POST') return false
  return hasPerm(req, 'finance.ap.vendor_invoice.post')
}

/** Narrow type re-export for repository tx helpers. */
export type VendorInvoicePostingTx = Prisma.TransactionClient
