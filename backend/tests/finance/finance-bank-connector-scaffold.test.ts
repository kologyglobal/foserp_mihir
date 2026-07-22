/**
 * Finance Phase 5D1 — Bank connector scaffold.
 * Live MySQL when available; skips gracefully otherwise.
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
  FINANCE_PERMS,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createAdjustmentBankAccount } from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5D1 — Bank connector scaffold', () => {
  let fx: ApAllocFixture
  let bank: TreasuryTransferAccount
  let otherFx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'bconn')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank = await createAdjustmentBankAccount(app, fx, { namePrefix: 'BCONNBANK' })

    const otherCtx = await createFinanceAdminTenant(app, 'bconn2')
    otherFx = await bootstrapApAllocFixture(app, otherCtx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (otherFx?.tenantId) await cleanupTenant(otherFx.tenantId)
  })

  const base = () => `/api/v1/t/${fx.slug}/accounting/treasury/bank-connectors`

  function auth() {
    return { Authorization: `Bearer ${fx.token}` }
  }

  it('lists provider catalog', async () => {
    const res = await request(app).get(`${base()}/providers`).set(auth())
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some((p: { provider: string }) => p.provider === 'GENERIC_REST')).toBe(true)
    expect(res.body.data.some((p: { provider: string; implemented: boolean }) => p.provider === 'OPEN_BANKING' && p.implemented === false)).toBe(true)
    expect(res.body.data.some((p: { provider: string; implemented: boolean }) => p.provider === 'MT940_SFTP' && p.implemented === true)).toBe(true)
  })

  it('creates, lists, and gets a connector (defaults DISABLED)', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'HDFC-REST-01',
        name: 'HDFC REST scaffold',
        provider: 'GENERIC_REST',
        configJson: { expectedFormat: 'MT940', notes: 'scaffold only' },
      })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    expect(create.body.data.status).toBe('DISABLED')
    expect(create.body.data.isLiveConnected).toBe(false)
    expect(create.body.data.connectionLabel).toBe('Disabled')

    const id = create.body.data.id as string

    const list = await request(app)
      .get(base())
      .query({ legalEntityId: fx.legalEntityId })
      .set(auth())
    expect(list.status).toBe(200)
    expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(true)

    const get = await request(app).get(`${base()}/${id}`).set(auth())
    expect(get.status).toBe(200)
    expect(get.body.data.code).toBe('HDFC-REST-01')
  })

  it('enables and disables without marking live connected', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'ICICI-SFTP-01',
        name: 'ICICI MT940 SFTP scaffold',
        provider: 'MT940_SFTP',
        configJson: { expectedFormat: 'MT940' },
      })
    expect(create.status).toBe(201)
    const id = create.body.data.id as string
    let updatedAt = create.body.data.updatedAt as string

    const enable = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: updatedAt })
    expect(enable.status, JSON.stringify(enable.body)).toBe(200)
    expect(enable.body.data.status).toBe('ENABLED')
    expect(enable.body.data.isLiveConnected).toBe(false)
    expect(enable.body.data.connectionLabel).toBe('Not connected')
    updatedAt = enable.body.data.updatedAt

    const disable = await request(app)
      .post(`${base()}/${id}/disable`)
      .set(auth())
      .send({ expectedUpdatedAt: updatedAt })
    expect(disable.status).toBe(200)
    expect(disable.body.data.status).toBe('DISABLED')
  })

  it('test-connection returns NOT_IMPLEMENTED (or PROVIDER_DISABLED when disabled)', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'AXIS-OB-01',
        name: 'Axis Open Banking scaffold',
        provider: 'OPEN_BANKING',
      })
    const id = create.body.data.id as string
    let updatedAt = create.body.data.updatedAt as string

    const disabledTest = await request(app).post(`${base()}/${id}/test-connection`).set(auth())
    expect(disabledTest.status).toBe(422)
    expect(disabledTest.body.code).toBe('BANK_CONNECTOR_PROVIDER_DISABLED')

    // test-connection updates lastTest* and bumps updatedAt — reload before enable
    const refreshed = await request(app).get(`${base()}/${id}`).set(auth())
    expect(refreshed.status).toBe(200)
    updatedAt = refreshed.body.data.updatedAt as string

    const enabled = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: updatedAt })
    expect(enabled.status, JSON.stringify(enabled.body)).toBe(200)
    updatedAt = enabled.body.data.updatedAt

    const test = await request(app).post(`${base()}/${id}/test-connection`).set(auth())
    expect(test.status).toBe(422)
    expect(test.body.code).toBe('BANK_CONNECTOR_NOT_IMPLEMENTED')
  })

  it('sync returns NOT_IMPLEMENTED and creates zero BankStatement rows', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'SBI-CAMT-01',
        name: 'SBI CAMT SFTP scaffold',
        provider: 'CAMT_SFTP',
        configJson: { expectedFormat: 'CAMT053' },
      })
    const id = create.body.data.id as string
    const enabled = await request(app)
      .post(`${base()}/${id}/enable`)
      .set(auth())
      .send({ expectedUpdatedAt: create.body.data.updatedAt })
    expect(enabled.status).toBe(200)

    const beforeCount = await prisma.bankStatement.count({
      where: { tenantId: fx.tenantId, treasuryAccountId: bank.id },
    })

    const sync = await request(app).post(`${base()}/${id}/sync`).set(auth())
    expect(sync.status).toBe(422)
    expect(sync.body.code).toBe('BANK_CONNECTOR_NOT_IMPLEMENTED')

    const afterCount = await prisma.bankStatement.count({
      where: { tenantId: fx.tenantId, treasuryAccountId: bank.id },
    })
    expect(afterCount).toBe(beforeCount)
  })

  it('returns 403 without bank_connector.view permission', async () => {
    const limited = FINANCE_PERMS.filter((p) => !p.startsWith('finance.bank_connector.'))
    const { token } = await createUserWithPerms(app, fx.tenantId, fx.slug, limited, 'bconn-noview')
    const res = await request(app)
      .get(base())
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation', async () => {
    const create = await request(app)
      .post(base())
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank.id,
        code: 'ISO-CONN-01',
        name: 'Isolation connector',
        provider: 'GENERIC_REST',
      })
    const id = create.body.data.id as string

    const other = await request(app)
      .get(`/api/v1/t/${otherFx.slug}/accounting/treasury/bank-connectors/${id}`)
      .set('Authorization', `Bearer ${otherFx.token}`)
    expect(other.status).toBe(404)
  })
})
