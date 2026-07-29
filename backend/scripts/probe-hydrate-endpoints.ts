/**
 * Probe CRM/master hydrate endpoints — print which path returns non-2xx (no tokens).
 *   npx tsx scripts/probe-hydrate-endpoints.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT = 'vasant-trailers'
const app = createApp()

const paths = [
  '/crm/leads?limit=50',
  '/crm/companies?limit=50',
  '/crm/contacts?limit=50',
  '/crm/opportunities?limit=50',
  '/crm/activities?limit=50',
  '/crm/follow-ups?limit=50',
  '/crm/quotations?limit=50',
  '/crm/sales-orders?limit=50',
  '/crm/commercial/sync',
  '/crm/masters/sync',
  '/masters/items?limit=50',
  '/masters/warehouses?limit=50',
  '/masters/uoms?limit=50',
  '/masters/countries?limit=50',
  '/masters/item-categories?limit=50',
  '/masters/hsn-codes?limit=50',
  '/masters/gst-groups?limit=50',
  '/masters/gst-rates?limit=50',
  '/masters/vendors?limit=50',
  '/users?limit=50',
  '/roles?limit=50',
]

async function main() {
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT,
  })
  if (login.status !== 200) {
    console.log(JSON.stringify({ ok: false, step: 'login', status: login.status, body: login.body }))
    process.exitCode = 1
    return
  }
  const token = login.body.data.accessToken as string
  const base = `/api/v1/t/${TENANT}`
  const results: Array<{ path: string; status: number; message?: string }> = []
  for (const p of paths) {
    const res = await request(app)
      .get(`${base}${p}`)
      .set({ Authorization: `Bearer ${token}` })
    results.push({
      path: p,
      status: res.status,
      message: res.status >= 400 ? String(res.body?.message ?? res.body?.error ?? '') : undefined,
    })
  }
  const bad = results.filter((r) => r.status >= 400)
  console.log(JSON.stringify({ ok: bad.length === 0, bad, all: results }, null, 2))
}

main()
  .catch((e) => {
    console.error(String(e))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
