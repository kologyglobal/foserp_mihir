import type { Request } from 'express'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import * as repo from '../customer-receipt.repository.js'
import { serializeCustomerReceiptDetail } from '../customer-receipt-read.service.js'
import { buildCustomerReceiptPostEventKey } from './customer-receipt-posting.types.js'
import type { PostCustomerReceiptInput, PostCustomerReceiptResult } from './customer-receipt-posting.types.js'
import { validateCustomerReceiptForPosting } from './customer-receipt-posting-validation.service.js'
import { reserveCustomerReceiptNumber } from './customer-receipt-number.service.js'
import {
  mapPostingErrorToCustomerReceiptError,
  CustomerReceiptAlreadyPostedError,
  CustomerReceiptConcurrentPostError,
  CustomerReceiptPostingNotAllowedError,
} from './customer-receipt-posting.errors.js'
import { CustomerReceiptNotFoundError } from '../customer-receipt.errors.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.ar.receipt.post')) {
    throw new CustomerReceiptPostingNotAllowedError()
  }
}

async function loadPostedResult(
  req: Request,
  tenantId: string,
  receiptId: string,
  posting: PostCustomerReceiptResult['posting'],
  idempotentReplay: boolean,
): Promise<PostCustomerReceiptResult> {
  const receipt = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
  const openItem = await prisma.receivableOpenItem.findFirst({
    where: { tenantId, customerReceiptId: receiptId },
  })
  if (!openItem) {
    throw new Error('Receivable open item missing after successful post')
  }
  const detail = await serializeCustomerReceiptDetail(req, receipt)
  return {
    receipt: detail,
    posting,
    creditOpenItemId: openItem.id,
    idempotentReplay,
  }
}

export async function postCustomerReceiptFromRequest(
  req: Request,
  tenantId: string,
  receiptId: string,
): Promise<PostCustomerReceiptResult> {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const audit = auditFromRequest(req)
  return postCustomerReceipt(
    {
      tenantId,
      receiptId,
      userId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    },
    req,
  )
}

export async function postCustomerReceipt(
  input: PostCustomerReceiptInput,
  req: Request,
): Promise<PostCustomerReceiptResult> {
  let existingReceipt
  try {
    existingReceipt = await repo.findCustomerReceiptWithDeductionsOrThrow(input.tenantId, input.receiptId)
  } catch {
    throw new CustomerReceiptNotFoundError()
  }

  if (existingReceipt.status === 'POSTED') {
    if (!existingReceipt.accountingVoucherId || !existingReceipt.postingEventId) {
      throw new CustomerReceiptAlreadyPostedError()
    }
    const posting = await buildPostedResult(
      input.tenantId,
      existingReceipt.postingEventId,
      existingReceipt.accountingVoucherId,
      true,
    )
    return loadPostedResult(req, input.tenantId, input.receiptId, posting, true)
  }

  const validated = await validateCustomerReceiptForPosting(input.tenantId, input.receiptId)
  const { receipt, postingRequest, context: postingCtx } = validated

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
        await reserveCustomerReceiptNumber(
          input.tenantId,
          receipt.legalEntityId,
          postingCtx.financialYearId,
          event,
        )
        return undefined
      },
      afterAccounting: async ({ tx, context, eventId, voucherId }) => {
        const event = await tx.postingEvent.findFirstOrThrow({
          where: { id: eventId, tenantId: context.tenantId },
        })
        const receiptNumber = event.reservedSourceDocumentNumber
        if (!receiptNumber) {
          throw new CustomerReceiptConcurrentPostError()
        }

        const openItem = await tx.receivableOpenItem.create({
          data: {
            tenantId: context.tenantId,
            legalEntityId: receipt.legalEntityId,
            branchId: receipt.branchId,
            side: 'CREDIT',
            documentType: 'CUSTOMER_RECEIPT',
            documentId: receipt.id,
            documentNumberSnapshot: receiptNumber,
            customerReceiptId: receipt.id,
            customerId: receipt.customerId,
            customerNameSnapshot: receipt.customerNameSnapshot,
            receivableAccountId: postingCtx.customerReceivableAccountId,
            currencyCode: receipt.currencyCode,
            exchangeRate: receipt.exchangeRate,
            originalAmount: receipt.grossReceiptAmount,
            openAmount: receipt.grossReceiptAmount,
            baseOriginalAmount: receipt.baseGrossReceiptAmount,
            baseOpenAmount: receipt.baseGrossReceiptAmount,
            documentDate: receipt.receiptDate,
            dueDate: null,
            status: 'OPEN',
            accountingVoucherId: voucherId,
            createdBy: context.userId ?? null,
            updatedBy: context.userId ?? null,
          },
        })
        openItemId = openItem.id

        const updated = await tx.customerReceipt.updateMany({
          where: {
            id: receipt.id,
            tenantId: context.tenantId,
            status: 'READY_TO_POST',
            receiptNumber: null,
            accountingVoucherId: null,
            creditOpenItemId: null,
          },
          data: {
            status: 'POSTED',
            receiptNumber,
            accountingVoucherId: voucherId,
            postingEventId: eventId,
            creditOpenItemId: openItem.id,
            postedAt: new Date(),
            postedBy: context.userId ?? null,
            financialYearId: postingCtx.financialYearId,
          },
        })

        if (updated.count !== 1) {
          throw new CustomerReceiptConcurrentPostError()
        }
      },
    })

    if (posting.idempotentReplay) {
      return loadPostedResult(req, input.tenantId, input.receiptId, posting, true)
    }

    const postedEvent = await prisma.postingEvent.findFirst({
      where: { id: posting.postingEventId, tenantId: input.tenantId },
      select: { reservedSourceDocumentNumber: true },
    })

    await createAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      module: 'finance',
      entity: 'customer_receipt',
      entityId: input.receiptId,
      action: 'CUSTOMER_RECEIPT_POSTED',
      newValues: {
        postingEventId: posting.postingEventId,
        voucherId: posting.voucherId,
        voucherNumber: posting.voucherNumber,
        receiptNumber: postedEvent?.reservedSourceDocumentNumber,
        grossReceiptAmount: receipt.grossReceiptAmount.toString(),
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
          customerReceiptId: input.receiptId,
          side: 'CREDIT',
          originalAmount: receipt.grossReceiptAmount.toString(),
          openAmount: receipt.grossReceiptAmount.toString(),
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
    }

    return loadPostedResult(req, input.tenantId, input.receiptId, posting, false)
  } catch (error) {
    const eventKey = buildCustomerReceiptPostEventKey(input.receiptId)
    const failedEvent = await prisma.postingEvent.findFirst({
      where: { tenantId: input.tenantId, legalEntityId: receipt.legalEntityId, eventKey, status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
    })
    if (failedEvent) {
      await createAuditLog({
        tenantId: input.tenantId,
        userId: input.userId,
        module: 'finance',
        entity: 'customer_receipt',
        entityId: input.receiptId,
        action: 'CUSTOMER_RECEIPT_POSTING_FAILED',
        newValues: {
          errorCode: failedEvent.errorCode,
          errorMessage: failedEvent.errorMessage,
          postingEventId: failedEvent.id,
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      }).catch(() => {})
    }
    mapPostingErrorToCustomerReceiptError(error)
  }
}

export async function canPostCustomerReceipt(req: Request, status: string): Promise<boolean> {
  if (status !== 'READY_TO_POST') return false
  return hasPerm(req, 'finance.ar.receipt.post')
}
