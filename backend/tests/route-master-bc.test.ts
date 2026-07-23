/**
 * Route Master BC redesign — auto code, validate WC, certify, revise, close.
 * Requires MySQL. Skips when DB unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Route Master BC redesign', () => {
  let fx: ManufacturingFixture
  let workCentreId = ''
  let routingId = ''
  let versionId = ''

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'rt-bc')
    fx = await bootstrapManufacturingFixture(ctx)

    const wc = await prisma.manufacturingWorkCentre.create({
      data: {
        tenantId: fx.tenantId,
        code: `WC-BC-${Date.now()}`.slice(0, 20),
        name: 'BC Assembly Bay',
        capacityPerShift: 8,
        createdBy: fx.userId,
        updatedBy: fx.userId,
      },
    })
    workCentreId = wc.id

    await prisma.codeSeries.upsert({
      where: { tenantId_entityType: { tenantId: fx.tenantId, entityType: 'MANUFACTURING_ROUTING' } },
      create: {
        tenantId: fx.tenantId,
        entityType: 'MANUFACTURING_ROUTING',
        prefix: 'RT',
        currentValue: 0,
        padLength: 6,
      },
      update: {},
    })
  }, 180_000)

  afterAll(async () => {
    if (fx) await cleanupTenant(fx.tenantId)
  })

  it('auto-generates RT code and creates SERIAL draft with version', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routings`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        name: 'BC Template Assembly Route',
        productionFlowType: 'SERIAL',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.code).toMatch(/^RT-\d{6}$/)
    expect(res.body.data.productionFlowType).toBe('SERIAL')
    routingId = res.body.data.id

    const ver = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routings/${routingId}/versions`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ revisionCode: 'A', effectiveFrom: new Date().toISOString().slice(0, 10) })
    expect(ver.status).toBe(201)
    expect(ver.body.data.status).toBe('DRAFT')
    expect(ver.body.data.lifecycleLabel).toBe('UNDER_DEVELOPMENT')
    versionId = ver.body.data.id
  })

  it('rejects certify when operation has no work centre', async () => {
    const op = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${versionId}/operations`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        code: 'OP-10',
        name: 'Assemble',
        sequence: 10,
        workCentreId,
      })
    expect(op.status).toBe(201)

    // Clear WC via direct DB to simulate invalid state for validate
    await prisma.manufacturingRoutingOperation.update({
      where: { id: op.body.data.id },
      data: { workCentreId: null },
    })

    const val = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${versionId}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(val.status).toBe(200)
    expect(val.body.data.valid).toBe(false)
    expect(val.body.data.errors.join(' ')).toMatch(/work centre/i)

    await prisma.manufacturingRoutingOperation.update({
      where: { id: op.body.data.id },
      data: { workCentreId },
    })
  })

  it('certifies draft and maps lifecycle to CERTIFIED', async () => {
    const cert = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${versionId}/certify`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(cert.status).toBe(200)
    expect(cert.body.data.status).toBe('ACTIVE')
    expect(cert.body.data.lifecycleLabel).toBe('CERTIFIED')
  })

  it('creates new version with revision reason', async () => {
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${versionId}/revise`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ revisionNotes: 'QC checkpoint added' })
    expect(rev.status).toBe(201)
    expect(rev.body.data.status).toBe('DRAFT')
    expect(rev.body.data.lifecycleLabel).toBe('UNDER_DEVELOPMENT')
    expect(rev.body.data.versionNumber).toBeGreaterThan(1)
  })
})
