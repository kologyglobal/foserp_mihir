/**
 * Backfill FinanceApprovalRequest rows for journals stuck in PENDING_APPROVAL without a pending request.
 * Idempotent — skips journals that already have a PENDING request.
 *
 * Usage: npx tsx backend/scripts/backfill-finance-approval-requests.ts [--tenant-id=<uuid>] [--dry-run]
 */
import { prisma } from '../src/config/database.js'
import { resolveJournalApproval } from '../src/modules/accounting/journals/journal-approval.service.js'
import { backfillApprovalRequestForJournal } from '../src/modules/accounting/approvals/approval-request.service.js'
import { JOURNAL_SOURCE_DOCUMENT_TYPE, JOURNAL_SOURCE_MODULE } from '../src/modules/accounting/journals/journal.types.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const tenantArg = args.find((a) => a.startsWith('--tenant-id='))
const tenantFilter = tenantArg?.split('=')[1]

async function main() {
  const journals = await prisma.accountingVoucher.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      voucherType: 'JOURNAL',
      sourceModule: JOURNAL_SOURCE_MODULE,
      sourceDocumentType: JOURNAL_SOURCE_DOCUMENT_TYPE,
      ...(tenantFilter ? { tenantId: tenantFilter } : {}),
    },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })

  let created = 0
  let skipped = 0
  const failures: Array<{ journalId: string; reason: string }> = []

  for (const journal of journals) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: journal.tenantId,
        documentType: 'JOURNAL',
        documentId: journal.id,
        status: 'PENDING',
      },
    })
    if (pending) {
      skipped++
      continue
    }

    const approval = await resolveJournalApproval(
      journal.tenantId,
      journal.legalEntityId,
      journal.totalDebit.toFixed(4),
      journal.totalCredit.toFixed(4),
    )

    if (dryRun) {
      console.log(`[dry-run] would backfill journal ${journal.id} (${journal.referenceNumber ?? 'no ref'})`)
      created++
      continue
    }

    const result = await backfillApprovalRequestForJournal(journal.tenantId, journal, approval)
    if (result.created) {
      created++
      console.log(`Created approval request for journal ${journal.id}`)
    } else {
      skipped++
      failures.push({ journalId: journal.id, reason: result.reason ?? 'unknown' })
      console.warn(`Skipped journal ${journal.id}: ${result.reason}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: journals.length,
        created,
        skipped,
        failures,
        dryRun,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
