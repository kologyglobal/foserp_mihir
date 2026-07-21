import type { Request } from 'express'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { buildPostedResult, post } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import { toDecimal } from '../../../shared/finance-decimal.js'
import * as repo from '../customer-credit-note.repository.js'
import { serializeCustomerCreditNote } from '../customer-credit-note-read.service.js'
import { reserveCustomerCreditNoteNumber } from './customer-credit-note-number.service.js'
import { lockCustomerCreditNoteSource } from './customer-credit-note-source-lock.service.js'
import { validateCustomerCreditNoteForPosting } from './customer-credit-note-posting-validation.service.js'
import type { PostCustomerCreditNoteInput, PostCustomerCreditNoteResult } from './customer-credit-note-posting.types.js'
import {
  CustomerCreditNoteAlreadyPostedError,
  CustomerCreditNoteConcurrentPostError,
  CustomerCreditNotePostingNotAllowedError,
  CustomerCreditNotePostingValidationError,
  mapPostingError,
} from './customer-credit-note-posting.errors.js'

function hasPermission(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

async function loadResult(req: Request, tenantId: string, id: string, posting: Awaited<ReturnType<typeof buildPostedResult>>, replay: boolean): Promise<PostCustomerCreditNoteResult> {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  const openItem = await prisma.receivableOpenItem.findFirstOrThrow({ where: { tenantId, customerCreditNoteId: id } })
  return { creditNote: await serializeCustomerCreditNote(req, note), posting, creditOpenItemId: openItem.id, idempotentReplay: replay }
}

export async function postCustomerCreditNoteFromRequest(req: Request, tenantId: string, id: string) {
  if (!hasPermission(req, 'finance.ar.credit_note.post')) throw new CustomerCreditNotePostingNotAllowedError()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const meta = auditFromRequest(req)
  return postCustomerCreditNote({ tenantId, creditNoteId: id, userId, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, req)
}

export async function postCustomerCreditNote(input: PostCustomerCreditNoteInput, req: Request): Promise<PostCustomerCreditNoteResult> {
  const existing = await repo.findWithLinesOrThrow(input.tenantId, input.creditNoteId)
  if (existing.status === 'POSTED') {
    if (!existing.accountingVoucherId || !existing.postingEventId) throw new CustomerCreditNoteAlreadyPostedError()
    const posting = await buildPostedResult(input.tenantId, existing.postingEventId, existing.accountingVoucherId, true)
    return loadResult(req, input.tenantId, input.creditNoteId, posting, true)
  }
  const validated = await validateCustomerCreditNoteForPosting(input.tenantId, input.creditNoteId)
  const context: PostingContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: !validated.note.approvalRequired || Boolean(validated.note.approvalRequestId) },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }
  try {
    const posting = await post(validated.postingRequest, context, {
      beforeTransaction: async (event) => {
        await reserveCustomerCreditNoteNumber(input.tenantId, validated.note.legalEntityId, validated.financialYearId, event)
      },
      afterAccounting: async ({ tx, eventId, voucherId }) => {
        await lockCustomerCreditNoteSource(tx, input.tenantId, validated.note.originalInvoiceId)
        if (validated.note.originalInvoiceId) {
          const prior = await tx.customerCreditNoteLine.groupBy({
            by: ['originalInvoiceLineId'],
            where: {
              tenantId: input.tenantId,
              originalInvoiceLineId: { in: validated.note.lines.map((line) => line.originalInvoiceLineId).filter(Boolean) as string[] },
              customerCreditNote: { originalInvoiceId: validated.note.originalInvoiceId, status: 'POSTED' },
            },
            _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true },
          })
          const sourceLines = await tx.salesInvoiceLine.findMany({ where: { tenantId: input.tenantId, salesInvoiceId: validated.note.originalInvoiceId } })
          const priorById = new Map(prior.map((row) => [row.originalInvoiceLineId, row._sum]))
          for (const line of validated.note.lines) {
            const source = sourceLines.find((item) => item.id === line.originalInvoiceLineId)
            if (!source) throw new CustomerCreditNotePostingValidationError('Original invoice line is missing')
            const used = priorById.get(line.originalInvoiceLineId)
            const tax = line.cgstAmount.add(line.sgstAmount).add(line.igstAmount).add(line.cessAmount)
            const usedTax = toDecimal(used?.cgstAmount ?? 0).add(used?.sgstAmount ?? 0).add(used?.igstAmount ?? 0).add(used?.cessAmount ?? 0)
            const availableTax = source.cgstAmount.add(source.sgstAmount).add(source.igstAmount).add(source.cessAmount)
            if (line.taxableAmount.add(used?.taxableAmount ?? 0).gt(source.taxableAmount) || tax.add(usedTax).gt(availableTax)) {
              throw new CustomerCreditNotePostingValidationError('Credit note exceeds remaining creditable invoice amount')
            }
          }
        }
        const event = await tx.postingEvent.findFirstOrThrow({ where: { id: eventId, tenantId: input.tenantId } })
        if (!event.reservedSourceDocumentNumber) throw new CustomerCreditNoteConcurrentPostError()
        const openItem = await tx.receivableOpenItem.create({
          data: {
            tenantId: input.tenantId, legalEntityId: validated.note.legalEntityId, branchId: validated.note.branchId,
            side: 'CREDIT', documentType: 'CUSTOMER_CREDIT_NOTE', documentId: validated.note.id,
            documentNumberSnapshot: event.reservedSourceDocumentNumber, customerCreditNoteId: validated.note.id,
            customerId: validated.note.customerId, customerNameSnapshot: validated.note.customerNameSnapshot,
            receivableAccountId: validated.receivableAccountId, currencyCode: validated.note.currencyCode,
            exchangeRate: validated.note.exchangeRate, originalAmount: validated.note.grandTotal,
            openAmount: validated.note.grandTotal, baseOriginalAmount: validated.note.baseGrandTotal,
            baseOpenAmount: validated.note.baseGrandTotal, documentDate: validated.note.creditNoteDate,
            status: 'OPEN', accountingVoucherId: voucherId, createdBy: input.userId, updatedBy: input.userId,
          },
        })
        const updated = await tx.customerCreditNote.updateMany({
          where: {
            id: validated.note.id, tenantId: input.tenantId, status: 'READY_TO_POST',
            creditNoteNumber: null, accountingVoucherId: null, postingEventId: null, creditOpenItemId: null,
          },
          data: {
            status: 'POSTED', creditNoteNumber: event.reservedSourceDocumentNumber,
            accountingVoucherId: voucherId, postingEventId: eventId, creditOpenItemId: openItem.id,
            postedAt: new Date(), postedBy: input.userId, financialYearId: validated.financialYearId, updatedBy: input.userId,
            allocatableAmount: validated.note.grandTotal,
            allocatedAmount: 0,
            unallocatedAmount: validated.note.grandTotal,
            baseAllocatableAmount: validated.note.baseGrandTotal,
            baseAllocatedAmount: 0,
            baseUnallocatedAmount: validated.note.baseGrandTotal,
          },
        })
        if (updated.count !== 1) throw new CustomerCreditNoteConcurrentPostError()
      },
    })
    if (!posting.idempotentReplay) {
      await createAuditLog({
        tenantId: input.tenantId, userId: input.userId, module: 'finance', entity: 'customer_credit_note',
        entityId: input.creditNoteId, action: 'CUSTOMER_CREDIT_NOTE_POSTED',
        newValues: { postingEventId: posting.postingEventId, voucherId: posting.voucherId },
        ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
      })
    }
    return loadResult(req, input.tenantId, input.creditNoteId, posting, posting.idempotentReplay)
  } catch (error) {
    mapPostingError(error)
  }
}
