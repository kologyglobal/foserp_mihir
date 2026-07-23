/**
 * Routing ↔ BOM alignment — bom-context + generate-stages-from-bom.
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

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe.skipIf(!dbAvailable)('Routing BOM alignment', () => {
  let fx: ManufacturingFixture
  let routingId = ''
  let draftVersionId = ''
  let activeVersionId = ''
  let bomId = ''
  let bomVersionId = ''
  let saLineId = ''

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'rt-bom')
    fx = await bootstrapManufacturingFixture(ctx)

    const routingRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routings`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        code: `RT-${Date.now()}`.slice(0, 20),
        name: 'Trailer Route',
        productItemId: fx.itemId,
      })
    expect(routingRes.status).toBe(201)
    routingId = routingRes.body.data.id

    const versionRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routings/${routingId}/versions`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        revisionCode: 'A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
      })
    expect(versionRes.status).toBe(201)
    draftVersionId = versionRes.body.data.id

    const bomRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/boms`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        code: `BOM-${Date.now()}`.slice(0, 20),
        name: 'Trailer BOM',
        productItemId: fx.itemId,
      })
    expect(bomRes.status).toBe(201)
    bomId = bomRes.body.data.id

    const bomVerRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/boms/${bomId}/versions`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        revisionCode: 'A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        baseQuantity: 1,
        baseUomId: fx.uomId,
      })
    expect(bomVerRes.status).toBe(201)
    bomVersionId = bomVerRes.body.data.id

    const lineRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/bom-versions/${bomVersionId}/lines`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.componentItemId,
        uomId: fx.uomId,
        quantity: 1,
        lineType: 'SUBASSEMBLY',
        makeOrBuy: 'MAKE',
        sequence: 10,
      })
    expect(lineRes.status).toBe(201)
    saLineId = lineRes.body.data.id

    const buyLine = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/bom-versions/${bomVersionId}/lines`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.subComponentItemId,
        uomId: fx.uomId,
        quantity: 2,
        lineType: 'RAW_MATERIAL',
        makeOrBuy: 'BUY',
        sequence: 20,
      })
    expect(buyLine.status).toBe(201)

    const activateBom = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/bom-versions/${bomVersionId}/activate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(activateBom.status).toBe(200)

    await prisma.manufacturingProfile.create({
      data: {
        tenantId: fx.tenantId,
        code: `PRF-${Date.now()}`.slice(0, 20),
        name: 'Test Profile',
        productItemId: fx.itemId,
        productionType: 'ASSEMBLY',
        defaultBomVersionId: bomVersionId,
        createdBy: fx.userId,
        updatedBy: fx.userId,
      },
    })
  }, 180_000)

  afterAll(async () => {
    if (!fx) return
    await cleanupTenant(fx.tenantId)
  })

  it('returns BOM context tree for the routing product', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${draftVersionId}/bom-context`)
      .set('Authorization', `Bearer ${fx.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.productItemId).toBe(fx.itemId)
    expect(res.body.data.bomVersion?.id).toBe(bomVersionId)
    expect(res.body.data.tree.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.unresolvedReason).toBeNull()
  })

  it('generates stages from MAKE sub-assemblies plus FINAL', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${draftVersionId}/generate-stages-from-bom`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ replaceExisting: false })

    expect(res.status).toBe(200)
    const stages = res.body.data.stageGroups as Array<{ code: string; sourceBomLineId: string | null }>
    expect(stages.length).toBeGreaterThanOrEqual(2)
    expect(stages.some((s) => s.sourceBomLineId === saLineId)).toBe(true)
    expect(stages.some((s) => s.code === 'FINAL' || s.code.startsWith('FINAL'))).toBe(true)
  })

  it('rejects generate without replace when stages exist', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${draftVersionId}/generate-stages-from-bom`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ replaceExisting: false })

    expect(res.status).toBe(400)
  })

  it('rejects generate on ACTIVE routing version', async () => {
    // Need at least one operation to activate — create minimal op then activate
    const versionFull = await request(app)
      .get(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${draftVersionId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    const stageId = versionFull.body.data.stageGroups[0]?.id
    expect(stageId).toBeTruthy()

    const opRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${draftVersionId}/operations`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        stageGroupId: stageId,
        code: 'OP10',
        name: 'Cut',
        sequence: 10,
      })
    expect(opRes.status).toBe(201)

    const act = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${draftVersionId}/activate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(act.status).toBe(200)
    activeVersionId = draftVersionId

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/routing-versions/${activeVersionId}/generate-stages-from-bom`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ replaceExisting: true })

    expect([400, 409, 422]).toContain(res.status)
  })
})
