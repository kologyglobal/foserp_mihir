/**
 * Read-only finance integrity checks for the Accounting Verification Gate.
 * Does not mutate or repair data.
 *
 * Usage: npx tsx scripts/verify-finance-integrity.ts [--tenant=<tenantId>] [--legalEntity=<id>]
 */
import { prisma } from '../src/config/database.js'

type Severity = 'P0' | 'P1' | 'P2' | 'INFO'
type CheckResult = {
  check: string
  status: 'PASS' | 'FAIL' | 'WARN'
  count: number
  examples: string[]
  severity: Severity
}

const args = process.argv.slice(2)
const tenantArg = args.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length)
const legalEntityArg = args.find((a) => a.startsWith('--legalEntity='))?.slice('--legalEntity='.length)

const scope = {
  ...(tenantArg ? { tenantId: tenantArg } : {}),
  ...(legalEntityArg ? { legalEntityId: legalEntityArg } : {}),
}

const results: CheckResult[] = []

function record(
  check: string,
  count: number,
  examples: string[],
  severity: Severity,
  warnOnly = false,
) {
  const status = count === 0 ? 'PASS' : warnOnly ? 'WARN' : 'FAIL'
  results.push({ check, status, count, examples: examples.slice(0, 5), severity })
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '○' : '✗'
  console.log(
    `  ${icon} [${severity}] ${check} — count=${count}${examples[0] ? ` eg=${examples[0]}` : ''}`,
  )
}

async function main() {
  console.log('\nFinance integrity (read-only)')
  console.log(`Scope: ${tenantArg ? `tenant=${tenantArg}` : 'all tenants'}${legalEntityArg ? ` legalEntity=${legalEntityArg}` : ''}\n`)

  // Posted voucher without lines
  {
    const rows = await prisma.accountingVoucher.findMany({
      where: { ...scope, status: { in: ['POSTED', 'REVERSED'] }, lines: { none: {} } },
      select: { id: true, voucherNumber: true },
      take: 20,
    })
    record(
      'Posted/reversed voucher without lines',
      rows.length,
      rows.map((r) => r.voucherNumber ?? r.id),
      'P0',
    )
  }

  // Posted voucher without GL
  {
    const rows = await prisma.accountingVoucher.findMany({
      where: { ...scope, status: { in: ['POSTED', 'REVERSED'] }, generalLedgerEntries: { none: {} } },
      select: { id: true, voucherNumber: true },
      take: 20,
    })
    record(
      'Posted/reversed voucher without GL entries',
      rows.length,
      rows.map((r) => r.voucherNumber ?? r.id),
      'P0',
    )
  }

  // Voucher unbalanced (txn + base)
  {
    const unbalanced = await prisma.$queryRawUnsafe<Array<{ id: string; voucherNumber: string | null }>>(
      `SELECT id, voucherNumber FROM accounting_vouchers
       WHERE status IN ('POSTED','REVERSED')
         ${tenantArg ? 'AND tenantId = ?' : ''}
         ${legalEntityArg ? 'AND legalEntityId = ?' : ''}
         AND (totalDebit <> totalCredit OR baseTotalDebit <> baseTotalCredit)
       LIMIT 20`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    record(
      'Posted voucher debit != credit (txn or base)',
      unbalanced.length,
      unbalanced.map((r) => r.voucherNumber ?? r.id),
      'P0',
    )
  }

  // GL without voucher (orphan FK — should be impossible with required FK)
  {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT g.id FROM general_ledger_entries g
       LEFT JOIN accounting_vouchers v ON v.id = g.voucherId
       WHERE v.id IS NULL
         ${tenantArg ? 'AND g.tenantId = ?' : ''}
         ${legalEntityArg ? 'AND g.legalEntityId = ?' : ''}
       LIMIT 20`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    record('GL entry without voucher', rows.length, rows.map((r) => r.id), 'P0')
  }

  // Duplicate PostingEvent key
  {
    const dups = await prisma.$queryRawUnsafe<Array<{ eventKey: string; c: bigint }>>(
      `SELECT eventKey, COUNT(*) AS c FROM posting_events
       ${tenantArg ? 'WHERE tenantId = ?' : ''}
       GROUP BY eventKey HAVING COUNT(*) > 1 LIMIT 20`,
      ...(tenantArg ? [tenantArg] : []),
    )
    record(
      'Duplicate PostingEvent eventKey',
      dups.length,
      dups.map((d) => d.eventKey),
      'P0',
    )
  }

  // Source marked REVERSED without reverse link
  {
    const rows = await prisma.accountingVoucher.findMany({
      where: { ...scope, status: 'REVERSED', reversedByVoucherId: null },
      select: { id: true, voucherNumber: true },
      take: 20,
    })
    record(
      'Voucher REVERSED without reversedByVoucherId',
      rows.length,
      rows.map((r) => r.voucherNumber ?? r.id),
      'P0',
    )
  }

  // Reversal link without source (orphan reversalOf) — left join
  {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; voucherNumber: string | null }>>(
      `SELECT r.id, r.voucherNumber FROM accounting_vouchers r
       LEFT JOIN accounting_vouchers o ON o.id = r.reversalOfVoucherId
       WHERE r.reversalOfVoucherId IS NOT NULL AND o.id IS NULL
         ${tenantArg ? 'AND r.tenantId = ?' : ''}
         ${legalEntityArg ? 'AND r.legalEntityId = ?' : ''}
       LIMIT 20`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    record(
      'Reversal voucher with broken reversalOfVoucherId',
      rows.length,
      rows.map((r) => r.voucherNumber ?? r.id),
      'P0',
    )
  }

  // Negative open-item outstanding
  {
    const rows = await prisma.receivableOpenItem.findMany({
      where: {
        ...scope,
        OR: [{ openAmount: { lt: 0 } }, { baseOpenAmount: { lt: 0 } }],
      },
      select: { id: true, documentNumberSnapshot: true },
      take: 20,
    })
    record(
      'Open item with negative outstanding',
      rows.length,
      rows.map((r) => r.documentNumberSnapshot ?? r.id),
      'P0',
    )
  }

  // Outstanding above original
  {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; doc: string | null }>>(
      `SELECT id, documentNumberSnapshot AS doc FROM receivable_open_items
       WHERE openAmount > originalAmount
         ${tenantArg ? 'AND tenantId = ?' : ''}
         ${legalEntityArg ? 'AND legalEntityId = ?' : ''}
       LIMIT 20`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    record(
      'Open item outstanding > original',
      rows.length,
      rows.map((r) => r.doc ?? r.id),
      'P0',
    )
  }

  // Allocated above original
  {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; doc: string | null }>>(
      `SELECT id, documentNumberSnapshot AS doc FROM receivable_open_items
       WHERE allocatedAmount > originalAmount
         ${tenantArg ? 'AND tenantId = ?' : ''}
         ${legalEntityArg ? 'AND legalEntityId = ?' : ''}
       LIMIT 20`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    record(
      'Open item allocated > original',
      rows.length,
      rows.map((r) => r.doc ?? r.id),
      'P0',
    )
  }

  // Settled with non-zero outstanding
  {
    const rows = await prisma.receivableOpenItem.findMany({
      where: { ...scope, status: 'SETTLED', openAmount: { gt: 0 } },
      select: { id: true, documentNumberSnapshot: true },
      take: 20,
    })
    record(
      'SETTLED open item with outstanding > 0',
      rows.length,
      rows.map((r) => r.documentNumberSnapshot ?? r.id),
      'P0',
    )
  }

  // Receipt REVERSED still with allocatable credit open
  {
    const rows = await prisma.customerReceipt.findMany({
      where: {
        ...scope,
        status: 'REVERSED',
        unallocatedAmount: { gt: 0 },
      },
      select: { id: true, receiptNumber: true },
      take: 20,
    })
    record(
      'REVERSED receipt with unallocatedAmount > 0',
      rows.length,
      rows.map((r) => r.receiptNumber ?? r.id),
      'P0',
    )
  }

  // CN REVERSED still with unallocated credit
  {
    const rows = await prisma.customerCreditNote.findMany({
      where: {
        ...scope,
        status: 'REVERSED',
        unallocatedAmount: { gt: 0 },
      },
      select: { id: true, creditNoteNumber: true },
      take: 20,
    })
    record(
      'REVERSED credit note with unallocatedAmount > 0',
      rows.length,
      rows.map((r) => r.creditNoteNumber ?? r.id),
      'P0',
    )
  }

  // Active (POSTED) allocation batches marked REVERSED inconsistently — count POSTED batches ok
  {
    const activeAfterReverse = await prisma.customerReceiptAllocation.findMany({
      where: {
        ...scope,
        status: 'POSTED',
        batch: { status: 'REVERSED' },
      },
      select: { id: true },
      take: 20,
    })
    record(
      'POSTED receipt allocation under REVERSED batch',
      activeAfterReverse.length,
      activeAfterReverse.map((r) => r.id),
      'P0',
    )
  }

  // AR-to-GL reconciliation snapshot (INFO/P0 if mismatch on live control accounts)
  {
    const gl = await prisma.$queryRawUnsafe<Array<{ accountId: string; net: string }>>(
      `SELECT accountId,
              CAST(SUM(baseDebitAmount) - SUM(baseCreditAmount) AS CHAR) AS net
       FROM general_ledger_entries
       WHERE 1=1
       ${tenantArg ? 'AND tenantId = ?' : ''}
       ${legalEntityArg ? 'AND legalEntityId = ?' : ''}
       GROUP BY accountId`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    const sub = await prisma.$queryRawUnsafe<Array<{ accountId: string; net: string }>>(
      `SELECT receivableAccountId AS accountId,
              CAST(
                SUM(CASE WHEN side = 'DEBIT' THEN baseOpenAmount ELSE 0 END)
                - SUM(CASE WHEN side = 'CREDIT' THEN baseOpenAmount ELSE 0 END)
              AS CHAR) AS net
       FROM receivable_open_items
       WHERE receivableAccountId IS NOT NULL
         AND status IN ('OPEN','PARTIALLY_SETTLED')
         ${tenantArg ? 'AND tenantId = ?' : ''}
         ${legalEntityArg ? 'AND legalEntityId = ?' : ''}
       GROUP BY receivableAccountId`,
      ...[tenantArg, legalEntityArg].filter(Boolean),
    )
    const glMap = new Map(gl.map((g) => [g.accountId, Number(g.net)]))
    const mismatches: string[] = []
    for (const s of sub) {
      const g = glMap.get(s.accountId) ?? 0
      const sn = Number(s.net)
      if (Math.abs(g - sn) > 0.02) {
        mismatches.push(`${s.accountId.slice(0, 8)}… gl=${g} sub=${sn}`)
      }
    }
    record(
      'AR control GL vs open-item net (active OPEN/PARTIAL)',
      mismatches.length,
      mismatches,
      'P0',
      gl.length === 0 && sub.length === 0,
    )
  }

  const failed = results.filter((r) => r.status === 'FAIL')
  const warned = results.filter((r) => r.status === 'WARN')
  const p0 = failed.filter((r) => r.severity === 'P0')

  console.log(`\nSummary: ${results.length} checks, ${failed.length} FAIL, ${warned.length} WARN, ${p0.length} P0 FAIL\n`)

  if (p0.length > 0) process.exit(2)
  if (failed.length > 0) process.exit(1)
  process.exit(0)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
