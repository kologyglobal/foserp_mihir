/**
 * Verify seeded outbound exists (prints status only — no tokens).
 *   npx tsx scripts/verify-7c5-uat-draft.ts [dispatchId]
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = 'vasant-trailers'
const dispatchId = process.argv[2] ?? '8329de9a-d2bb-4ef0-a359-609439965c28'
const app = createApp()

async function main() {
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT_SLUG,
  })
  if (login.status !== 200) {
    console.log(JSON.stringify({ ok: false, step: 'login', status: login.status }))
    process.exitCode = 1
    return
  }
  const token = login.body.data.accessToken as string
  const res = await request(app)
    .get(`/api/v1/t/${TENANT_SLUG}/dispatch/outbound/${dispatchId}`)
    .set({ Authorization: `Bearer ${token}` })
  console.log(
    JSON.stringify(
      {
        ok: res.status === 200,
        httpStatus: res.status,
        dispatchNo: res.body?.data?.dispatchNumber ?? res.body?.data?.dispatchNo,
        status: res.body?.data?.status,
        planningSource: res.body?.data?.planningSource,
        message: res.body?.message,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(String(e))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
