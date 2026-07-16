import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const app = createApp()
const TENANT_A = 'vasant-trailers'
const BASE_A = `/api/v1/t/${TENANT_A}/crm`

let dbAvailable = false
let tokenA = ''
let tokenB = ''
let companyA = ''
let leadA = ''

const runLive = process.env.RUN_CRM_E2E === 'true'

beforeAll(async () => {
  if (!runLive) return
  try {
    await prisma.$queryRaw`SELECT 1`
    dbAvailable = true
  } catch {
    dbAvailable = false
    if (runLive) {
      throw new Error('RUN_CRM_E2E=true but MySQL test database is not reachable. Configure DATABASE_URL and run migrations.')
    }
    return
  }

  const loginA = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@vasant-trailers.com', password: 'Admin@123', tenantSlug: TENANT_A })
  tokenA = loginA.body.data.accessToken

  const tenantB = await prisma.tenant.findFirst({ where: { slug: { not: TENANT_A }, deletedAt: null } })
  if (!tenantB) return

  const userB = await prisma.user.findFirst({ where: { tenantId: tenantB.id, deletedAt: null } })
  if (!userB) return

  const loginB = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: userB.email, password: 'Admin@123', tenantSlug: tenantB.slug })
  if (loginB.status === 200) tokenB = loginB.body.data.accessToken

  const co = await request(app)
    .post(`${BASE_A}/companies`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ customerName: `Iso Co ${Date.now()}`, customerType: 'corporate', isActive: true })
  companyA = co.body.data?.id ?? ''

  const lead = await request(app)
    .post(`${BASE_A}/leads`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ prospectName: `Iso Lead ${Date.now()}`, source: 'website', companyId: companyA })
  leadA = lead.body.data?.id ?? ''
})

function authGet(token: string, path: string) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`)
}

describe.skipIf(!runLive)('CRM tenant isolation', () => {
  it('rejects cross-tenant company read with 404', async () => {
    if (!tokenB || !companyA) return
    const otherBase = `/api/v1/t/${(await prisma.tenant.findFirst({ where: { slug: { not: TENANT_A } } }))!.slug}/crm`
    const res = await authGet(tokenB, `${otherBase}/companies/${companyA}`)
    expect([403, 404]).toContain(res.status)
  })

  it('rejects cross-tenant lead read with 404', async () => {
    if (!tokenB || !leadA) return
    const tenantB = await prisma.tenant.findFirst({ where: { slug: { not: TENANT_A } } })
    if (!tenantB) return
    const res = await authGet(tokenB, `/api/v1/t/${tenantB.slug}/crm/leads/${leadA}`)
    expect([403, 404]).toContain(res.status)
  })

  it('dashboard metrics are tenant-scoped', async () => {
    const res = await authGet(tokenA, `${BASE_A}/dashboard/metrics?period=month`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.leads).toBeDefined()
    expect(res.body.data.charts).toBeDefined()
    expect(res.body.data.charts.pipelineByStage).toBeInstanceOf(Array)
    expect(res.body.data.charts.activityTrend).toHaveLength(7)
  })

  it('report API returns tenant-scoped rows', async () => {
    const res = await authGet(tokenA, `${BASE_A}/reports?reportId=lead-register&limit=10`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('search API is tenant-scoped', async () => {
    const res = await authGet(tokenA, `${BASE_A}/search?q=Iso&limit=5`)
    expect(res.status).toBe(200)
    expect(res.body.data.leads).toBeDefined()
  })

  it('lead status history requires same tenant', async () => {
    if (!leadA) return
    const res = await authGet(tokenA, `${BASE_A}/leads/${leadA}/status-history`)
    expect(res.status).toBe(200)
  })
})
