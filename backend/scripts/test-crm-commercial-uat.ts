/**
 * CRM Commercial UAT — Proforma → Receipt → Allocation → Tax Invoice
 *
 * Usage: npx tsx scripts/test-crm-commercial-uat.ts [tenantSlug]
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'
const app = createApp()

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function tryLogin(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200 || !res.body.data?.accessToken) return null
  return res.body.data.accessToken as string
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

const COMMERCIAL_PERMS = [
  'crm.commercial.view',
  'crm.commercial.receipt.view',
  'crm.commercial.receipt.create',
  'crm.commercial.invoice.view',
  'crm.commercial.invoice.create',
  'crm.commercial.invoice.post',
  'crm.commercial.invoice.cancel',
  'crm.commercial.allocation.view',
  'crm.commercial.allocation.create',
  'crm.commercial.allocation.reverse',
] as const

async function ensureCommercialRoleGrants(tenantId: string) {
  for (const permName of COMMERCIAL_PERMS) {
    const [module] = permName.split('.')
    await prisma.permission.upsert({
      where: { name: permName },
      create: { name: permName, module, description: permName },
      update: {},
    })
  }
  for (const roleName of ['Sales Manager', 'Tenant Admin', 'Admin']) {
    const role = await prisma.role.findFirst({ where: { tenantId, name: roleName } })
    if (!role) continue
    for (const permName of COMMERCIAL_PERMS) {
      const permission = await prisma.permission.findUnique({ where: { name: permName } })
      if (!permission) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      })
    }
  }
}

async function main() {
  console.log(`\n=== CRM Commercial UAT (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)
  await ensureCommercialRoleGrants(tenant.id)

  let token = await tryLogin('sales@vasant-trailers.com', 'Sales@123')
  if (!token) token = await tryLogin('admin@vasant-trailers.com', 'Admin@123')
  if (!token) fail('Login failed for sales@vasant-trailers.com and admin@vasant-trailers.com')
  const base = `/api/v1/t/${TENANT_SLUG}/crm/commercial`

  const company = await prisma.crmCompany.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, isActive: true },
    orderBy: { name: 'asc' },
  })
  if (!company) fail('No active CRM company found')

  const item = await prisma.masterItem.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ salesAllowed: true }, { itemType: 'FG' }],
    },
    orderBy: { code: 'asc' },
  })
  if (!item) fail('No sellable master item found')

  const line = {
    itemId: item.id,
    itemCode: item.code,
    description: item.name,
    hsnCode: item.hsnCode ?? '8716',
    qty: 1,
    uom: 'NOS',
    unitPrice: 100000,
    discountPct: 0,
    taxPct: 18,
  }

  const createPi = await request(app)
    .post(`${base}/proformas`)
    .set(auth(token))
    .send({
      companyId: company.id,
      proformaDate: new Date().toISOString().slice(0, 10),
      source: 'direct',
      paymentTerms: '30% advance, balance against proforma',
      deliveryTerms: 'Ex-works',
      lines: [line],
    })
  if (createPi.status !== 201) fail(`Create proforma: ${createPi.status} ${JSON.stringify(createPi.body)}`)
  const pi = createPi.body.data
  console.log(`✓ Proforma created: ${pi.proformaNo} (${pi.id}) total=${pi.gst.grandTotal}`)

  const issuePi = await request(app).post(`${base}/proformas/${pi.id}/issue`).set(auth(token))
  if (issuePi.status !== 200) fail(`Issue proforma: ${issuePi.status} ${JSON.stringify(issuePi.body)}`)
  console.log(`✓ Proforma issued`)

  const grandTotal = Number(pi.gst.grandTotal)
  const half = Math.round(grandTotal / 2)

  const rcpt1 = await request(app)
    .post(`${base}/receipts`)
    .set(auth(token))
    .send({
      companyId: company.id,
      receiptDate: new Date().toISOString().slice(0, 10),
      paymentMode: 'neft',
      transactionRef: `UAT-${Date.now()}-1`,
      amount: half,
      proformaInvoiceId: pi.id,
      proformaNo: pi.proformaNo,
      proformaGrandTotal: grandTotal,
    })
  if (rcpt1.status !== 201) fail(`Receipt 1: ${rcpt1.status} ${JSON.stringify(rcpt1.body)}`)
  console.log(`✓ Partial receipt: ${rcpt1.body.data.receiptNo} amount=${half}`)

  const rcpt2 = await request(app)
    .post(`${base}/receipts`)
    .set(auth(token))
    .send({
      companyId: company.id,
      receiptDate: new Date().toISOString().slice(0, 10),
      paymentMode: 'upi',
      transactionRef: `UAT-${Date.now()}-2`,
      amount: grandTotal - half,
      proformaInvoiceId: pi.id,
      proformaNo: pi.proformaNo,
      proformaGrandTotal: grandTotal,
    })
  if (rcpt2.status !== 201) fail(`Receipt 2: ${rcpt2.status} ${JSON.stringify(rcpt2.body)}`)
  const receipt = rcpt2.body.data
  console.log(`✓ Final receipt: ${receipt.receiptNo}`)

  const createInv = await request(app)
    .post(`${base}/invoices`)
    .set(auth(token))
    .send({
      companyId: company.id,
      source: 'proforma',
      proformaInvoiceId: pi.id,
      proformaNo: pi.proformaNo,
      customerState: company.state ?? 'Maharashtra',
      lines: pi.lines.map((l: { itemId: string; itemCode: string; description: string; hsnCode: string; qty: number; uom: string; unitPrice: number; discountPct: number; taxPct: number; id: string }) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        description: l.description,
        hsnCode: l.hsnCode,
        qty: l.qty,
        uom: l.uom,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        sourceLineId: l.id,
      })),
    })
  if (createInv.status !== 201) fail(`Create invoice: ${createInv.status} ${JSON.stringify(createInv.body)}`)
  const inv = createInv.body.data
  console.log(`✓ Tax invoice draft: ${inv.invoiceNo} (${inv.id})`)

  const postInv = await request(app).post(`${base}/invoices/${inv.id}/post`).set(auth(token))
  if (postInv.status !== 200) fail(`Post invoice: ${postInv.status} ${JSON.stringify(postInv.body)}`)
  console.log(`✓ Tax invoice posted`)

  const alloc1 = await request(app)
    .post(`${base}/allocations`)
    .set(auth(token))
    .send({
      receiptId: rcpt1.body.data.id,
      allocations: [{ invoiceId: inv.id, amount: half }],
    })
  if (alloc1.status !== 201) fail(`Allocate partial: ${alloc1.status} ${JSON.stringify(alloc1.body)}`)
  console.log(`✓ Allocated ${half} from ${rcpt1.body.data.receiptNo}`)

  const alloc = await request(app)
    .post(`${base}/allocations`)
    .set(auth(token))
    .send({
      receiptId: receipt.id,
      allocations: [{ invoiceId: inv.id, amount: grandTotal - half }],
    })
  if (alloc.status !== 201) fail(`Allocate: ${alloc.status} ${JSON.stringify(alloc.body)}`)
  console.log(`✓ Allocated ${grandTotal - half} from ${receipt.receiptNo} → ${inv.invoiceNo}`)

  const sync = await request(app).get(`${base}/sync`).set(auth(token))
  if (sync.status !== 200) fail(`Sync: ${sync.status}`)
  const bundle = sync.body.data
  const syncedPi = (bundle.proformas ?? []).find((p: { id: string }) => p.id === pi.id)
  console.log(`✓ Sync bundle: proformas=${bundle.proformas?.length ?? 0} receipts=${bundle.receipts?.length ?? 0} invoices=${bundle.invoices?.length ?? 0}`)
  if (!syncedPi) fail('Created proforma missing from sync bundle')

  console.log('\nPASS — CRM Commercial UAT complete\n')
  console.log(JSON.stringify({
    proformaId: pi.id,
    proformaNo: pi.proformaNo,
    receiptIds: [rcpt1.body.data.id, receipt.id],
    invoiceId: inv.id,
    invoiceNo: inv.invoiceNo,
    grandTotal,
  }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
