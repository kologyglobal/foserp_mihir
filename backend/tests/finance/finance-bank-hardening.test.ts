/**
 * Bank hardening — distributed connector sync lease + CAMT.052/.054 parsers + supersession.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { parseCamt052Buffer } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-camt052-parser.service.js'
import { parseCamt053Buffer } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-camt053-parser.service.js'
import { parseCamt054Buffer } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-camt054-parser.service.js'
import { detectBankStatementFormat } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-format-detect.service.js'
import { detectCamtFamily } from '../../src/modules/accounting/treasury/bank-statements/import/bank-statement-camt-common.js'
import { buildStatementLineHash } from '../../src/modules/accounting/treasury/bank-statements/bank-statement-identity.service.js'
import {
  markProvisionalLineSuperseded,
  resolveLineSupersession,
} from '../../src/modules/accounting/treasury/bank-statements/bank-statement-supersession.service.js'
import { validateStatementHeader } from '../../src/modules/accounting/treasury/bank-statements/bank-statement-validation.service.js'
import * as connectorRepo from '../../src/modules/accounting/treasury/bank-connectors/bank-connector.repository.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createAdjustmentBankAccount } from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../fixtures/bank-statements')
const camt052Buf = readFileSync(resolve(fixturesDir, 'sample.camt052.xml'))
const camt053Buf = readFileSync(resolve(fixturesDir, 'sample.camt053.xml'))
const camt054Buf = readFileSync(resolve(fixturesDir, 'sample.camt054.xml'))

const app = createApp()
const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe('CAMT.052 / CAMT.054 parsers + format detect', () => {
  it('parses CAMT.052 as provisional intraday with optional balances', () => {
    const result = parseCamt052Buffer(camt052Buf)
    expect(result.format).toBe('CAMT_052')
    expect(result.header.documentType).toBe('INTRADAY_REPORT')
    expect(result.header.isProvisional).toBe(true)
    expect(result.header.hasOpeningBalance).toBe(true)
    expect(result.header.hasClosingBalance).toBe(false)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]!.amount).toBe('40000.00')
    expect(result.lines[0]!.externalTransactionId).toBe('TX-C1')
  })

  it('parses CAMT.054 debit/credit notifications without balances', () => {
    const result = parseCamt054Buffer(camt054Buf)
    expect(result.format).toBe('CAMT_054')
    expect(result.header.documentType).toBe('DEBIT_CREDIT_NOTIFICATION')
    expect(result.header.isProvisional).toBe(true)
    expect(result.header.hasOpeningBalance).toBe(false)
    expect(result.header.hasClosingBalance).toBe(false)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]!.direction).toBe('CREDIT')
    expect(result.lines[1]!.direction).toBe('DEBIT')
  })

  it('AUTO_DETECT distinguishes CAMT families by root/namespace', () => {
    expect(detectCamtFamily(camt052Buf.toString('utf8'))).toBe('CAMT_052')
    expect(detectCamtFamily(camt053Buf.toString('utf8'))).toBe('CAMT_053')
    expect(detectCamtFamily(camt054Buf.toString('utf8'))).toBe('CAMT_054')
    expect(detectBankStatementFormat(camt052Buf, 'intraday.xml', 'AUTO_DETECT')).toBe('CAMT_052')
    expect(detectBankStatementFormat(camt054Buf, 'notify.xml', 'AUTO_DETECT')).toBe('CAMT_054')
  })

  it('rejects explicit format / detected root mismatch', () => {
    expect(() => detectBankStatementFormat(camt052Buf, 'x.xml', 'CAMT_053')).toThrow(/does not match/i)
    expect(() => parseCamt053Buffer(camt054Buf)).toThrow(/does not match/i)
  })

  it('rejects unknown XML CAMT family on AUTO_DETECT', () => {
    const unknown = Buffer.from(
      `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.999.001.01"><Foo><Id>x</Id></Foo></Document>`,
      'utf8',
    )
    expect(() => detectBankStatementFormat(unknown, 'x.xml', 'AUTO_DETECT')).toThrow(/not a recognised CAMT/i)
  })

  it('skips balance continuity when opening/closing flags are false', () => {
    const result = validateStatementHeader({
      openingBalance: '0',
      closingBalance: '0',
      totalCreditAmount: '100',
      totalDebitAmount: '0',
      periodStartDate: new Date('2026-07-01T00:00:00Z'),
      periodEndDate: new Date('2026-07-02T00:00:00Z'),
      statementDate: new Date('2026-07-02T00:00:00Z'),
      currencyCode: 'INR',
      treasuryAccountCurrencyCode: 'INR',
      hasOpeningBalance: false,
      hasClosingBalance: false,
    })
    expect(result.valid).toBe(true)
  })
})

describe.skipIf(!dbAvailable)('Bank connector sync lease (live DB)', () => {
  let fx: ApAllocFixture
  let bank: TreasuryTransferAccount
  let connectorId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bhard-lease')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank = await createAdjustmentBankAccount(app, fx, { namePrefix: 'BHARDLEASE' })
    const connector = await prisma.bankConnector.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: `BNK-HARD-${Date.now().toString(36)}`,
        name: 'Hardening lease connector',
        provider: 'GENERIC_REST',
        status: 'DISABLED',
        createdBy: fx.userId,
        updatedBy: fx.userId,
      },
    })
    connectorId = connector.id
  }, 180_000)

  afterAll(async () => {
    if (connectorId) {
      await prisma.bankConnector.deleteMany({ where: { id: connectorId } }).catch(() => undefined)
    }
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('allows only one concurrent acquire; expired lease can be stolen', async () => {
    const t1 = randomUUID()
    const t2 = randomUUID()
    const [a, b] = await Promise.all([
      connectorRepo.tryAcquireSyncLock(connectorId, t1),
      connectorRepo.tryAcquireSyncLock(connectorId, t2),
    ])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    const owner = a ? t1 : t2
    const loser = a ? t2 : t1

    expect(await connectorRepo.heartbeatSyncLock(connectorId, loser)).toBe(false)
    expect(await connectorRepo.heartbeatSyncLock(connectorId, owner)).toBe(true)

    await prisma.bankConnector.update({
      where: { id: connectorId },
      data: { syncLockUntil: new Date(Date.now() - 60_000) },
    })
    expect(await connectorRepo.tryAcquireSyncLock(connectorId, loser)).toBe(true)
    await connectorRepo.releaseSyncLock(connectorId, loser)
    const cleared = await prisma.bankConnector.findUniqueOrThrow({ where: { id: connectorId } })
    expect(cleared.syncLockToken).toBeNull()
    expect(cleared.syncLockUntil).toBeNull()
  })
})

describe.skipIf(!dbAvailable)('CAMT provisional supersession (live DB)', () => {
  let fx: ApAllocFixture
  let bank: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bhard-super')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank = await createAdjustmentBankAccount(app, fx, { namePrefix: 'BHARDSUPER' })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('053 supersedes unmatched provisional 054 line; matched provisional blocks', async () => {
    const { tenantId, legalEntityId } = fx
    const treasuryAccountId = bank.id
    const parsed054 = parseCamt054Buffer(camt054Buf)
    const credit = parsed054.lines[0]!
    const lineHash = buildStatementLineHash({
      treasuryAccountId,
      transactionDate: credit.transactionDate,
      direction: credit.direction,
      amount: credit.amount,
      referenceNumber: credit.referenceNumber,
      description: credit.description,
      externalTransactionId: credit.externalTransactionId,
    })

    const stmt054 = await prisma.bankStatement.create({
      data: {
        tenantId,
        legalEntityId,
        treasuryAccountId,
        statementReference: 'NTF-TEST-054',
        statementDate: new Date('2026-07-02'),
        periodStartDate: new Date('2026-07-02'),
        periodEndDate: new Date('2026-07-02'),
        currencyCode: 'INR',
        documentType: 'DEBIT_CREDIT_NOTIFICATION',
        hasOpeningBalance: false,
        hasClosingBalance: false,
        openingBalance: 0,
        closingBalance: 0,
        totalCreditAmount: 40000,
        totalDebitAmount: 0,
        status: 'IMPORTED',
        importFormat: 'CAMT_054',
        sourceType: 'FILE_UPLOAD',
      },
    })

    const provisional = await prisma.bankStatementLine.create({
      data: {
        tenantId,
        legalEntityId,
        bankStatementId: stmt054.id,
        lineNumber: 1,
        transactionDate: credit.transactionDate,
        direction: credit.direction,
        amount: credit.amount,
        description: credit.description,
        referenceNumber: credit.referenceNumber,
        externalTransactionId: credit.externalTransactionId,
        lineHash,
        isProvisional: true,
        matchStatus: 'UNMATCHED',
      },
    })

    const createAndSupersede = await resolveLineSupersession({
      tenantId,
      legalEntityId,
      lineHash,
      incomingIsProvisional: false,
    })
    expect(createAndSupersede.action).toBe('CREATE_AND_SUPERSEDE')
    if (createAndSupersede.action !== 'CREATE_AND_SUPERSEDE') return

    const stmt053 = await prisma.bankStatement.create({
      data: {
        tenantId,
        legalEntityId,
        treasuryAccountId,
        statementReference: 'STMT-TEST-053',
        statementDate: new Date('2026-07-02'),
        periodStartDate: new Date('2026-07-01'),
        periodEndDate: new Date('2026-07-02'),
        currencyCode: 'INR',
        documentType: 'END_OF_DAY_STATEMENT',
        openingBalance: 100000,
        closingBalance: 140000,
        totalCreditAmount: 40000,
        totalDebitAmount: 0,
        status: 'IMPORTED',
        importFormat: 'CAMT_053',
        sourceType: 'FILE_UPLOAD',
      },
    })
    const canonical = await prisma.bankStatementLine.create({
      data: {
        tenantId,
        legalEntityId,
        bankStatementId: stmt053.id,
        lineNumber: 1,
        transactionDate: credit.transactionDate,
        direction: credit.direction,
        amount: credit.amount,
        description: credit.description,
        referenceNumber: credit.referenceNumber,
        externalTransactionId: credit.externalTransactionId,
        lineHash,
        isProvisional: false,
        matchStatus: 'UNMATCHED',
      },
    })
    await markProvisionalLineSuperseded({
      provisionalLineId: createAndSupersede.provisionalLineId,
      canonicalLineId: canonical.id,
    })
    const refreshed = await prisma.bankStatementLine.findUniqueOrThrow({ where: { id: provisional.id } })
    expect(refreshed.isExcluded).toBe(true)
    expect(refreshed.matchStatus).toBe('EXCLUDED')
    expect(refreshed.supersededByLineId).toBe(canonical.id)

    const hash2 = buildStatementLineHash({
      treasuryAccountId,
      transactionDate: new Date('2026-07-03'),
      direction: 'DEBIT',
      amount: '5000.00',
      referenceNumber: 'BLOCK-REF',
      description: 'Matched provisional',
      externalTransactionId: 'TX-BLOCK',
    })
    const stmtP = await prisma.bankStatement.create({
      data: {
        tenantId,
        legalEntityId,
        treasuryAccountId,
        statementReference: 'NTF-MATCHED',
        statementDate: new Date('2026-07-03'),
        periodStartDate: new Date('2026-07-03'),
        periodEndDate: new Date('2026-07-03'),
        currencyCode: 'INR',
        documentType: 'DEBIT_CREDIT_NOTIFICATION',
        hasOpeningBalance: false,
        hasClosingBalance: false,
        openingBalance: 0,
        closingBalance: 0,
        totalCreditAmount: 0,
        totalDebitAmount: 5000,
        status: 'IMPORTED',
        importFormat: 'CAMT_054',
        sourceType: 'FILE_UPLOAD',
      },
    })
    await prisma.bankStatementLine.create({
      data: {
        tenantId,
        legalEntityId,
        bankStatementId: stmtP.id,
        lineNumber: 1,
        transactionDate: new Date('2026-07-03'),
        direction: 'DEBIT',
        amount: '5000.00',
        description: 'Matched provisional',
        referenceNumber: 'BLOCK-REF',
        externalTransactionId: 'TX-BLOCK',
        lineHash: hash2,
        isProvisional: true,
        matchStatus: 'MATCHED',
        matchedAmount: 5000,
      },
    })
    const blocked = await resolveLineSupersession({
      tenantId,
      legalEntityId,
      lineHash: hash2,
      incomingIsProvisional: false,
    })
    expect(blocked.action).toBe('BLOCK_ACTIVE_MATCH')
  })
})
