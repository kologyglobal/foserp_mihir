import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../utils/errors.js'
import { post, buildPostedResult } from '../../posting/posting.service.js'
import type { PostingContext } from '../../posting/posting.types.js'
import * as repo from '../sales-invoices/sales-invoice.repository.js'
import { serializeSalesInvoiceDetail } from '../sales-invoices/sales-invoice-read.service.js'
import { buildSalesInvoicePostEventKey } from './sales-invoice-posting.types.js'
import type { PostSalesInvoiceInput, PostSalesInvoiceResult } from './sales-invoice-posting.types.js'
import { validateSalesInvoiceForPosting } from './sales-invoice-posting-validation.service.js'
import { reserveSalesInvoiceNumber } from './sales-invoice-number.service.js'
import {
  mapPostingErrorToSalesInvoiceError,
  SalesInvoiceAlreadyPostedError,
  SalesInvoiceConcurrentPostError,
  SalesInvoicePostingNotAllowedError,
} from './sales-invoice-posting.errors.js'
import { SalesInvoiceNotFoundError } from '../sales-invoices/sales-invoice.errors.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.ar.invoice.post')) {
    throw new SalesInvoicePostingNotAllowedError()
  }
}

async function loadPostedResult(
  req: Request,
  tenantId: string,
  invoiceId: string,
  posting: PostSalesInvoiceResult['posting'],
  idempotentReplay: boolean,
): Promise<PostSalesInvoiceResult> {
  const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  const openItem = await prisma.receivableOpenItem.findFirst({
    where: { tenantId, salesInvoiceId: invoiceId },
  })
  if (!openItem) {
    throw new Error('Receivable open item missing after successful post')
  }
  const detail = await serializeSalesInvoiceDetail(req, invoice)
  return {
    invoice: {
      ...detail,
      receivableOpenItemId: openItem.id,
      outstandingAmount: openItem.openAmount.toFixed(4),
    },
    posting,
    receivableOpenItemId: openItem.id,
    idempotentReplay,
  }
}

export async function postSalesInvoiceFromRequest(
  req: Request,
  tenantId: string,
  invoiceId: string,
): Promise<PostSalesInvoiceResult> {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const audit = auditFromRequest(req)
  return postSalesInvoice(
    {
      tenantId,
      invoiceId,
      userId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    },
    req,
  )
}

export async function postSalesInvoice(
  input: PostSalesInvoiceInput,
  req: Request,
): Promise<PostSalesInvoiceResult> {
  let existingInvoice
  try {
    existingInvoice = await repo.findSalesInvoiceWithLinesOrThrow(input.tenantId, input.invoiceId)
  } catch {
    throw new SalesInvoiceNotFoundError()
  }

  if (existingInvoice.status === 'POSTED') {
    if (!existingInvoice.accountingVoucherId || !existingInvoice.postingEventId) {
      throw new SalesInvoiceAlreadyPostedError()
    }
    const posting = await buildPostedResult(
      input.tenantId,
      existingInvoice.postingEventId,
      existingInvoice.accountingVoucherId,
      true,
    )
    return loadPostedResult(req, input.tenantId, input.invoiceId, posting, true)
  }

  const validated = await validateSalesInvoiceForPosting(input.tenantId, input.invoiceId)
  const { invoice, postingRequest, context: postingCtx } = validated

  const postingContext: PostingContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }

  let openItemId: string | null = null

  try {
    const posting = await post(postingRequest, postingContext, {
      beforeTransaction: async (event) => {
        await reserveSalesInvoiceNumber(
          input.tenantId,
          invoice.legalEntityId,
          postingCtx.financialYearId,
          event,
        )
        return undefined
      },
      afterAccounting: async ({ tx, context, eventId, voucherId }) => {
        const event = await tx.postingEvent.findFirstOrThrow({
          where: { id: eventId, tenantId: context.tenantId },
        })
        const invoiceNumber = event.reservedSourceDocumentNumber
        if (!invoiceNumber) {
          throw new SalesInvoiceConcurrentPostError()
        }

        const openItem = await tx.receivableOpenItem.create({
          data: {
            tenantId: context.tenantId,
            legalEntityId: invoice.legalEntityId,
            branchId: invoice.branchId,
            side: 'DEBIT',
            documentType: 'SALES_INVOICE',
            documentId: invoice.id,
            documentNumberSnapshot: invoiceNumber,
            salesInvoiceId: invoice.id,
            customerId: invoice.customerId,
            customerNameSnapshot: invoice.customerNameSnapshot,
            receivableAccountId: postingCtx.receivableAccountId,
            currencyCode: invoice.currencyCode,
            exchangeRate: invoice.exchangeRate,
            originalAmount: invoice.totalAmount,
            openAmount: invoice.totalAmount,
            baseOriginalAmount: invoice.baseTotalAmount,
            baseOpenAmount: invoice.baseTotalAmount,
            documentDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            status: 'OPEN',
            accountingVoucherId: voucherId,
            createdBy: context.userId ?? null,
            updatedBy: context.userId ?? null,
          },
        })
        openItemId = openItem.id

        const updated = await tx.salesInvoice.updateMany({
          where: {
            id: invoice.id,
            tenantId: context.tenantId,
            status: 'READY_TO_POST',
            invoiceNumber: null,
            accountingVoucherId: null,
          },
          data: {
            status: 'POSTED',
            invoiceNumber,
            accountingVoucherId: voucherId,
            postingEventId: eventId,
            postedAt: new Date(),
            postedBy: context.userId ?? null,
            financialYearId: postingCtx.financialYearId,
          },
        })

        if (updated.count !== 1) {
          throw new SalesInvoiceConcurrentPostError()
        }
      },
    })

    if (posting.idempotentReplay) {
      return loadPostedResult(req, input.tenantId, input.invoiceId, posting, true)
    }

    const postedEvent = await prisma.postingEvent.findFirst({
      where: { id: posting.postingEventId, tenantId: input.tenantId },
      select: { reservedSourceDocumentNumber: true },
    })

    await createAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      module: 'finance',
      entity: 'sales_invoice',
      entityId: input.invoiceId,
      action: 'SALES_INVOICE_POSTED',
      newValues: {
        postingEventId: posting.postingEventId,
        voucherId: posting.voucherId,
        voucherNumber: posting.voucherNumber,
        invoiceNumber: postedEvent?.reservedSourceDocumentNumber,
        totalAmount: invoice.totalAmount.toString(),
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })

    if (openItemId) {
      await createAuditLog({
        tenantId: input.tenantId,
        userId: input.userId,
        module: 'finance',
        entity: 'receivable_open_item',
        entityId: openItemId,
        action: 'RECEIVABLE_OPEN_ITEM_CREATED',
        newValues: {
          salesInvoiceId: input.invoiceId,
          originalAmount: invoice.totalAmount.toString(),
          openAmount: invoice.totalAmount.toString(),
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
    }

    return loadPostedResult(req, input.tenantId, input.invoiceId, posting, false)
  } catch (error) {
    const eventKey = buildSalesInvoicePostEventKey(input.invoiceId)
    const failedEvent = await prisma.postingEvent.findFirst({
      where: { tenantId: input.tenantId, legalEntityId: invoice.legalEntityId, eventKey, status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
    })
    if (failedEvent) {
      await createAuditLog({
        tenantId: input.tenantId,
        userId: input.userId,
        module: 'finance',
        entity: 'sales_invoice',
        entityId: input.invoiceId,
        action: 'SALES_INVOICE_POSTING_FAILED',
        newValues: {
          errorCode: failedEvent.errorCode,
          errorMessage: failedEvent.errorMessage,
          postingEventId: failedEvent.id,
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      }).catch(() => {})
    }
    mapPostingErrorToSalesInvoiceError(error)
  }
}

export async function canPostSalesInvoice(req: Request, status: string): Promise<boolean> {
  if (status !== 'READY_TO_POST') return false
  return hasPerm(req, 'finance.ar.invoice.post')
}
