/**
 * Finance Phase 5B3 — Standing instructions: draft-only recurring generation, pause/resume/cancel
 * lifecycle, optimistic locking, and idempotent generate-due-drafts. Live MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createAdjustmentBankAccount, createGlExpenseAccount } from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Standing instructions', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-si')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'SIBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'SIEXP')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  function baseBody(overrides: Record<string, unknown> = {}) {
    return {
      legalEntityId: fx.legalEntityId,
      treasuryAccountId: bank1.id,
      name: 'Monthly bank charges SI',
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      frequency: 'MONTHLY',
      amountMode: 'FIXED',
      fixedAmount: '150',
      startDate: fx.documentDate,
      lineTemplate: { lineType: 'EXPENSE', accountId: expenseGl.id },
      ...overrides,
    }
  }

  async function create(body: Record<string, unknown> = {}) {
    return request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(baseBody(body))
  }

  async function generateDueDrafts(body: Record<string, unknown>) {
    return request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/generate-due-drafts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, ...body })
  }

  it('creates a standing instruction with ACTIVE status and nextDueDate = startDate', async () => {
    const res = await create({ name: 'SI create test' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.status).toBe('ACTIVE')
    expect(res.body.data.frequency).toBe('MONTHLY')
    expect(new Date(res.body.data.nextDueDate).toISOString().slice(0, 10)).toBe(fx.documentDate)
  })

  it('rejects FIXED amount mode without fixedAmount', async () => {
    const res = await create({ name: 'SI missing amount', fixedAmount: null })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
  })

  it('lists and fetches a standing instruction', async () => {
    const created = await create({ name: 'SI list test' })
    expect(created.status).toBe(201)

    const listRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions`)
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(listRes.status, JSON.stringify(listRes.body)).toBe(200)
    expect(listRes.body.data.some((row: { id: string }) => row.id === created.body.data.id)).toBe(true)

    const getRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(getRes.status, JSON.stringify(getRes.body)).toBe(200)
    expect(getRes.body.data.name).toBe('SI list test')
  })

  it('updates a standing instruction and rejects a stale expectedUpdatedAt', async () => {
    const created = await create({ name: 'SI update test' })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    const staleUpdatedAt = created.body.data.updatedAt

    const okRes = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...baseBody({ name: 'SI update test — renamed' }), expectedUpdatedAt: staleUpdatedAt })
    expect(okRes.status, JSON.stringify(okRes.body)).toBe(200)
    expect(okRes.body.data.name).toBe('SI update test — renamed')

    const staleRes = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...baseBody({ name: 'SI update test — second rename' }), expectedUpdatedAt: staleUpdatedAt })
    expect(staleRes.status, JSON.stringify(staleRes.body)).toBe(409)
  })

  it('pauses, resumes, and cancels a standing instruction with status guards', async () => {
    const created = await create({ name: 'SI lifecycle test' })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    let updatedAt = created.body.data.updatedAt

    const pauseRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/pause`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: updatedAt })
    expect(pauseRes.status, JSON.stringify(pauseRes.body)).toBe(200)
    expect(pauseRes.body.data.status).toBe('PAUSED')
    updatedAt = pauseRes.body.data.updatedAt

    const pauseAgainRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/pause`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: updatedAt })
    expect(pauseAgainRes.status, JSON.stringify(pauseAgainRes.body)).toBe(422)

    const resumeRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/resume`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: updatedAt })
    expect(resumeRes.status, JSON.stringify(resumeRes.body)).toBe(200)
    expect(resumeRes.body.data.status).toBe('ACTIVE')
    updatedAt = resumeRes.body.data.updatedAt

    const cancelRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: updatedAt, reason: 'No longer required' })
    expect(cancelRes.status, JSON.stringify(cancelRes.body)).toBe(200)
    expect(cancelRes.body.data.status).toBe('CANCELLED')

    const cancelAgainRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: cancelRes.body.data.updatedAt, reason: 'Retry cancel' })
    expect(cancelAgainRes.status, JSON.stringify(cancelAgainRes.body)).toBe(422)
  })

  it('generates a due draft treasury adjustment for a due FIXED-amount instruction (draft-only, never posted)', async () => {
    const created = await create({ name: 'SI generate test' })
    expect(created.status).toBe(201)
    const id = created.body.data.id

    const genRes = await generateDueDrafts({ standingInstructionId: id, asOfDate: fx.documentDate })
    expect(genRes.status, JSON.stringify(genRes.body)).toBe(200)
    expect(genRes.body.data).toHaveLength(1)
    const outcome = genRes.body.data[0]
    expect(outcome.status).toBe('DRAFT_CREATED')
    expect(outcome.treasuryAdjustmentId).toBeTruthy()

    const adjustment = await prisma.treasuryAdjustment.findFirst({ where: { id: outcome.treasuryAdjustmentId, tenantId: fx.tenantId } })
    expect(adjustment?.status).toBe('DRAFT')
    expect(adjustment?.sourceMode).toBe('STANDING_INSTRUCTION')
    expect(Number(adjustment?.bankAmount)).toBe(150)
  })

  it('is idempotent — re-running generate-due-drafts for an already-processed due date is a no-op', async () => {
    const created = await create({ name: 'SI idempotent test' })
    expect(created.status).toBe(201)
    const id = created.body.data.id

    const firstRun = await generateDueDrafts({ standingInstructionId: id, asOfDate: fx.documentDate })
    expect(firstRun.status, JSON.stringify(firstRun.body)).toBe(200)
    expect(firstRun.body.data).toHaveLength(1)
    const firstAdjustmentId = firstRun.body.data[0].treasuryAdjustmentId

    const secondRun = await generateDueDrafts({ standingInstructionId: id, asOfDate: fx.documentDate })
    expect(secondRun.status, JSON.stringify(secondRun.body)).toBe(200)
    expect(secondRun.body.data).toHaveLength(0)

    const executionCount = await prisma.standingInstructionExecution.count({ where: { standingInstructionId: id, tenantId: fx.tenantId } })
    expect(executionCount).toBe(1)

    const adjustmentCount = await prisma.treasuryAdjustment.count({ where: { standingInstructionExecutionId: { not: null }, tenantId: fx.tenantId, sourceMode: 'STANDING_INSTRUCTION' } })
    expect(adjustmentCount).toBeGreaterThanOrEqual(1)
    void firstAdjustmentId
  })

  it('skips generation for a VARIABLE amount instruction with no override and records the reason', async () => {
    const created = await create({ name: 'SI variable no override', amountMode: 'VARIABLE', fixedAmount: null })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.data.id

    const genRes = await generateDueDrafts({ standingInstructionId: id, asOfDate: fx.documentDate })
    expect(genRes.status, JSON.stringify(genRes.body)).toBe(200)
    expect(genRes.body.data).toHaveLength(1)
    expect(genRes.body.data[0].status).toBe('SKIPPED')
    expect(genRes.body.data[0].failureReason).toBe('VARIABLE_AMOUNT_REQUIRES_MANUAL_ENTRY')
    expect(genRes.body.data[0].treasuryAdjustmentId).toBeNull()
  })

  it('generates a draft for a VARIABLE amount instruction when an amountOverride is supplied', async () => {
    const created = await create({ name: 'SI variable with override', amountMode: 'VARIABLE', fixedAmount: null })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.data.id

    const genRes = await generateDueDrafts({ standingInstructionId: id, asOfDate: fx.documentDate, amountOverrides: { [id]: '275' } })
    expect(genRes.status, JSON.stringify(genRes.body)).toBe(200)
    expect(genRes.body.data).toHaveLength(1)
    expect(genRes.body.data[0].status).toBe('DRAFT_CREATED')

    const adjustment = await prisma.treasuryAdjustment.findFirst({ where: { id: genRes.body.data[0].treasuryAdjustmentId, tenantId: fx.tenantId } })
    expect(Number(adjustment?.bankAmount)).toBe(275)
  })

  it('generates multiple due drafts in one run when several MONTHLY due dates have accumulated, and advances nextDueDate', async () => {
    const past = new Date(fx.documentDate)
    past.setUTCMonth(past.getUTCMonth() - 2)
    const startDate = past.toISOString().slice(0, 10)

    const created = await create({ name: 'SI backlog test', startDate })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.data.id

    const genRes = await generateDueDrafts({ standingInstructionId: id, asOfDate: fx.documentDate })
    expect(genRes.status, JSON.stringify(genRes.body)).toBe(200)
    expect(genRes.body.data.length).toBeGreaterThanOrEqual(3)
    expect(genRes.body.data.every((o: { status: string }) => o.status === 'DRAFT_CREATED')).toBe(true)

    const row = await prisma.standingInstruction.findFirst({ where: { id, tenantId: fx.tenantId } })
    expect(row?.nextDueDate.getTime()).toBeGreaterThan(new Date(fx.documentDate).getTime())
  })

  it('rejects pause when the instruction is not ACTIVE', async () => {
    const created = await create({ name: 'SI pause guard test' })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    const cancelRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt, reason: 'cancel before pause' })
    expect(cancelRes.status).toBe(200)

    const pauseRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/${id}/pause`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: cancelRes.body.data.updatedAt })
    expect(pauseRes.status, JSON.stringify(pauseRes.body)).toBe(422)
  })

  it('returns 404 for a standing instruction that does not belong to the tenant', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/standing-instructions/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(404)
  })
})
