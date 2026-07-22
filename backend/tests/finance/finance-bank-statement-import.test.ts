/**
 * Phase 5A2 — Bank statement CSV/XLSX import, manual entry, validation, duplicates.
 * Live MySQL. No matching / reconciliation posting / accounting mutations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const CSV = [
  'Transaction Date,Value Date,Description,Debit,Credit,Reference,Balance',
  '01/07/2026,01/07/2026,NEFT credit customer,0,40000,REF-C1,140000',
  '02/07/2026,02/07/2026,Vendor payment NEFT,25000,0,REF-D1,115000',
].join('\n')

const mappingConfig = {
  amountMode: 'DEBIT_CREDIT_COLUMNS' as const,
  dateFormat: 'DD/MM/YYYY',
  columns: {
    transactionDate: { column: 'Transaction Date' },
    valueDate: { column: 'Value Date' },
    description: { column: 'Description' },
    debitAmount: { column: 'Debit' },
    creditAmount: { column: 'Credit' },
    referenceNumber: { column: 'Reference' },
    runningBalance: { column: 'Balance' },
  },
}

async function createBankTreasury(fx: ApAllocFixture) {
  const gl = await prisma.account.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      accountCode: `BS${Date.now()}`.slice(-12),
      accountName: 'Statement Test Bank GL',
      category: 'ASSET',
      accountType: 'BANK',
      isGroup: false,
      level: 1,
    },
  })
  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      code: `STMT-BANK-${Date.now()}`,
      name: 'Statement Import Bank',
      accountType: 'BANK',
      glAccountId: gl.id,
      currencyCode: 'INR',
      bankProfile: { bankName: 'ICICI Bank', bankAccountKind: 'CURRENT', accountNumber: '998877665544' },
    })
  expect(res.status).toBe(201)
  await request(app)
    .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${res.body.data.id}/reconciliation-profile`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ duplicatePolicy: 'BLOCK', dateBasis: 'TRANSACTION_DATE' })
  return res.body.data as { id: string; currencyCode: string; updatedAt: string }
}

describe.skipIf(!dbAvailable)('Phase 5A2 — Bank statement import', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let viewerToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bs-import')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(fx)
    treasuryAccountId = bank.id
    const viewer = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.statement.view'], 'bs-viewer')
    viewerToken = viewer.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('uploads CSV, inspects, previews, imports, validates — lines remain UNMATCHED', async () => {
    const voucherBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    const glBefore = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })

    const upload = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'CSV')
      .attach('file', Buffer.from(CSV, 'utf8'), 'statement.csv')

    expect(upload.status).toBe(201)
    const batchId = upload.body.data.id as string
    expect(upload.body.data.status).toBe('UPLOADED')
    expect(upload.body.data.storageKey).toBeUndefined()

    const inspect = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/inspect`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ parsingConfig: { headerRowNumber: 1 } })
    expect(inspect.status).toBe(200)
    expect(inspect.body.data.inspect?.headers?.length || inspect.body.data.headers?.length).toBeGreaterThan(0)

    const preview = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        mappingConfig,
        parsingConfig: { headerRowNumber: 1 },
        statementReference: 'STMT-CSV-001',
        headerOverrides: { openingBalance: 100000, closingBalance: 115000 },
      })
    expect(preview.status).toBe(200)
    expect(preview.body.data.preview?.validRowCount ?? preview.body.data.validRowCount).toBeGreaterThanOrEqual(1)

    const batch = await prisma.bankStatementImportBatch.findUniqueOrThrow({ where: { id: batchId } })
    const imported = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: batch.updatedAt.toISOString(),
        mappingConfig,
        parsingConfig: { headerRowNumber: 1 },
        statementReference: 'STMT-CSV-001',
        headerOverrides: { openingBalance: 100000, closingBalance: 115000 },
        allowPartial: false,
      })
    expect(
      imported.status,
      `import failed: ${JSON.stringify({ status: imported.status, body: imported.body })}`,
    ).toBe(200)
    const statementId = (imported.body.data?.statementId ?? imported.body.data?.statement?.id) as string
    expect(statementId, `missing statementId: ${JSON.stringify(imported.body)}`).toBeTruthy()

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    const stmt = detail.body.data.statement ?? detail.body.data
    const lines = detail.body.data.lines ?? []
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.every((l: { matchStatus: string }) => l.matchStatus === 'UNMATCHED')).toBe(true)

    const validate = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: stmt.updatedAt })
    expect(validate.status).toBe(200)
    const validated = validate.body.data.statement ?? validate.body.data
    expect(['VALIDATED', 'VALIDATION_FAILED']).toContain(validated.status)

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherBefore)
    expect(await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })).toBe(glBefore)
  })

  it('blocks exact duplicate file upload by checksum', async () => {
    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'CSV')
      .attach('file', Buffer.from('Date,Description,Debit,Credit\n01/07/2026,Dup,0,100\n', 'utf8'), 'dup.csv')
    expect(first.status).toBe(201)

    const second = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'CSV')
      .attach('file', Buffer.from('Date,Description,Debit,Credit\n01/07/2026,Dup,0,100\n', 'utf8'), 'dup-again.csv')
    expect(second.status).toBe(409)
    expect(second.body.code).toMatch(/DUPLICATE/)
  })

  it('rejects executable / unsupported file types', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'CSV')
      .attach('file', Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'malware.csv')
    expect([400, 422]).toContain(res.status)
  })

  it('creates manual statement, edits, validates balance equation, cancels with reason', async () => {
    const create = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/manual`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId,
        statementReference: `MANUAL-${Date.now()}`,
        statementDate: '2026-07-10',
        periodStartDate: '2026-07-01',
        periodEndDate: '2026-07-10',
        currencyCode: 'INR',
        openingBalance: 100000,
        closingBalance: 115000,
        totalCreditAmount: 40000,
        totalDebitAmount: 25000,
      })
    expect(create.status).toBe(201)
    const statementId = create.body.data.id as string
    expect(create.body.data.status).toBe('DRAFT')

    const addCredit = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/lines`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: create.body.data.updatedAt,
        transactionDate: '2026-07-01',
        direction: 'CREDIT',
        amount: 40000,
        description: 'Manual credit',
        referenceNumber: 'M-CR-1',
      })
    expect(addCredit.status).toBe(201)

    const afterCredit = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    const stmt1 = afterCredit.body.data.statement ?? afterCredit.body.data

    const addDebit = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/lines`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: stmt1.updatedAt,
        transactionDate: '2026-07-02',
        direction: 'DEBIT',
        amount: 25000,
        description: 'Manual debit',
        referenceNumber: 'M-DR-1',
      })
    expect(addDebit.status).toBe(201)

    const afterLines = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    const stmt2 = afterLines.body.data.statement ?? afterLines.body.data
    expect((afterLines.body.data.lines ?? []).every((l: { matchStatus: string }) => l.matchStatus === 'UNMATCHED')).toBe(true)

    // Sync header totals to line totals before validate
    const patch = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: stmt2.updatedAt,
        totalCreditAmount: 40000,
        totalDebitAmount: 25000,
        openingBalance: 100000,
        closingBalance: 115000,
      })
    expect(patch.status).toBe(200)

    const validateOk = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: patch.body.data.updatedAt ?? patch.body.data.statement?.updatedAt })
    expect(validateOk.status).toBe(200)
    expect((validateOk.body.data.statement ?? validateOk.body.data).status).toBe('VALIDATED')

    const reopen = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/reopen-draft`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: (validateOk.body.data.statement ?? validateOk.body.data).updatedAt,
        reason: 'Correct a line amount',
      })
    expect(reopen.status).toBe(200)
    expect((reopen.body.data.statement ?? reopen.body.data).status).toBe('DRAFT')

    // Out-of-balance → VALIDATION_FAILED
    const badPatch = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: (reopen.body.data.statement ?? reopen.body.data).updatedAt,
        closingBalance: 114000,
      })
    const failValidate = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: (badPatch.body.data.statement ?? badPatch.body.data).updatedAt })
    expect(failValidate.status).toBe(200)
    expect((failValidate.body.data.statement ?? failValidate.body.data).status).toBe('VALIDATION_FAILED')

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        expectedUpdatedAt: (failValidate.body.data.statement ?? failValidate.body.data).updatedAt,
        reason: 'Imported against wrong account',
      })
    expect(cancel.status).toBe(200)
    expect((cancel.body.data.statement ?? cancel.body.data).status).toBe('CANCELLED')
    const retained = await prisma.bankStatement.findUnique({ where: { id: statementId } })
    expect(retained).toBeTruthy()
    expect(await prisma.bankStatementLine.count({ where: { bankStatementId: statementId } })).toBeGreaterThan(0)
  })

  it('enforces statement.view vs import permissions', async () => {
    const denied = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'CSV')
      .attach('file', Buffer.from('a,b\n1,2\n'), 'x.csv')
    expect(denied.status).toBe(403)

    const list = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(list.status).toBe(200)
  })

  it('normalises Indian decimals and signed amounts via unit-level import preview', async () => {
    const { parseConfiguredDecimal } = await import(
      '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-normalisation.service.js'
    )
    expect(parseConfiguredDecimal('1,23,456.78')?.toFixed(2)).toBe('123456.78')
    expect(parseConfiguredDecimal('123.456,78', { decimalSeparator: ',' })?.toFixed(2)).toBe('123456.78')
    expect(parseConfiguredDecimal('(1,250.00)')?.toFixed(2)).toBe('-1250.00')
  })

  it('parses ambiguous dates only with explicit format', async () => {
    const { parseConfiguredDate } = await import(
      '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-normalisation.service.js'
    )
    expect(parseConfiguredDate('01/02/2026', 'DD/MM/YYYY')?.toISOString().slice(0, 10)).toBe('2026-02-01')
    expect(parseConfiguredDate('01/02/2026', 'MM/DD/YYYY')?.toISOString().slice(0, 10)).toBe('2026-01-02')
  })
})
