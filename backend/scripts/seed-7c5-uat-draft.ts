/**
 * Seed one WORKBENCH draft outbound on vasant-trailers for 7C5 UI Scenario A.
 * Stops after draft create — operator drives Reserve → Pick → Pack → Challan → Post in UI.
 *
 *   npx tsx scripts/seed-7c5-uat-draft.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'

const TENANT_SLUG = process.argv[2] ?? 'vasant-trailers'
const FG_CODE = process.env.DISPATCH_FG_CODE ?? 'FG-ISO-TANK-26K'
const WH_CODE = process.env.DISPATCH_WH_CODE ?? 'FG_YARD'
const QTY = Number(process.env.DISPATCH_QTY ?? 1)

const app = createApp()

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant missing: ${TENANT_SLUG}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })

  const item = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!item) throw new Error(`Item missing: ${FG_CODE}`)
  await prisma.masterItem.update({ where: { id: item.id }, data: { salesAllowed: true } })

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: WH_CODE, deletedAt: null, status: 'ACTIVE' },
  })
  if (!warehouse) throw new Error(`Warehouse missing: ${WH_CODE}`)

  for (const entityType of [
    'STOCK_MOVEMENT',
    'STOCK_RESERVATION',
    'OUTBOUND_DISPATCH',
    'DISPATCH_REQUIREMENT',
    'DISPATCH_PICK_LIST',
    'DISPATCH_PACKING_SESSION',
    'DISPATCH_PACKAGE',
    'DELIVERY_CHALLAN',
    'SALES_ORDER',
  ] as const) {
    await ensureCodeSeries(tenant.id, entityType).catch(() => null)
  }

  const bal = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: item.id,
        warehouseId: warehouse.id,
      },
    },
  })
  const stock = Number(bal?.onHandQty ?? 0)
  if (stock < QTY) {
    await postStockMovement({
      tenantId: tenant.id,
      itemId: item.id,
      warehouseId: warehouse.id,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: QTY - stock + 5,
      rate: Number(item.standardRate ?? 0),
      referenceNo: `OPN-7C5-UAT-${Date.now()}`,
      remarks: '7C5 UAT Scenario A seed',
      idempotencyKey: `opn-7c5-uat-${Date.now()}`,
      createdBy: admin?.id,
      stockStatus: 'UNRESTRICTED',
    })
  }

  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT_SLUG,
  })
  if (login.status !== 200 || !login.body.data?.accessToken) {
    throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`)
  }
  const token = login.body.data.accessToken as string
  const auth = (req: request.Test) => req.set({ Authorization: `Bearer ${token}` })
  const dsp = `/api/v1/t/${TENANT_SLUG}/dispatch`
  const crm = `/api/v1/t/${TENANT_SLUG}/crm`
  const suffix = String(Date.now())

  const company = await auth(
    request(app)
      .post(`${crm}/companies`)
      .send({
        customerName: `7C5 UAT Customer ${suffix}`,
        customerType: 'corporate',
        isActive: true,
      }),
  )
  if (company.status !== 201) {
    throw new Error(`Company: ${company.status} ${JSON.stringify(company.body)}`)
  }

  const soRes = await auth(
    request(app)
      .post(`${crm}/sales-orders`)
      .send({
        customerId: company.body.data.id,
        source: 'direct',
        directSoReason: '7C5 UAT Scenario A',
        customerPoNumber: `PO-7C5-${suffix}`,
        paymentTerms: 'Net 30',
        deliveryTerms: 'Ex-works',
        deliveryTime: '4 weeks',
        lines: [
          {
            productOrItem: item.name,
            description: item.name,
            productId: item.id,
            itemId: item.id,
            qty: QTY,
            uom: 'Nos',
            unitPrice: Number(item.standardRate ?? 4200000),
            discountPct: 0,
            taxPct: 18,
          },
        ],
      }),
  )
  if (soRes.status !== 201) {
    throw new Error(`SO: ${soRes.status} ${JSON.stringify(soRes.body)}`)
  }
  const salesOrderId = soRes.body.data.id as string
  const conf = await auth(request(app).post(`${crm}/sales-orders/${salesOrderId}/confirm`))
  if (conf.status !== 200) {
    throw new Error(`Confirm: ${conf.status} ${JSON.stringify(conf.body)}`)
  }

  await auth(request(app).post(`${dsp}/requirements/synchronise`).send({ salesOrderId }))
  const list = await auth(
    request(app).get(`${dsp}/requirements`).query({ salesOrderId, limit: 20 }),
  )
  const requirementId = list.body.data[0].id as string
  const fingerprint = list.body.data[0].sourceFingerprint as string

  const draft = await auth(
    request(app)
      .post(`${dsp}/orders/from-requirements`)
      .send({
        requirementIds: [requirementId],
        lines: [{ requirementId, quantity: QTY, warehouseId: warehouse.id }],
        planBeforeStockAllowed: true,
        sourceFingerprintByRequirement: { [requirementId]: fingerprint },
        idempotencyKey: `7c5-uat-draft-${requirementId}`,
      }),
  )
  if (draft.status !== 201) {
    throw new Error(`Draft: ${draft.status} ${JSON.stringify(draft.body)}`)
  }

  const dispatchId = draft.body.data.id as string
  const dispatchNo =
    draft.body.data.dispatchNumber ?? draft.body.data.dispatchNo ?? dispatchId
  console.log(
    JSON.stringify(
      {
        ok: true,
        dispatchId,
        dispatchNo,
        status: draft.body.data.status,
        planningSource: draft.body.data.planningSource,
        url: `http://127.0.0.1:5173/dispatch/${dispatchId}`,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
