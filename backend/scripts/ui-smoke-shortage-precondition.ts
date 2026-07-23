/**
 * Precondition for UI smoke: zero BO-FASTENERS @ WIP_FABRICATION, create+release+reserve ISO WO.
 * Prints JSON to stdout for the Playwright UI script.
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = 'vasant-trailers'
const FG_CODE = 'FG-ISO-TANK-26K'
const SHORT_ITEM = 'BO-FASTENERS'
const ISSUE_WH = 'WIP_FABRICATION'

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`)
  return res.body.data.accessToken as string
}

async function main() {
  const app = createApp()
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { slug: TENANT_SLUG, deletedAt: null } })
  const fg = await prisma.masterItem.findFirstOrThrow({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  const shortItem = await prisma.masterItem.findFirstOrThrow({
    where: { tenantId: tenant.id, code: SHORT_ITEM, deletedAt: null },
  })
  const wip = await prisma.masterWarehouse.findFirstOrThrow({
    where: { tenantId: tenant.id, code: ISSUE_WH, deletedAt: null },
  })

  await prisma.inventoryStockReservation.updateMany({
    where: {
      tenantId: tenant.id,
      itemId: shortItem.id,
      warehouseId: wip.id,
      status: 'ACTIVE',
    },
    data: { status: 'CANCELLED' },
  })
  await prisma.inventoryStockBalance.upsert({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: shortItem.id,
        warehouseId: wip.id,
      },
    },
    create: {
      tenantId: tenant.id,
      itemId: shortItem.id,
      warehouseId: wip.id,
      onHandQty: 0,
      reservedQty: 0,
    },
    update: { onHandQty: 0, reservedQty: 0 },
  })

  const token = await login(app, 'admin@vasant-trailers.com', 'Admin@123')
  const mfg = `/api/v1/t/${TENANT_SLUG}/manufacturing`
  const create = await request(app)
    .post(`${mfg}/work-orders`)
    .set({ Authorization: `Bearer ${token}` })
    .send({
      productItemId: fg.id,
      plannedQuantity: 1,
      requiredCompletionDate: new Date(Date.now() + 21 * 86400000).toISOString(),
      plannedStartDate: new Date().toISOString(),
      priority: 'HIGH',
      notes: 'UI smoke shortage precondition',
      idempotencyKey: `ui-smoke-pre-${Date.now()}`,
    })
  if (create.status !== 201) throw new Error(`WO create: ${create.status} ${JSON.stringify(create.body)}`)
  const woId = create.body.data.id as string
  const woNo = (create.body.data.orderNumber ?? create.body.data.workOrderNo) as string

  const released = await request(app)
    .post(`${mfg}/work-orders/${woId}/release`)
    .set({ Authorization: `Bearer ${token}` })
    .send({})
  if (released.status !== 200) throw new Error(`release: ${released.status}`)

  const reserved = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/reserve`)
    .set({ Authorization: `Bearer ${token}` })
    .send({})
  if (reserved.status !== 200) throw new Error(`reserve: ${reserved.status}`)

  const mats = await request(app)
    .get(`${mfg}/work-orders/${woId}/materials`)
    .set({ Authorization: `Bearer ${token}` })
  const list = (Array.isArray(mats.body.data) ? mats.body.data : mats.body.data?.materials ?? []) as Array<{
    id: string
    itemCode?: string
    item?: { code?: string }
    shortageQty?: string | number
    status?: string
  }>
  const shortMat = list.find((m) => (m.itemCode ?? m.item?.code) === SHORT_ITEM)
  if (!shortMat) throw new Error('short material missing')

  const out = {
    woId,
    woNo,
    shortMatId: shortMat.id,
    shortItemId: shortItem.id,
    warehouseId: wip.id,
    shortageQty: shortMat.shortageQty,
    status: shortMat.status,
  }
  console.log(JSON.stringify(out))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
