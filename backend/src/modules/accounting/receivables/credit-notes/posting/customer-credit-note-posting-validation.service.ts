import { prisma } from '../../../../../config/database.js'
import { compare } from '../../../shared/finance-decimal.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { requireActiveCustomerParty } from '../../customer-party/customer-party.service.js'
import * as repo from '../customer-credit-note.repository.js'
import type { CreateCustomerCreditNoteInput } from '../customer-credit-note.schemas.js'
import { calculateAndValidateCreditNote } from '../customer-credit-note-validation.service.js'
import { buildCustomerCreditNotePostingRequest } from './customer-credit-note-accounting-builder.service.js'
import {
  CustomerCreditNoteAlreadyPostedError,
  CustomerCreditNoteApprovalNotSatisfiedError,
  CustomerCreditNoteChangedAfterReadyError,
  CustomerCreditNoteNotReadyError,
  CustomerCreditNoteAccountNotReadyError,
} from './customer-credit-note-posting.errors.js'

export async function validateCustomerCreditNoteForPosting(tenantId: string, id: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  if (note.status === 'POSTED') throw new CustomerCreditNoteAlreadyPostedError()
  if (note.status !== 'READY_TO_POST') throw new CustomerCreditNoteNotReadyError()
  if (note.creditNoteNumber || note.accountingVoucherId || note.postingEventId || note.creditOpenItemId) {
    throw new CustomerCreditNoteAlreadyPostedError()
  }
  await requireActiveCustomerParty(tenantId, note.customerId)
  if (note.approvalRequired) {
    if (!note.approvalRequestId) throw new CustomerCreditNoteApprovalNotSatisfiedError()
    const approval = await prisma.financeApprovalRequest.findFirst({
      where: { id: note.approvalRequestId, tenantId, documentType: 'CREDIT_NOTE', documentId: id, status: 'APPROVED' },
    })
    if (!approval) throw new CustomerCreditNoteApprovalNotSatisfiedError()
  }
  const context = note.calculationContext as unknown as CreateCustomerCreditNoteInput
  const { calculation } = await calculateAndValidateCreditNote(tenantId, note.legalEntityId, context, id)
  if (
    compare(note.grandTotal, calculation.grandTotal) !== 0 ||
    compare(note.taxableAmount, calculation.taxableAmount) !== 0 ||
    compare(note.totalTaxAmount, calculation.totalTaxAmount) !== 0
  ) throw new CustomerCreditNoteChangedAfterReadyError()

  const postingDate = (note.postingDate ?? note.creditNoteDate).toISOString().slice(0, 10)
  const period = await resolvePostingPeriod(tenantId, note.legalEntityId, postingDate)
  const receivable = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId: note.legalEntityId, mappingKey: 'CUSTOMER_RECEIVABLE' },
    include: { account: true },
  })
  if (!receivable?.account || !receivable.account.isActive || receivable.account.isGroup) {
    throw new CustomerCreditNoteAccountNotReadyError('Configure a postable CUSTOMER_RECEIVABLE account')
  }
  return {
    note,
    postingRequest: buildCustomerCreditNotePostingRequest(note, receivable.account.id),
    financialYearId: period.financialYear.id,
    receivableAccountId: receivable.account.id,
  }
}
