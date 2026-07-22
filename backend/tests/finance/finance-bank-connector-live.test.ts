/**
 * Finance Phase 5D2–5D3 — Bank connector live/sandbox pull → BANK_API statements;
 * live SFTP (mocked client) + Open Banking consent scaffold.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { setSftpClientFactoryForTests } from '../../src/modules/accounting/treasury/bank-connectors/adapters/sftp-client.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createAdjustmentBankAccount } from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/bank-statements',
)

describe.skipIf(!dbAvailable)('Finance Phase 5D2 — Bank connector sandbox sync', () => {
  let fx: ApAllocFixture
  let bank: TreasuryTransferAccount

  beforeAll(async () => {
    process.env.BANK_CONNECTOR_SANDBOX_ENABLED = 'true'
    process.env.BANK_CONNECTOR_SANDBOX_ROOTS = FIXTURES
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bconn5d2')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank = await createAdjustmentBankAccount(app, fx, { namePrefix: 'BCONN5D2' })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  const base = () => `/api/v1/t/${fx.slug}/accounting/treasury/bank-connectors`

  function auth() {
    return { Authorization: `Bearer ${fx.token}` }
  }

  it('sandbox MT940: test OK then sync creates BANK_API statement (idempotent)', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'SANDBOX-MT940-01',
        name: 'Sandbox MT940 pull',
        provider: 'MT940_SFTP',
        configJson: {
          mode: 'SANDBOX',
          sandboxRoot: FIXTURES,
          expectedFormat: 'MT940',
          fileNamePattern: '*.mt940',
        },
      })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const id = create.body.data.id as string

    const enabled = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: create.body.data.updatedAt })
    expect(enabled.status, JSON.stringify(enabled.body)).toBe(200)

    const test = await request(app).post(`${base()}/${id}/test-connection`).set(auth())
    expect(test.status, JSON.stringify(test.body)).toBe(200)
    expect(test.body.data.ok).toBe(true)
    expect(test.body.data.code).toBe('OK')

    const afterTest = await request(app).get(`${base()}/${id}`).set(auth())
    expect(afterTest.body.data.isLiveConnected).toBe(true)
    expect(afterTest.body.data.connectionLabel).toBe('Connected')

    const beforeCount = await prisma.bankStatement.count({
      where: { tenantId: fx.tenantId, treasuryAccountId: bank.id, sourceType: 'BANK_API' },
    })

    const sync = await request(app).post(`${base()}/${id}/sync`).set(auth())
    expect(sync.status, JSON.stringify(sync.body)).toBe(200)
    expect(sync.body.data.ok).toBe(true)
    expect(sync.body.data.statementsCreated).toBeGreaterThanOrEqual(1)

    const afterCount = await prisma.bankStatement.count({
      where: { tenantId: fx.tenantId, treasuryAccountId: bank.id, sourceType: 'BANK_API' },
    })
    expect(afterCount).toBe(beforeCount + sync.body.data.statementsCreated)

    const stmt = await prisma.bankStatement.findFirst({
      where: { tenantId: fx.tenantId, treasuryAccountId: bank.id, sourceType: 'BANK_API' },
      orderBy: { createdAt: 'desc' },
    })
    expect(stmt).toBeTruthy()
    expect(stmt!.importFormat).toBe('MT940')
    expect(stmt!.lineCount).toBeGreaterThan(0)

    const sync2 = await request(app).post(`${base()}/${id}/sync`).set(auth())
    expect(sync2.status, JSON.stringify(sync2.body)).toBe(200)
    expect(sync2.body.data.statementsCreated).toBe(0)
    expect(sync2.body.data.statementsSkipped).toBeGreaterThanOrEqual(1)

    const afterReplay = await prisma.bankStatement.count({
      where: { tenantId: fx.tenantId, treasuryAccountId: bank.id, sourceType: 'BANK_API' },
    })
    expect(afterReplay).toBe(afterCount)
  })

  it('OPEN_BANKING remains not implemented for test/sync', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'PSD2-STILL-STUB',
        name: 'PSD2 deferred',
        provider: 'OPEN_BANKING',
      })
    const id = create.body.data.id as string
    const enabled = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: create.body.data.updatedAt })
    expect(enabled.status).toBe(200)

    const test = await request(app).post(`${base()}/${id}/test-connection`).set(auth())
    expect(test.status).toBe(422)
    expect(test.body.code).toBe('BANK_CONNECTOR_NOT_IMPLEMENTED')
  })
})

describe.skipIf(!dbAvailable)('Finance Phase 5D3 — live SFTP (mocked client) + consent', () => {
  let fx: ApAllocFixture
  let bank: TreasuryTransferAccount

  beforeAll(async () => {
    process.env.BANK_CONNECTOR_SFTP_ALLOWED_HOSTS = 'localhost,127.0.0.1'
    process.env.BANK_CONNECTOR_SANDBOX_ENABLED = 'false'
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    process.env.SFTP_TEST_USER = 'sftpuser'
    process.env.SFTP_TEST_PASS = 'sftppass'
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bconn5d3')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank = await createAdjustmentBankAccount(app, fx, { namePrefix: 'BCONN5D3' })
  }, 180_000)

  afterAll(async () => {
    setSftpClientFactoryForTests(null)
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  const base = () => `/api/v1/t/${fx.slug}/accounting/treasury/bank-connectors`

  function auth() {
    return { Authorization: `Bearer ${fx.token}` }
  }

  it('live MT940_SFTP: mocked SFTP sync creates BANK_API statement', async () => {
    const mt940 = await fs.readFile(path.join(FIXTURES, 'sample.mt940'))
    setSftpClientFactoryForTests(() => {
      let connected = false
      return {
        async connect() {
          connected = true
        },
        async list() {
          if (!connected) throw new Error('not connected')
          return [{ name: 'sample.mt940', type: '-', size: mt940.length }]
        },
        async get(remotePath: string) {
          if (!remotePath.includes('sample.mt940')) throw new Error(`unexpected path ${remotePath}`)
          return mt940
        },
        async end() {
          connected = false
        },
      }
    })

    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'LIVE-SFTP-01',
        name: 'Live SFTP mock',
        provider: 'MT940_SFTP',
        baseUrl: 'sftp://localhost:22',
        configJson: {
          mode: 'LIVE',
          expectedFormat: 'MT940',
          remotePath: '/inbox',
          fileNamePattern: '*.mt940',
          usernameEnvKey: 'SFTP_TEST_USER',
          passwordEnvKey: 'SFTP_TEST_PASS',
          hostKeyFingerprint: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        },
      })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const id = create.body.data.id as string

    const enabled = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: create.body.data.updatedAt })
    expect(enabled.status).toBe(200)

    const test = await request(app).post(`${base()}/${id}/test-connection`).set(auth())
    expect(test.status, JSON.stringify(test.body)).toBe(200)
    expect(test.body.data.ok).toBe(true)

    const sync = await request(app).post(`${base()}/${id}/sync`).set(auth())
    expect(sync.status, JSON.stringify(sync.body)).toBe(200)
    expect(sync.body.data.ok).toBe(true)
    expect(sync.body.data.statementsCreated).toBeGreaterThanOrEqual(1)
  })

  it('refuses SFTP host not on allow-list', async () => {
    setSftpClientFactoryForTests(() => ({
      async connect() {
        throw new Error('should not connect')
      },
      async list() {
        return []
      },
      async get() {
        return Buffer.alloc(0)
      },
      async end() {},
    }))

    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'LIVE-SFTP-BADHOST',
        name: 'Bad host',
        provider: 'MT940_SFTP',
        configJson: {
          mode: 'LIVE',
          host: 'evil.example.com',
          usernameEnvKey: 'SFTP_TEST_USER',
          passwordEnvKey: 'SFTP_TEST_PASS',
        },
      })
    const id = create.body.data.id as string
    await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: create.body.data.updatedAt })

    const test = await request(app).post(`${base()}/${id}/test-connection`).set(auth())
    expect(test.status).toBe(422)
    expect(test.body.code).toMatch(/NOT_CONFIGURED|PROBE_FAILED/)
  })

  it('OPEN_BANKING consent start → callback → revoke (tenant-scoped)', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'PSD2-CONSENT-01',
        name: 'PSD2 consent',
        provider: 'OPEN_BANKING',
        configJson: { authorizeUrl: 'https://openbanking.example/authorize' },
      })
    expect(create.status).toBe(201)
    const id = create.body.data.id as string

    const start = await request(app)
      .post(`${base()}/${id}/consents/start`)
      .set(auth())
      .send({ redirectUri: 'https://app.example/oauth/callback' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    expect(start.body.data.consent.status).toBe('PENDING')
    expect(start.body.data.authorizationUrl).toContain('state=')
    const state = new URL(start.body.data.authorizationUrl).searchParams.get('state')
    expect(state).toBeTruthy()

    const cb = await request(app)
      .post(`${base()}/${id}/consents/callback`)
      .set(auth())
      .send({ state, accessToken: 'scaffold-token-abc' })
    expect(cb.status, JSON.stringify(cb.body)).toBe(200)
    expect(cb.body.data.consent.status).toBe('AUTHORIZED')
    expect(cb.body.data.consent.hasEncryptedToken).toBe(true)
    expect(JSON.stringify(cb.body)).not.toContain('scaffold-token-abc')

    const got = await request(app).get(`${base()}/${id}`).set(auth())
    expect(got.body.data.consent.status).toBe('AUTHORIZED')
    expect(got.body.data.consent.hasEncryptedToken).toBe(true)

    const revoke = await request(app)
      .post(`${base()}/${id}/consents/revoke`)
      .set(auth())
      .send({})
    expect(revoke.status).toBe(200)
    expect(revoke.body.data.consent.status).toBe('REVOKED')
    expect(revoke.body.data.consent.hasEncryptedToken).toBe(false)

    const enabled = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: (await request(app).get(`${base()}/${id}`).set(auth())).body.data.updatedAt })
    expect(enabled.status).toBe(200)

    const sync = await request(app).post(`${base()}/${id}/sync`).set(auth())
    expect(sync.status).toBe(422)
    expect(sync.body.code).toBe('BANK_CONNECTOR_NOT_IMPLEMENTED')
  })
})
