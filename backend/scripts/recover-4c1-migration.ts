import { prisma } from '../src/config/database.js'

/**
 * Completes partial Phase 4C1 migration after index-name failure,
 * then caller should run: npx tsx scripts/prisma-cli.ts migrate resolve --applied 20260719010000_finance_phase4c1_ap_reversal
 */
async function main() {
  // Ensure document FKs (idempotent via information_schema check)
  async function ensureFk(table: string, name: string, sql: string) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      table,
      name,
    )) as unknown[]
    if (rows.length === 0) {
      await prisma.$executeRawUnsafe(sql)
      console.log('added FK', name)
    } else {
      console.log('FK exists', name)
    }
  }

  async function ensureIndex(table: string, name: string, sql: string) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
      table,
      name,
    )) as unknown[]
    if (rows.length === 0) {
      await prisma.$executeRawUnsafe(sql)
      console.log('added index', name)
    } else {
      console.log('index exists', name)
    }
  }

  await ensureFk(
    'vendor_invoices',
    'vendor_invoices_reversalVoucherId_fkey',
    `ALTER TABLE vendor_invoices ADD CONSTRAINT vendor_invoices_reversalVoucherId_fkey FOREIGN KEY (reversalVoucherId) REFERENCES accounting_vouchers(id) ON DELETE SET NULL ON UPDATE CASCADE`,
  )
  await ensureFk(
    'vendor_invoices',
    'vendor_invoices_reversalPostingEventId_fkey',
    `ALTER TABLE vendor_invoices ADD CONSTRAINT vendor_invoices_reversalPostingEventId_fkey FOREIGN KEY (reversalPostingEventId) REFERENCES posting_events(id) ON DELETE SET NULL ON UPDATE CASCADE`,
  )
  await ensureFk(
    'vendor_payments',
    'vendor_payments_reversalVoucherId_fkey',
    `ALTER TABLE vendor_payments ADD CONSTRAINT vendor_payments_reversalVoucherId_fkey FOREIGN KEY (reversalVoucherId) REFERENCES accounting_vouchers(id) ON DELETE SET NULL ON UPDATE CASCADE`,
  )
  await ensureFk(
    'vendor_payments',
    'vendor_payments_reversalPostingEventId_fkey',
    `ALTER TABLE vendor_payments ADD CONSTRAINT vendor_payments_reversalPostingEventId_fkey FOREIGN KEY (reversalPostingEventId) REFERENCES posting_events(id) ON DELETE SET NULL ON UPDATE CASCADE`,
  )

  await ensureIndex(
    'payable_allocation_reversal_batches',
    'pay_alloc_rev_batch_vendor_idx',
    `CREATE INDEX pay_alloc_rev_batch_vendor_idx ON payable_allocation_reversal_batches(tenantId, legalEntityId, vendorId)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_batches',
    'pay_alloc_rev_batch_alloc_idx',
    `CREATE INDEX pay_alloc_rev_batch_alloc_idx ON payable_allocation_reversal_batches(allocationBatchId)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_batches',
    'pay_alloc_rev_batch_date_idx',
    `CREATE INDEX pay_alloc_rev_batch_date_idx ON payable_allocation_reversal_batches(reversalDate)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_batches',
    'pay_alloc_rev_batch_created_idx',
    `CREATE INDEX pay_alloc_rev_batch_created_idx ON payable_allocation_reversal_batches(createdAt)`,
  )

  await ensureFk(
    'payable_allocation_reversal_batches',
    'payable_allocation_reversal_batches_tenantId_fkey',
    `ALTER TABLE payable_allocation_reversal_batches ADD CONSTRAINT payable_allocation_reversal_batches_tenantId_fkey FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_batches',
    'payable_allocation_reversal_batches_legalEntityId_fkey',
    `ALTER TABLE payable_allocation_reversal_batches ADD CONSTRAINT payable_allocation_reversal_batches_legalEntityId_fkey FOREIGN KEY (legalEntityId) REFERENCES legal_entities(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_batches',
    'payable_allocation_reversal_batches_branchId_fkey',
    `ALTER TABLE payable_allocation_reversal_batches ADD CONSTRAINT payable_allocation_reversal_batches_branchId_fkey FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_batches',
    'payable_allocation_reversal_batches_allocationBatchId_fkey',
    `ALTER TABLE payable_allocation_reversal_batches ADD CONSTRAINT payable_allocation_reversal_batches_allocationBatchId_fkey FOREIGN KEY (allocationBatchId) REFERENCES payable_allocation_batches(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )

  const lines = (await prisma.$queryRawUnsafe(
    "SHOW TABLES LIKE 'payable_allocation_reversal_lines'",
  )) as unknown[]
  if (lines.length === 0) {
    await prisma.$executeRawUnsafe(`
CREATE TABLE payable_allocation_reversal_lines (
  id VARCHAR(191) NOT NULL,
  tenantId VARCHAR(191) NOT NULL,
  legalEntityId VARCHAR(191) NOT NULL,
  reversalBatchId VARCHAR(191) NOT NULL,
  allocationLineId VARCHAR(191) NOT NULL,
  sourceDebitOpenItemId VARCHAR(191) NOT NULL,
  targetCreditOpenItemId VARCHAR(191) NOT NULL,
  reversedAmount DECIMAL(18, 4) NOT NULL,
  baseReversedAmount DECIMAL(18, 4) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log('created payable_allocation_reversal_lines')
  }

  await ensureIndex(
    'payable_allocation_reversal_lines',
    'pay_alloc_rev_line_le_idx',
    `CREATE INDEX pay_alloc_rev_line_le_idx ON payable_allocation_reversal_lines(tenantId, legalEntityId)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_lines',
    'pay_alloc_rev_line_batch_idx',
    `CREATE INDEX pay_alloc_rev_line_batch_idx ON payable_allocation_reversal_lines(reversalBatchId)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_lines',
    'pay_alloc_rev_line_alloc_idx',
    `CREATE INDEX pay_alloc_rev_line_alloc_idx ON payable_allocation_reversal_lines(allocationLineId)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_lines',
    'pay_alloc_rev_line_debit_idx',
    `CREATE INDEX pay_alloc_rev_line_debit_idx ON payable_allocation_reversal_lines(sourceDebitOpenItemId)`,
  )
  await ensureIndex(
    'payable_allocation_reversal_lines',
    'pay_alloc_rev_line_credit_idx',
    `CREATE INDEX pay_alloc_rev_line_credit_idx ON payable_allocation_reversal_lines(targetCreditOpenItemId)`,
  )

  await ensureFk(
    'payable_allocation_reversal_lines',
    'payable_allocation_reversal_lines_tenantId_fkey',
    `ALTER TABLE payable_allocation_reversal_lines ADD CONSTRAINT payable_allocation_reversal_lines_tenantId_fkey FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_lines',
    'payable_allocation_reversal_lines_legalEntityId_fkey',
    `ALTER TABLE payable_allocation_reversal_lines ADD CONSTRAINT payable_allocation_reversal_lines_legalEntityId_fkey FOREIGN KEY (legalEntityId) REFERENCES legal_entities(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_lines',
    'payable_allocation_reversal_lines_reversalBatchId_fkey',
    `ALTER TABLE payable_allocation_reversal_lines ADD CONSTRAINT payable_allocation_reversal_lines_reversalBatchId_fkey FOREIGN KEY (reversalBatchId) REFERENCES payable_allocation_reversal_batches(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_lines',
    'payable_allocation_reversal_lines_allocationLineId_fkey',
    `ALTER TABLE payable_allocation_reversal_lines ADD CONSTRAINT payable_allocation_reversal_lines_allocationLineId_fkey FOREIGN KEY (allocationLineId) REFERENCES payable_allocation_lines(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_lines',
    'payable_allocation_reversal_lines_sourceDebitOpenItemId_fkey',
    `ALTER TABLE payable_allocation_reversal_lines ADD CONSTRAINT payable_allocation_reversal_lines_sourceDebitOpenItemId_fkey FOREIGN KEY (sourceDebitOpenItemId) REFERENCES payable_open_items(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )
  await ensureFk(
    'payable_allocation_reversal_lines',
    'payable_allocation_reversal_lines_targetCreditOpenItemId_fkey',
    `ALTER TABLE payable_allocation_reversal_lines ADD CONSTRAINT payable_allocation_reversal_lines_targetCreditOpenItemId_fkey FOREIGN KEY (targetCreditOpenItemId) REFERENCES payable_open_items(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
  )

  console.log('recovery complete')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
