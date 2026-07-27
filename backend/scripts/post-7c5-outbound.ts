/**
 * Post a posting-ready outbound (7C5). Prints status only.
 *   npx tsx scripts/post-7c5-outbound.ts [dispatchId]
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = 'vasant-trailers'
const dispatchId = process.argv[2] ?? '8329de9a-d2bb-4ef0-a359-609439965c28'
const app = createApp()

async function main() {
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT_SLUG,
  })
  if (login.status !== 200) throw new Error(`login ${login.status}`)
  const token = login.body.data.accessToken as string
  const dsp = `/api/v1/t/${TENANT_SLUG}/dispatch`
  const before = await request(app)
    .get(`${dsp}/outbound/${dispatchId}`)
    .set({ Authorization: `Bearer ${token}` })
  const post = await request(app)
    .post(`${dsp}/outbound/${dispatchId}/post`)
    .set({ Authorization: `Bearer ${token}` })
    .send({})
  console.log(
    JSON.stringify(
      {
        ok: post.status === 200,
        httpStatus: post.status,
        beforeStatus: before.body?.data?.status,
        afterStatus: post.body?.data?.status,
        message: post.body?.message,
        dispatchNo: post.body?.data?.dispatchNumber ?? before.body?.data?.dispatchNumber,
      },
      null,
      2,
    ),
  )
  if (post.status !== 200) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(String(e))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
