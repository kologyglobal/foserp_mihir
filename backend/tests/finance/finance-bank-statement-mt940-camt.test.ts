/**
 * Phase 5A2+ — MT940 + CAMT.053 structured bank statement ingest.
 * Parser unit tests always run; live import path skips without MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { parseMt940Buffer } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-mt940-parser.service.js'
import { parseCamt053Buffer, assertSafeCamtXml } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-camt053-parser.service.js'
import { detectBankStatementFormat } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-format-detect.service.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../fixtures/bank-statements')
const mt940Buf = readFileSync(resolve(fixturesDir, 'sample.mt940'))
const camtBuf = readFileSync(resolve(fixturesDir, 'sample.camt053.xml'))

const app = createApp()
const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe('Bank statement MT940 / CAMT.053 parsers', () => {
  it('parses MT940 fixture into normalised header + lines', () => {
    const result = parseMt940Buffer(mt940Buf)
    expect(result.format).toBe('MT940')
    expect(result.header.statementReference).toBe('STMT-MT940-001')
    expect(result.header.openingBalance).toBe('100000.00')
    expect(result.header.closingBalance).toBe('115000.00')
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]!.direction).toBe('CREDIT')
    expect(result.lines[0]!.amount).toBe('40000.00')
    expect(result.lines[1]!.direction).toBe('DEBIT')
    expect(result.lines[1]!.amount).toBe('25000.00')
    expect(result.issues.filter((i) => i.severity === 'ERROR' || i.severity === 'BLOCKER')).toHaveLength(0)
  })

  it('parses CAMT.053 fixture into normalised header + lines', () => {
    const result = parseCamt053Buffer(camtBuf)
    expect(result.format).toBe('CAMT_053')
    expect(result.header.statementReference).toBe('STMT-CAMT-001')
    expect(result.header.openingBalance).toBe('100000.00')
    expect(result.header.closingBalance).toBe('115000.00')
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]!.direction).toBe('CREDIT')
    expect(result.lines[0]!.amount).toBe('40000.00')
    expect(result.lines[1]!.direction).toBe('DEBIT')
    expect(result.lines[1]!.amount).toBe('25000.00')
    expect(result.issues.filter((i) => i.severity === 'ERROR' || i.severity === 'BLOCKER')).toHaveLength(0)
  })

  it('rejects malformed MT940 (no :20: / :61:)', () => {
    const result = parseMt940Buffer(Buffer.from('hello world\nnot a statement\n', 'utf8'))
    expect(result.lines).toHaveLength(0)
    expect(result.issues.some((i) => i.severity === 'BLOCKER')).toBe(true)
  })

  it('rejects CAMT XML with DTD/ENTITY (XXE guard)', () => {
    const evil = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt><Id>x</Id></Stmt></BkToCstmrStmt></Document>`
    expect(() => assertSafeCamtXml(evil)).toThrow(/DTD|ENTITY/i)
    expect(() => parseCamt053Buffer(Buffer.from(evil, 'utf8'))).toThrow()
  })

  it('AUTO_DETECT resolves extension + content', () => {
    expect(detectBankStatementFormat(mt940Buf, 'stmt.sta', 'AUTO_DETECT')).toBe('MT940')
    expect(detectBankStatementFormat(camtBuf, 'stmt.xml', 'AUTO_DETECT')).toBe('CAMT_053')
    expect(detectBankStatementFormat(mt940Buf, 'stmt.txt', 'AUTO_DETECT')).toBe('MT940')
    expect(detectBankStatementFormat(Buffer.from('a,b\n1,2\n'), 'x.csv', 'AUTO_DETECT')).toBe('CSV')
  })
})

describe.skipIf(!dbAvailable)('Bank statement MT940 / CAMT.053 import (live)', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bs-mt940')
    fx = await bootstrapApAllocFixture(app, ctx)
    const gl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `MT${Date.now()}`.slice(-12),
        accountName: 'MT940 Test Bank GL',
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
        code: `MT940-BANK-${Date.now()}`,
        name: 'MT940 Import Bank',
        accountType: 'BANK',
        glAccountId: gl.id,
        currencyCode: 'INR',
        bankProfile: { bankName: 'HDFC', bankAccountKind: 'CURRENT', accountNumber: '112233445566' },
      })
    expect(res.status).toBe(201)
    treasuryAccountId = res.body.data.id
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('imports MT940 happy path without column mapping', async () => {
    const upload = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'MT940')
      .attach('file', mt940Buf, 'sample.mt940')

    expect(upload.status).toBe(201)
    expect(upload.body.data.importFormat).toBe('MT940')
    const batchId = upload.body.data.id as string

    const inspect = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/inspect`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(inspect.status).toBe(200)
    expect(inspect.body.data.requiresColumnMapping).toBe(false)

    const preview = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(preview.status).toBe(200)
    expect(preview.body.data.preview?.validRowCount ?? 0).toBeGreaterThanOrEqual(2)

    const batch = await prisma.bankStatementImportBatch.findUniqueOrThrow({ where: { id: batchId } })
    const imported = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: batch.updatedAt.toISOString(), allowPartial: false })
    expect(imported.status).toBe(200)
    expect(imported.body.data.statementId).toBeTruthy()
  })

  it('imports CAMT.053 via AUTO_DETECT', async () => {
    const upload = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .field('treasuryAccountId', treasuryAccountId)
      .field('importFormat', 'AUTO_DETECT')
      .attach('file', camtBuf, 'sample.camt053.xml')

    expect(upload.status).toBe(201)
    expect(upload.body.data.importFormat).toBe('CAMT_053')
    const batchId = upload.body.data.id as string

    const batch = await prisma.bankStatementImportBatch.findUniqueOrThrow({ where: { id: batchId } })
    const imported = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/import-batches/${batchId}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: batch.updatedAt.toISOString(), allowPartial: false })
    expect(
      imported.status,
      `camt import: ${JSON.stringify({ status: imported.status, body: imported.body })}`,
    ).toBe(200)
  })
})
