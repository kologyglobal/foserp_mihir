/**
 * API-mode smoke UAT: Lead → Opp → Quote → SO → confirm → MFG demand
 * Asserts itemId (not productId) on commercial documents.
 *
 * Usage: npx tsx scripts/test-crm-item-funnel-uat.ts [tenantSlug]
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions.js'

const TENANT_SLUG = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'
const app = createApp()
const CRM = `/api/v1/t/${TENANT_SLUG}/crm`
const MFG = `/api/v1/t/${TENANT_SLUG}/manufacturing`

let passed = 0
let failed = 0

function ok(label: string, detail?: string) {
  passed++
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
}

function fail(label: string, detail?: string): never {
  failed++
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  process.exit(1)
}

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) ok(label, detail)
  else fail(label, detail)
}

async function ensurePermissions(tenantId: string) {
  const permissionMap = new Map<string, string>()
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
    permissionMap.set(name, perm.id)
  }
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findFirst({ where: { tenantId, name: roleName } })
    if (!role) continue
    for (const permName of ROLE_PERMISSIONS[roleName] ?? []) {
      const permissionId = permissionMap.get(permName)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      })
    }
  }
}

async function login(): Promise<{ token: string; userId: string }> {
  for (const [email, password] of [
    ['admin@vasant-trailers.com', 'Admin@123'],
    ['sales@vasant-trailers.com', 'Sales@123'],
  ] as const) {
    const res = await request(app).post('/api/v1/auth/login').send({
      email,
      password,
      tenantSlug: TENANT_SLUG,
    })
    if (res.status === 200 && res.body.data?.accessToken) {
      return { token: res.body.data.accessToken, userId: res.body.data.user.id }
    }
  }
  fail('login')
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function main() {
  console.log(`\n=== CRM Item Funnel UAT (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail('tenant exists', TENANT_SLUG)
  await ensurePermissions(tenant.id)

  const { token, userId } = await login()
  ok('login', userId)

  const item = await prisma.masterItem.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      salesAllowed: true,
      isBlocked: false,
      status: 'ACTIVE',
    },
    orderBy: { code: 'asc' },
  })
  if (!item) fail('sellable item exists')
  ok('sellable item', `${item.code} ${item.id}`)

  const stamp = Date.now()
  const companyRes = await request(app)
    .post(`${CRM}/companies`)
    .set(auth(token))
    .send({
      customerName: `Item Funnel Co ${stamp}`,
      customerType: 'corporate',
      isActive: true,
      addressLine1: 'Plot 1, MIDC',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      contactPerson: 'Funnel Contact',
      contactPhone: '9876501234',
      contactEmail: `funnel-${stamp}@example.com`,
      billingAddress: 'Plot 1, MIDC, Pune, Maharashtra 411001',
      shippingAddress: 'Plot 1, MIDC, Pune, Maharashtra 411001',
    })
  assert(companyRes.status === 201, 'create company', String(companyRes.status))
  const companyId = companyRes.body.data.id as string

  const contactRes = await request(app)
    .post(`${CRM}/contacts`)
    .set(auth(token))
    .send({
      customerId: companyId,
      name: 'Funnel Contact',
      email: `funnel-c-${stamp}@example.com`,
      phone: '9876501234',
      isPrimary: true,
    })
  assert(contactRes.status === 201, 'create contact', String(contactRes.status))
  const contactId = contactRes.body.data.id as string

  const leadRes = await request(app)
    .post(`${CRM}/leads`)
    .set(auth(token))
    .send({
      prospectName: `Item Funnel Lead ${stamp}`,
      customerId: companyId,
      contactId,
      contactPerson: 'Funnel Contact',
      mobile: '9876501234',
      remarks: 'Item-native funnel UAT',
      priority: 'high',
      source: 'referral',
      expectedValue: 500000,
      productRequirement: item.name,
      leadOwnerId: userId,
      stage: 'qualified',
    })
  assert(leadRes.status === 201, 'create lead', String(leadRes.status))
  const leadId = leadRes.body.data.id as string

  const convertLead = await request(app)
    .post(`${CRM}/leads/${leadId}/convert`)
    .set(auth(token))
    .send({
      opportunityName: `Item Funnel Opp ${stamp}`,
      value: 500000,
      contactId,
    })
  assert(convertLead.status === 200, 'convert lead→opp', String(convertLead.status))
  const opportunityId = convertLead.body.data.opportunity.id as string

  const pipelines = await request(app).get(`${CRM}/pipelines`).set(auth(token))
  const pipelineId =
    (pipelines.body.data?.[0]?.id as string | undefined)
    ?? (await prisma.crmPipeline.findFirst({ where: { tenantId: tenant.id, deletedAt: null } }))?.id
  if (!pipelineId) fail('pipeline exists')

  const unitPrice = Number(item.defaultSalesRate ?? 0) > 0 ? Number(item.defaultSalesRate) : 500000
  const patchOpp = await request(app)
    .patch(`${CRM}/opportunities/${opportunityId}`)
    .set(auth(token))
    .send({
      pipelineId,
      lines: [
        {
          itemId: item.id,
          itemCode: item.code,
          productOrItem: item.name,
          description: item.name,
          qty: 1,
          uom: 'NOS',
          unitPrice,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
  assert(patchOpp.status === 200, 'opp lines with itemId', `${patchOpp.status} ${JSON.stringify(patchOpp.body)}`)
  const oppLines = patchOpp.body.data.lines as Array<{ itemId?: string | null }>
  assert(Boolean(oppLines?.[0]?.itemId), 'opp line itemId set', JSON.stringify(oppLines?.[0]))
  assert(!('productId' in (oppLines?.[0] ?? {})), 'opp line has no productId field')

  const quoRes = await request(app)
    .post(`${CRM}/quotations`)
    .set(auth(token))
    .send({
      customerId: companyId,
      opportunityId,
      itemId: item.id,
      qty: 1,
      unitPrice,
      paymentTerms: '30% advance',
      deliveryTerms: 'Ex-works',
      deliveryTime: '6 weeks',
      validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      priceLines: [
        {
          productOrItem: item.name,
          description: item.name,
          itemId: item.id,
          qty: 1,
          uom: 'NOS',
          unitPrice,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
  assert(quoRes.status === 201, 'create quotation', `${quoRes.status} ${JSON.stringify(quoRes.body?.error ?? quoRes.body?.message ?? '')}`)
  const quotationId = quoRes.body.data.id as string
  const documentId = quoRes.body.data.documents[0].id as string
  assert(Boolean(quoRes.body.data.itemId), 'quotation header itemId', String(quoRes.body.data.itemId))
  assert(!('productId' in quoRes.body.data), 'quotation header has no productId')

  const priceLines = (quoRes.body.data.documents[0].priceLines ?? []) as Array<{
    itemId?: string | null
  }>
  assert(Boolean(priceLines[0]?.itemId), 'quote price line itemId', JSON.stringify(priceLines[0]))
  assert(!('productId' in (priceLines[0] ?? {})), 'quote price line has no productId')

  const submit = await request(app)
    .post(`${CRM}/quotations/${quotationId}/documents/${documentId}/submit-approval`)
    .set(auth(token))
    .send({})
  assert(submit.status === 200, 'submit/approve quotation', String(submit.status))

  const sent = await request(app)
    .post(`${CRM}/quotations/${quotationId}/documents/${documentId}/mark-sent`)
    .set(auth(token))
    .send({})
  assert(sent.status === 200, 'mark quotation sent', String(sent.status))

  const cust = await request(app)
    .post(`${CRM}/quotations/${quotationId}/documents/${documentId}/customer-approve`)
    .set(auth(token))
    .send({ remarks: 'Item funnel customer accepted' })
  assert(cust.status === 200, 'customer approve quotation', String(cust.status))

  const conv = await request(app)
    .post(`${CRM}/quotations/${quotationId}/convert-to-sales-order`)
    .set(auth(token))
    .send({
      documentId,
      customerPoNumber: `PO-ITEM-FUNNEL-${stamp}`,
      deliveryTime: '6 weeks',
    })
  assert(
    conv.status === 201,
    'convert quotation→SO',
    `${conv.status} ${JSON.stringify(conv.body?.error ?? conv.body?.message ?? conv.body)}`,
  )
  const salesOrderId = conv.body.data.salesOrderId as string
  const so = conv.body.data.salesOrder
  assert(Boolean(so.itemId), 'SO header itemId', String(so.itemId))
  assert(!('productId' in so), 'SO header has no productId')
  const soLines = (so.lines ?? []) as Array<{ id: string; itemId?: string | null }>
  assert(Boolean(soLines[0]?.itemId), 'SO line itemId', JSON.stringify(soLines[0]))
  assert(!('productId' in (soLines[0] ?? {})), 'SO line has no productId')
  const lineId = soLines[0]?.id
  if (!lineId) fail('SO line id')

  const confirm = await request(app)
    .post(`${CRM}/sales-orders/${salesOrderId}/confirm`)
    .set(auth(token))
    .send({})
  assert(confirm.status === 200, 'confirm sales order', `${confirm.status} ${JSON.stringify(confirm.body?.error ?? '')}`)
  assert(confirm.body.data.status === 'confirmed', 'SO status confirmed', confirm.body.data.status)

  const eligibility = await request(app)
    .get(`${MFG}/demand-sources/sales-orders/${salesOrderId}/lines`)
    .set(auth(token))
  assert(
    eligibility.status === 200,
    'MFG SO line eligibility',
    `${eligibility.status} ${JSON.stringify(eligibility.body?.error ?? '')}`,
  )

  const convertMfg = await request(app)
    .post(`${MFG}/demand-sources/sales-orders/${salesOrderId}/lines/${lineId}/convert`)
    .set(auth(token))
    .send({
      quantity: 1,
      priority: 'MEDIUM',
      idempotencyKey: `item-funnel-${stamp}`,
    })
  assert(
    convertMfg.status === 201 || convertMfg.status === 200,
    'MFG convert SO line→demand',
    `${convertMfg.status} ${JSON.stringify(convertMfg.body?.error ?? convertMfg.body?.message ?? convertMfg.body)}`,
  )
  const demand = convertMfg.body.data?.demand
  assert(Boolean(demand?.id), 'production demand created', String(demand?.id))
  assert(
    demand?.productItemId === item.id || demand?.productItemId === so.itemId,
    'demand productItemId matches item',
    `${demand?.productItemId} vs ${item.id}`,
  )

  // Soft-delete cleanup (keep audit trail light)
  await prisma.productionDemand.updateMany({
    where: { id: demand.id },
    data: { deletedAt: new Date() },
  })
  if (convertMfg.body.data?.order?.id) {
    await prisma.productionOrder.updateMany({
      where: { id: convertMfg.body.data.order.id },
      data: { deletedAt: new Date() },
    })
  }
  await prisma.crmSalesOrder.update({
    where: { id: salesOrderId },
    data: { deletedAt: new Date() },
  })
  await prisma.crmQuotationDocument.updateMany({
    where: { quotationId },
    data: { deletedAt: new Date() },
  })
  await prisma.crmQuotation.update({
    where: { id: quotationId },
    data: { deletedAt: new Date(), status: 'cancelled' },
  })
  await request(app).delete(`${CRM}/opportunities/${opportunityId}`).set(auth(token))
  await request(app).delete(`${CRM}/leads/${leadId}`).set(auth(token))
  ok('cleanup soft-delete')

  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
