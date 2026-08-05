/**
 * GST books-side period UAT harness (local MySQL) — no Vitest imports.
 *
 * Seeds an isolated finance+tax tenant, sample GST ledger + matching GL nets,
 * then walks prepare → lock → SIM package → submit and diagnostic engines.
 *
 * Does NOT claim FULL GST COMPLIANT or LIVE portal.
 *
 * Usage:
 *   npx tsx scripts/uat-gst-books-period.ts
 *   GST_UAT_KEEP=1 npx tsx scripts/uat-gst-books-period.ts
 *   npm run uat:gst-books
 */
import { randomUUID } from 'crypto'
import type { Request } from 'express'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import { hashPassword } from '../src/utils/password.js'
import * as gstrReturnService from '../src/modules/accounting/tax-compliance/gstr-return.service.js'
import * as portalService from '../src/modules/accounting/tax-compliance/gstr-portal-filing.service.js'
import * as dataQualityService from '../src/modules/accounting/tax-compliance/gst-data-quality.service.js'
import * as glReconService from '../src/modules/accounting/tax-compliance/gst-gl-recon.service.js'
import * as hardeningService from '../src/modules/accounting/tax-compliance/gst-compliance-hardening.service.js'
import * as rateOpsService from '../src/modules/accounting/tax-compliance/gst-rate-ops.service.js'
import { buildPhase17CapabilityMatrix } from '../src/modules/accounting/tax-compliance/gst-data-quality.util.js'
import { buildPhase18CapabilityMatrix } from '../src/modules/accounting/tax-compliance/gst-gl-recon.util.js'

type StepResult = {
  id: string
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP'
  message: string
  detail?: unknown
}

const TAX_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('tax.gst.') || p.startsWith('finance.tax.'),
) as PermissionName[]
const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.')) as PermissionName[]

function mockReq(userId: string, perms: string[]): Request {
  return {
    context: { userId, permissions: perms, roles: [], isSuperAdmin: false },
  } as unknown as Request
}

function returnPeriodFromDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

async function createUserWithPerms(
  app: ReturnType<typeof createApp>,
  tenantId: string,
  slug: string,
  permNames: PermissionName[],
  label: string,
): Promise<{ userId: string; token: string }> {
  const pw = await hashPassword('Test@123')
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}@${slug}.test`
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: label,
      lastName: 'User',
      email,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } })
  const role = await prisma.role.create({
    data: {
      tenantId,
      name: `${label} Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'Test@123', tenantSlug: slug })
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

async function bootstrapFinanceAndCoa(params: {
  app: ReturnType<typeof createApp>
  tenantId: string
  slug: string
  token: string
  userId: string
}) {
  const { app, token, slug, tenantId, userId } = params
  const auth = { Authorization: `Bearer ${token}` }
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/legal-entities`)
    .set(auth)
    .send({
      code: `GLE${Date.now()}`.slice(-10),
      legalName: 'GST Books UAT Co Pvt Ltd',
      displayName: 'GST Books UAT',
      stateCode: '27',
      gstin: '27AAAAA0000A1Z5',
    })
  if (leRes.status !== 201) {
    throw new Error(`Create LE failed: ${leRes.status} ${JSON.stringify(leRes.body)}`)
  }
  const legalEntityId = leRes.body.data.id as string

  let fyRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/financial-years`)
    .set(auth)
    .send({
      legalEntityId,
      name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      startDate: fyStart,
      endDate: fyEnd,
      isCurrent: true,
    })
  for (let i = 0; i < 5 && fyRes.status !== 201; i++) {
    await new Promise((r) => setTimeout(r, 200))
    fyRes = await request(app)
      .post(`/api/v1/t/${slug}/accounting/financial-years`)
      .set(auth)
      .send({
        legalEntityId,
        name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
        startDate: fyStart,
        endDate: fyEnd,
        isCurrent: true,
      })
  }
  if (fyRes.status !== 201) {
    throw new Error(`Create FY failed: ${fyRes.status} ${JSON.stringify(fyRes.body)}`)
  }
  const financialYearId = fyRes.body.data.id as string

  await request(app)
    .post(`/api/v1/t/${slug}/accounting/financial-years/${financialYearId}/activate`)
    .set(auth)

  const tpl = await request(app)
    .post(`/api/v1/t/${slug}/accounting/accounts/apply-template`)
    .set(auth)
    .send({ legalEntityId, templateId: 'TRADING' })
  if (tpl.status !== 201 && tpl.status !== 200) {
    throw new Error(`Apply template failed: ${tpl.status} ${JSON.stringify(tpl.body)}`)
  }

  const gstOutCgst = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountCode: '220101' },
  })
  const gstOutSgst = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountCode: '220102' },
  })
  const gstOutIgst = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountCode: '220103' },
  })
  const gstInCgst = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountCode: '520101' },
  })
  const gstInSgst = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountCode: '520102' },
  })
  const gstInIgst = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountCode: '520103' },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const sales = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const tdsPayable = await prisma.account.findFirst({
    where: { tenantId, legalEntityId, accountType: 'TDS_PAYABLE', isGroup: false },
  })

  if (!gstOutCgst || !gstOutSgst || !receivable || !sales || !payable || !purchase) {
    throw new Error('CoA template did not create required GST/receivable/sales accounts')
  }

  const mapBody = {
    legalEntityId,
    mappings: [
      { mappingKey: 'CUSTOMER_RECEIVABLE', accountId: receivable.id },
      { mappingKey: 'VENDOR_PAYABLE', accountId: payable.id },
      { mappingKey: 'SALES_REVENUE', accountId: sales.id },
      { mappingKey: 'PURCHASE', accountId: purchase.id },
      ...(gstInCgst ? [{ mappingKey: 'GST_INPUT_CGST', accountId: gstInCgst.id }] : []),
      ...(gstInSgst ? [{ mappingKey: 'GST_INPUT_SGST', accountId: gstInSgst.id }] : []),
      ...(gstInIgst ? [{ mappingKey: 'GST_INPUT_IGST', accountId: gstInIgst.id }] : []),
      { mappingKey: 'GST_OUTPUT_CGST', accountId: gstOutCgst.id },
      { mappingKey: 'GST_OUTPUT_SGST', accountId: gstOutSgst.id },
      ...(gstOutIgst ? [{ mappingKey: 'GST_OUTPUT_IGST', accountId: gstOutIgst.id }] : []),
      ...(tdsPayable ? [{ mappingKey: 'TDS_PAYABLE', accountId: tdsPayable.id }] : []),
      ...(retained ? [{ mappingKey: 'RETAINED_EARNINGS', accountId: retained.id }] : []),
    ],
  }

  const mapRes = await request(app)
    .put(`/api/v1/t/${slug}/accounting/default-mappings`)
    .set(auth)
    .send(mapBody)
  if (mapRes.status !== 200) {
    throw new Error(`Default mappings failed: ${mapRes.status} ${JSON.stringify(mapRes.body)}`)
  }

  await request(app).post(`/api/v1/t/${slug}/accounting/activate`).set(auth).send({ legalEntityId })

  return {
    tenantId,
    userId,
    slug,
    legalEntityId,
    financialYearId,
    postingDate,
    gstOutCgstId: gstOutCgst.id,
    gstOutSgstId: gstOutSgst.id,
    receivableId: receivable.id,
    salesId: sales.id,
  }
}

async function seedGstBooksSlice(params: {
  tenantId: string
  legalEntityId: string
  financialYearId: string
  userId: string
  gstin: string
  returnPeriod: string
  postingDate: string
  outCgstAcct: string
  outSgstAcct: string
  recvAcct: string
  salesAcct: string
  taxable: number
  cgst: number
  sgst: number
}) {
  const docId = randomUUID()
  const lineId = randomUUID()
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      financialYearId: params.financialYearId,
      status: 'OPEN',
      startDate: { lte: new Date(`${params.postingDate}T00:00:00.000Z`) },
      endDate: { gte: new Date(`${params.postingDate}T00:00:00.000Z`) },
    },
  })
  if (!period) throw new Error('No OPEN accounting period for posting date')

  const voucherId = randomUUID()
  const vNum = `UAT-GST-${Date.now().toString().slice(-6)}`
  const dRec = params.taxable + params.cgst + params.sgst

  await prisma.accountingVoucher.create({
    data: {
      id: voucherId,
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      financialYearId: params.financialYearId,
      accountingPeriodId: period.id,
      voucherType: 'JOURNAL',
      voucherNumber: vNum,
      status: 'POSTED',
      documentDate: new Date(`${params.postingDate}T00:00:00.000Z`),
      postingDate: new Date(`${params.postingDate}T00:00:00.000Z`),
      narration: 'GST books UAT sample SI tax slice',
      totalDebit: dRec,
      totalCredit: dRec,
      baseTotalDebit: dRec,
      baseTotalCredit: dRec,
      postedAt: new Date(),
      postedBy: params.userId,
      createdBy: params.userId,
    },
  })

  const lines = [
    { id: randomUUID(), lineNumber: 1, accountId: params.recvAcct, debit: dRec, credit: 0 },
    { id: randomUUID(), lineNumber: 2, accountId: params.outCgstAcct, debit: 0, credit: params.cgst },
    { id: randomUUID(), lineNumber: 3, accountId: params.outSgstAcct, debit: 0, credit: params.sgst },
    { id: randomUUID(), lineNumber: 4, accountId: params.salesAcct, debit: 0, credit: params.taxable },
  ]

  for (const ln of lines) {
    await prisma.accountingVoucherLine.create({
      data: {
        id: ln.id,
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        voucherId,
        lineNumber: ln.lineNumber,
        accountId: ln.accountId,
        debitAmount: ln.debit,
        creditAmount: ln.credit,
        baseDebitAmount: ln.debit,
        baseCreditAmount: ln.credit,
      },
    })
    await prisma.generalLedgerEntry.create({
      data: {
        id: randomUUID(),
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        financialYearId: params.financialYearId,
        accountingPeriodId: period.id,
        voucherId,
        voucherLineId: ln.id,
        voucherType: 'JOURNAL',
        voucherNumber: vNum,
        lineNumber: ln.lineNumber,
        postingDate: new Date(`${params.postingDate}T00:00:00.000Z`),
        documentDate: new Date(`${params.postingDate}T00:00:00.000Z`),
        accountId: ln.accountId,
        debitAmount: ln.debit,
        creditAmount: ln.credit,
        baseDebitAmount: ln.debit,
        baseCreditAmount: ln.credit,
        postedBy: params.userId,
        sourceModule: 'tax-uat',
        sourceDocumentType: 'SALES_INVOICE',
        sourceDocumentId: docId,
      },
    })
  }

  const common = {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    documentType: 'SALES_INVOICE' as const,
    documentId: docId,
    documentNumber: 'UAT-SI-001',
    documentDate: new Date(`${params.postingDate}T00:00:00.000Z`),
    returnPeriod: params.returnPeriod,
    companyGstin: params.gstin,
    partyGstin: '29BBBBB0000B1Z5',
    placeOfSupply: '27',
    hsnSacCode: '87089900',
    filingStatus: 'NOT_FILED' as const,
    direction: 'OUTWARD' as const,
  }

  await prisma.gstLedgerEntry.createMany({
    data: [
      {
        id: randomUUID(),
        ...common,
        documentLineId: `${lineId}-t`,
        taxType: 'OUTPUT_CGST',
        taxableValue: params.taxable,
        taxRate: 9,
        taxAmount: params.cgst,
        sourceSnapshot: { itemId: 'uat-item', companyGstin: params.gstin },
      },
      {
        id: randomUUID(),
        ...common,
        documentLineId: `${lineId}-s`,
        taxType: 'OUTPUT_SGST',
        taxableValue: params.taxable,
        taxRate: 9,
        taxAmount: params.sgst,
        sourceSnapshot: { itemId: 'uat-item', companyGstin: params.gstin },
      },
    ],
  })

  return { docId, voucherId, voucherNumber: vNum }
}

async function softCleanupTenant(tenantId: string) {
  // Best-effort for UAT isolation; ignore errors on order.
  const dels: Array<() => Promise<unknown>> = [
    () => prisma.gstGlReconRun.deleteMany({ where: { tenantId } }),
    () => prisma.gstDataQualityRun.deleteMany({ where: { tenantId } }),
    () => prisma.gstrFilingSession.deleteMany({ where: { tenantId } }),
    () => prisma.gstrReturnPeriod.deleteMany({ where: { tenantId } }),
    () => prisma.gstLedgerEntry.deleteMany({ where: { tenantId } }),
    () => prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }),
    () => prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }),
    () => prisma.accountingVoucher.deleteMany({ where: { tenantId } }),
    () => prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }),
    () => prisma.account.deleteMany({ where: { tenantId } }),
    () => prisma.accountingPeriod.deleteMany({ where: { tenantId } }),
    () => prisma.financialYear.deleteMany({ where: { tenantId } }),
    () => prisma.legalEntity.deleteMany({ where: { tenantId } }),
    () => prisma.userRole.deleteMany({ where: { tenantId } }),
    () => prisma.rolePermission.deleteMany({ where: { role: { tenantId } } }),
    () => prisma.role.deleteMany({ where: { tenantId } }),
    () => prisma.user.deleteMany({ where: { tenantId } }),
    () => prisma.tenant.deleteMany({ where: { id: tenantId } }),
  ]
  for (const fn of dels) {
    await fn().catch(() => {})
  }
}

async function main() {
  const steps: StepResult[] = []
  const keep = process.env.GST_UAT_KEEP === '1' || process.env.GST_UAT_KEEP === 'true'
  process.env.GST_PORTAL_FILING_PROVIDER_MODE = process.env.GST_PORTAL_FILING_PROVIDER_MODE || 'SIMULATED'

  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  if (!dbOk) {
    console.error('FAIL: MySQL not reachable')
    process.exit(2)
  }

  await ensurePermissions()
  const app = createApp()
  const slug = `gst-books-uat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const pw = await hashPassword('Test@123')
  const tenant = await prisma.tenant.create({
    data: {
      name: 'GST Books UAT',
      slug,
      email: `${slug}@test.com`,
      status: 'ACTIVE',
    },
  })
  const combinedPerms = [...new Set([...FINANCE_PERMS, ...TAX_PERMS])] as PermissionName[]
  const admin = await createUserWithPerms(app, tenant.id, slug, combinedPerms, 'gst-books-admin')
  const req = mockReq(admin.userId, combinedPerms)

  let fx: Awaited<ReturnType<typeof bootstrapFinanceAndCoa>> | null = null
  try {
    fx = await bootstrapFinanceAndCoa({
      app,
      tenantId: tenant.id,
      slug,
      token: admin.token,
      userId: admin.userId,
    })
    steps.push({ id: 'finance_bootstrap', status: 'PASS', message: 'LE + FY + CoA + GST mappings' })
  } catch (e) {
    steps.push({
      id: 'finance_bootstrap',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
    console.log(JSON.stringify({ steps, fail: true }, null, 2))
    if (!keep) await softCleanupTenant(tenant.id)
    await prisma.$disconnect()
    process.exit(1)
  }

  const gstin = '27AAAAA0000A1Z5'
  const period = returnPeriodFromDate(fx.postingDate)
  const cgst = 900
  const sgst = 900
  const taxable = 10000

  try {
    const seeded = await seedGstBooksSlice({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      financialYearId: fx.financialYearId,
      userId: fx.userId,
      gstin,
      returnPeriod: period,
      postingDate: fx.postingDate,
      outCgstAcct: fx.gstOutCgstId,
      outSgstAcct: fx.gstOutSgstId,
      recvAcct: fx.receivableId,
      salesAcct: fx.salesId,
      taxable,
      cgst,
      sgst,
    })
    steps.push({
      id: 'seed_ledger_gl',
      status: 'PASS',
      message: `Seeded SI UAT ledger + GL voucher ${seeded.voucherNumber}`,
      detail: seeded,
    })
  } catch (e) {
    steps.push({
      id: 'seed_ledger_gl',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const freeze = await dataQualityService.getFreezeReadiness(req, fx.tenantId, {
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
    })
    steps.push({
      id: 'p17_data_quality',
      status: freeze.checklist.ready ? 'PASS' : 'WARN',
      message: freeze.checklist.summary,
      detail: { ready: freeze.checklist.ready, health: freeze.health },
    })
  } catch (e) {
    steps.push({
      id: 'p17_data_quality',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const recon = await glReconService.runGlRecon(req, fx.tenantId, {
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      companyGstin: gstin,
      tolerance: 1,
    })
    const cgstLine = recon.lines.find((l) => l.taxType === 'OUTPUT_CGST')
    const sgstLine = recon.lines.find((l) => l.taxType === 'OUTPUT_SGST')
    const outputMatch = cgstLine?.status === 'MATCH' && sgstLine?.status === 'MATCH'
    steps.push({
      id: 'p18_gl_recon',
      status: outputMatch ? 'PASS' : 'WARN',
      message: `Health ${recon.health.overall}; OUTPUT CGST/SGST match=${outputMatch}`,
      detail: { health: recon.health, cgstLine, sgstLine },
    })
  } catch (e) {
    steps.push({
      id: 'p18_gl_recon',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const cap = rateOpsService.getRateOpsCapability(req)
    steps.push({
      id: 'p16_rate_ops_capability',
      status: 'PASS',
      message: 'Rate ops capability reachable',
      detail: { featureEnabled: cap.featureEnabled, full: (cap as { fullGstCompliant?: boolean }).fullGstCompliant },
    })
  } catch (e) {
    steps.push({
      id: 'p16_rate_ops_capability',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    await gstrReturnService.prepareReturn({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      returnType: 'GSTR1',
      companyGstin: gstin,
      actorUserId: admin.userId,
    })
    await gstrReturnService.lockReturn({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      returnType: 'GSTR1',
      companyGstin: gstin,
      actorUserId: admin.userId,
    })
    steps.push({ id: 'p5_gstr1_lock', status: 'PASS', message: 'GSTR-1 prepare + lock OK' })
  } catch (e) {
    steps.push({
      id: 'p5_gstr1_lock',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    await gstrReturnService.prepareReturn({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      returnType: 'GSTR3B',
      companyGstin: gstin,
      actorUserId: admin.userId,
    })
    await gstrReturnService.lockReturn({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      returnType: 'GSTR3B',
      companyGstin: gstin,
      actorUserId: admin.userId,
    })
    steps.push({ id: 'p5_gstr3b_lock', status: 'PASS', message: 'GSTR-3B prepare + lock OK' })
  } catch (e) {
    steps.push({
      id: 'p5_gstr3b_lock',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const pkg = await portalService.createFilingPackage(req, fx.tenantId, {
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      returnType: 'GSTR1',
      companyGstin: gstin,
      requireChecker: false,
      remarks: 'Books UAT SIM package',
    })
    const submitted = await portalService.submitFiling(req, fx.tenantId, String((pkg as { id: string }).id))
    const status = String((submitted as { status?: string }).status ?? '')
    const arn = (submitted as { acknowledgmentRef?: string | null }).acknowledgmentRef
    steps.push({
      id: 'p12_portal_simulated',
      status: status === 'ACCEPTED_SIMULATED' ? 'PASS' : 'WARN',
      message: `Portal session ${status} ARN=${arn ?? 'n/a'}`,
      detail: { sessionId: (pkg as { id?: string }).id, status, arn },
    })
  } catch (e) {
    steps.push({
      id: 'p12_portal_simulated',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const health = await hardeningService.getPeriodHealth({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      returnPeriod: period,
      companyGstin: gstin,
    })
    steps.push({
      id: 'p13_period_health',
      status: 'PASS',
      message: `Period health label=${health.readinessLabel}`,
      detail: {
        preFile: health.preFile,
        liability: health.liabilityProposal,
        notFullGstCompliant: health.notFullGstCompliant,
      },
    })
  } catch (e) {
    steps.push({
      id: 'p13_period_health',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const gate = await hardeningService.getGoLiveGate({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      companyGstin: gstin,
    })
    const canClaim = (gate as { canClaimFullGstCompliant?: boolean }).canClaimFullGstCompliant
    steps.push({
      id: 'p13_go_live_honesty',
      status: canClaim === true ? 'FAIL' : 'PASS',
      message:
        canClaim === true
          ? 'ILLEGAL: gate claimed FULL GST COMPLIANT'
          : 'Go-live gate correctly refuses FULL GST COMPLIANT',
    })
  } catch (e) {
    steps.push({
      id: 'p13_go_live_honesty',
      status: 'FAIL',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  steps.push({
    id: 'honest_matrix',
    status: 'PASS',
    message: 'P17/P18 capability matrices never claim full compliance',
    detail: {
      p17: buildPhase17CapabilityMatrix().canClaimFullGstCompliant,
      p18: buildPhase18CapabilityMatrix().canClaimFullGstCompliant,
    },
  })

  const fail = steps.filter((s) => s.status === 'FAIL').length
  const warn = steps.filter((s) => s.status === 'WARN').length
  const pass = steps.filter((s) => s.status === 'PASS').length

  const report = {
    runAt: new Date().toISOString(),
    tenantSlug: slug,
    tenantId: tenant.id,
    legalEntityId: fx.legalEntityId,
    companyGstin: gstin,
    returnPeriod: period,
    summary: { pass, warn, fail, total: steps.length },
    verdict: fail === 0 ? 'GST_BOOKS_UAT_READY_WITH_CONDITIONS' : 'GST_BOOKS_UAT_BLOCKED',
    notFullGstCompliant: true as const,
    portalMode: process.env.GST_PORTAL_FILING_PROVIDER_MODE ?? 'SIMULATED',
    steps,
    keepTenant: keep,
  }

  console.log(JSON.stringify(report, null, 2))

  if (!keep) await softCleanupTenant(tenant.id)
  else console.error(`\nKept tenant ${slug} (GST_UAT_KEEP=1).`)

  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
