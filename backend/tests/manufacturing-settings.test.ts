import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import {
  cleanupTenant,
  createManufacturingAdminTenant,
  ensurePermissions,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Manufacturing Settings', () => {
  let first: Awaited<ReturnType<typeof createManufacturingAdminTenant>>
  let second: Awaited<ReturnType<typeof createManufacturingAdminTenant>>
  const url = (slug: string) => `/api/v1/t/${slug}/manufacturing/settings`

  beforeAll(async () => {
    await ensurePermissions()
    first = await createManufacturingAdminTenant(app, 'mfg-settings-a')
    second = await createManufacturingAdminTenant(app, 'mfg-settings-b')
  })

  afterAll(async () => {
    for (const tenant of [first, second]) {
      if (!tenant) continue
      await prisma.manufacturingSettings.deleteMany({ where: { tenantId: tenant.tenantId } })
      await cleanupTenant(tenant.tenantId)
    }
    await prisma.$disconnect()
  })

  it('returns lazy defaults without creating a row', async () => {
    const response = await request(app)
      .get(url(first.slug))
      .set('Authorization', `Bearer ${first.token}`)
      .expect(200)

    expect(response.body.data.version).toBe(0)
    expect(response.body.data.payloadJson.general.allowOverproduction).toBe(true)
    expect(await prisma.manufacturingSettings.count({ where: { tenantId: first.tenantId } })).toBe(0)
  })

  it('persists a complete settings payload', async () => {
    const defaults = await request(app)
      .get(url(first.slug))
      .set('Authorization', `Bearer ${first.token}`)
      .expect(200)
    const settings = defaults.body.data.payloadJson
    settings.general.allowOverproduction = false
    settings.materialConsumption.requireReservation = true

    const response = await request(app)
      .put(url(first.slug))
      .set('Authorization', `Bearer ${first.token}`)
      .send({ version: 0, settings })
      .expect(200)

    expect(response.body.data.version).toBe(1)
    expect(response.body.data.allowOverproduction).toBe(false)
    expect(response.body.data.requireReservation).toBe(true)
  })

  it('rejects stale versions', async () => {
    const response = await request(app)
      .put(url(first.slug))
      .set('Authorization', `Bearer ${first.token}`)
      .send({ version: 0, settings: { general: { allowOverproduction: true } } })
      .expect(409)

    expect(response.body.code).toBe('MANUFACTURING_SETTINGS_VERSION_CONFLICT')
  })

  it('isolates settings by tenant', async () => {
    const response = await request(app)
      .get(url(second.slug))
      .set('Authorization', `Bearer ${second.token}`)
      .expect(200)

    expect(response.body.data.version).toBe(0)
    expect(response.body.data.payloadJson.general.allowOverproduction).toBe(true)
    expect(await prisma.manufacturingSettings.count({ where: { tenantId: second.tenantId } })).toBe(0)
  })
})
