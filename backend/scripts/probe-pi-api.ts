import request from 'supertest'
import { createApp } from '../src/app.js'

async function main() {
  const app = createApp()
  const login = await request(app).post('/api/v1/auth/login').send({
    tenantSlug: 'vasant-trailers',
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
  })
  console.log('login', login.status, login.body?.message)
  const token = login.body?.data?.accessToken as string | undefined
  if (!token) return

  const vendors = await request(app)
    .get('/api/v1/t/vasant-trailers/purchase/vendors?page=1&pageSize=5')
    .set('Authorization', `Bearer ${token}`)
  const vendorId = vendors.body?.data?.items?.[0]?.id as string | undefined
  console.log('vendor', vendorId)

  const res = await request(app)
    .post('/api/v1/t/vasant-trailers/purchase/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({
      vendorId,
      lines: [{ quantity: 1, rate: 100, taxRatePct: 18 }],
    })
  console.log('create', res.status, JSON.stringify(res.body, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
