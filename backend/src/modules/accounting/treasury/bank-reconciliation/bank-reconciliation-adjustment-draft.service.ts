import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { createJournal } from '../../journals/journal.service.js'
import type { CreateJournalInput } from '../../journals/journal.schemas.js'
import type { JournalDetailDto } from '../../journals/journal.types.js'
import { auditBankReconciliation } from './bank-reconciliation-audit.service.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import type { CreateAdjustmentDraftBodyInput } from './bank-reconciliation.schemas.js'
import type { ReconciliationContext } from './bank-reconciliation.types.js'

/**
 * Creates a DRAFT journal (never auto-posted) linked to a bank statement line — e.g. for bank
 * charges/interest that need a real accounting entry before they can be matched. The line stays
 * UNMATCHED until the draft is later validated/submitted/posted through the normal journal
 * workflow and then matched (DIRECT, since it will land on the bank's own GL account) or manually
 * linked. "Do NOT post journals from statement without draft workflow" is enforced by delegating
 * entirely to the journal module's draft-only `createJournal`.
 */
export async function createAdjustmentDraftForLine(
  req: Request,
  tenantId: string,
  statementId: string,
  lineId: string,
  input: CreateAdjustmentDraftBodyInput,
  context: ReconciliationContext,
): Promise<JournalDetailDto> {
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  const line = await readRepo.getStatementLineOrThrow(tenantId, statementId, lineId)

  const journalInput: CreateJournalInput = {
    legalEntityId: input.legalEntityId,
    branchId: input.branchId ?? null,
    documentDate: input.documentDate,
    postingDate: input.postingDate,
    referenceNumber: line.referenceNumber ?? null,
    externalReference: null,
    narration: input.narration ?? `Bank statement line adjustment — ${line.description ?? line.id}`,
    currencyCode: input.currencyCode ?? statement.currencyCode,
    lines: input.lines.map((l) => ({
      lineNumber: l.lineNumber,
      accountId: l.accountId,
      partyType: l.partyType ?? null,
      partyId: l.partyId ?? null,
      partyNameSnapshot: l.partyNameSnapshot ?? null,
      debitAmount: l.debitAmount ?? '0',
      creditAmount: l.creditAmount ?? '0',
      currencyCode: l.currencyCode,
      exchangeRate: l.exchangeRate,
      lineNarration: l.lineNarration ?? null,
    })),
  }

  const journal = await createJournal(req, tenantId, journalInput)

  await prisma.bankStatementLine.update({
    where: { id: line.id },
    data: { linkedJournalId: journal.id },
  })

  await auditBankReconciliation(context, 'bank_statement_line', line.id, 'BANK_RECON_ADJUSTMENT_DRAFT_CREATED', {
    journalId: journal.id,
    statementId,
    lineId,
  })

  return journal
}
