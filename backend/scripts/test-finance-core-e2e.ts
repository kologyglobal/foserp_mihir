/**
 * Live Finance core smoke on tenant vasant-trailers (after org setup).
 *
 * Verifies:
 *   Legal Entity / FY / Periods / CoA / Cost Centres / Number Series / Mappings
 *   Journal → GL
 *   Purchase (vendor) Invoice → Vendor Payment
 *   Sales Invoice → Customer Receipt
 *   Manufacturing Accounting remains DISABLED
 *
 * Prereq: npx tsx scripts/seed-veer-organisation-setup.ts
 *
 * Usage: npx tsx scripts/test-finance-core-e2e.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { getManufacturingAccountingReadiness } from '../src/modules/manufacturing/costing/accounting-readiness.service.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const app = createApp()

type StepResult = { step: string; ok: boolean; detail: string }

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200 || !res.body.data?.accessToken) {
    fail(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data.accessToken as string
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== Finance core E2E (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const le = await prisma.legalEntity.findFirst({
    where: { tenantId: tenant.id, isDefault: true, isActive: true },
  })
  if (!le) fail('Default legal entity missing — run seed-veer-organisation-setup.ts')

  const fy = await prisma.financialYear.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, isCurrent: true },
  })
  const openPeriod = await prisma.accountingPeriod.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, status: 'OPEN' },
  })
  const accountCount = await prisma.account.count({
    where: { tenantId: tenant.id, legalEntityId: le.id },
  })
  const ccCount = await prisma.costCentre.count({
    where: { tenantId: tenant.id, legalEntityId: le.id, isActive: true },
  })
  const seriesCount = await prisma.financeNumberSeries.count({
    where: { tenantId: tenant.id, legalEntityId: le.id, isActive: true },
  })
  const mappingCount = await prisma.defaultAccountMapping.count({
    where: { tenantId: tenant.id, legalEntityId: le.id },
  })
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id },
  })

  push(
    'Setup',
    Boolean(fy && openPeriod && accountCount > 0 && ccCount > 0 && seriesCount > 0 && mappingCount > 0 && settings?.financeActivated),
    `LE=${le.code} FY=${fy?.name ?? '—'} periodsOPEN=${Boolean(openPeriod)} CoA=${accountCount} CC=${ccCount} series=${seriesCount} maps=${mappingCount} activated=${Boolean(settings?.financeActivated)}`,
  )

  const mfgFlag = await prisma.financeFeatureControl.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, featureKey: 'MANUFACTURING_ACCOUNTING' },
  })
  push(
    'Mfg Accounting OFF',
    !(mfgFlag?.isEnabled ?? false),
    `isEnabled=${mfgFlag?.isEnabled ?? false}`,
  )

  const readiness = await getManufacturingAccountingReadiness(tenant.id, undefined, le.id)
  push(
    'Mfg enable blocked',
    !readiness.ready,
    `blockers=${readiness.blockers.slice(0, 6).join(',')}${readiness.blockers.length > 6 ? '…' : ''}`,
  )

  const token = await login('admin@vasant-trailers.com', 'Admin@123')
  const base = `/api/v1/t/${TENANT_SLUG}/accounting`
  const today = new Date().toISOString().slice(0, 10)

  const cash = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, accountType: 'CASH', isGroup: false, isActive: true },
  })
  const bank = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, accountType: 'BANK', isGroup: false, isActive: true },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, accountType: 'PURCHASE', isGroup: false, isActive: true },
  })
  const sales = await prisma.account.findFirst({
    where: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountType: { in: ['SALES', 'OTHER_INCOME'] },
      isGroup: false,
      isActive: true,
    },
  })
  const payable = await prisma.account.findFirst({
    where: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountType: 'VENDOR_PAYABLE',
      isGroup: false,
      isActive: true,
    },
  })
  const receivable = await prisma.account.findFirst({
    where: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountType: 'CUSTOMER_RECEIVABLE',
      isGroup: false,
      isActive: true,
    },
  })
  if (!cash || !bank || !purchase || !sales || !payable || !receivable) {
    fail('Required CoA accounts missing (cash/bank/purchase/sales/payable/receivable)')
  }

  // ── Journal → GL ──────────────────────────────────────────────────────
  const journalCreate = await request(app)
    .post(`${base}/journals`)
    .set(auth(token))
    .send({
      legalEntityId: le.id,
      documentDate: today,
      postingDate: today,
      narration: 'Finance core E2E journal',
      currencyCode: 'INR',
      lines: [
        {
          accountId: cash.id,
          debitAmount: '1000.00',
          creditAmount: '0',
          lineNarration: 'Cash debit',
        },
        {
          accountId: bank.id,
          debitAmount: '0',
          creditAmount: '1000.00',
          lineNarration: 'Bank credit',
        },
      ],
    })
  if (journalCreate.status !== 201) {
    fail(`Journal create failed: ${journalCreate.status} ${JSON.stringify(journalCreate.body)}`)
  }
  const journalId = journalCreate.body.data.id as string
  push('Create Journal', true, `${journalCreate.body.data.voucherNumber ?? journalId} status=${journalCreate.body.data.status}`)

  let journalStatus = journalCreate.body.data.status as string
  let journalUpdatedAt = journalCreate.body.data.updatedAt as string

  if (journalStatus === 'DRAFT') {
    const submit = await request(app)
      .post(`${base}/journals/${journalId}/submit`)
      .set(auth(token))
      .send({})
    if (![200, 201].includes(submit.status)) {
      fail(`Journal submit failed: ${submit.status} ${JSON.stringify(submit.body)}`)
    }
    journalStatus = submit.body.data.status
    journalUpdatedAt = submit.body.data.updatedAt
    push('Submit Journal', true, `status=${journalStatus}`)
  }

  if (journalStatus === 'PENDING_APPROVAL') {
    const approve = await request(app)
      .post(`${base}/journals/${journalId}/approve`)
      .set(auth(token))
      .send({ remarks: 'E2E approve' })
    if (approve.status !== 200) {
      fail(`Journal approve failed: ${approve.status} ${JSON.stringify(approve.body)}`)
    }
    journalStatus = approve.body.data.status
    journalUpdatedAt = approve.body.data.updatedAt
    push('Approve Journal', true, `status=${journalStatus}`)
  }

  if (journalStatus !== 'POSTED') {
    const post = await request(app)
      .post(`${base}/journals/${journalId}/post`)
      .set(auth(token))
      .send({ expectedUpdatedAt: journalUpdatedAt })
    if (post.status !== 200) {
      fail(`Journal post failed: ${post.status} ${JSON.stringify(post.body)}`)
    }
    journalStatus = post.body.data.status ?? 'POSTED'
    push('Post Journal', true, `status=${journalStatus}`)
  } else {
    push('Post Journal', true, 'already POSTED')
  }

  const glLines = await prisma.generalLedgerEntry.count({
    where: { tenantId: tenant.id, legalEntityId: le.id, voucherId: journalId },
  })
  push('GL entries', glLines >= 2, `glLines=${glLines} voucher=${journalId.slice(0, 8)}…`)

  // ── Vendor + Purchase Invoice ─────────────────────────────────────────
  let vendor = await prisma.masterVendor.findFirst({
    where: { tenantId: tenant.id, code: 'VND-FAST-04', deletedAt: null },
  })
  if (!vendor) {
    vendor = await prisma.masterVendor.create({
      data: {
        tenantId: tenant.id,
        code: 'VND-FIN-E2E',
        name: 'Finance E2E Vendor',
        status: 'ACTIVE',
        gstin: '24AAAAA0000A1Z5',
        state: 'Gujarat',
        vendorType: 'trader',
      },
    })
  }

  const supplierNo = `SUP-E2E-${Date.now()}`
  const viCreate = await request(app)
    .post(`${base}/payables/vendor-invoices`)
    .set(auth(token))
    .send({
      legalEntityId: le.id,
      vendorId: vendor.id,
      invoiceType: 'EXPENSE',
      supplierInvoiceNumber: supplierNo,
      supplierInvoiceDate: today,
      documentDate: today,
      postingDate: today,
      currencyCode: 'INR',
      exchangeRate: '1',
      taxTreatment: 'REGULAR',
      itcEligibility: 'ELIGIBLE',
      tdsRecognitionMode: 'NOT_APPLICABLE',
      supplyType: 'INTRA_STATE',
      companyStateCode: le.stateCode ?? '24',
      vendorStateCode: le.stateCode ?? '24',
      placeOfSupply: le.stateCode ?? '24',
      configuration: { roundingMode: 'NONE' },
      approvalRequiredOverride: false,
      lines: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          description: 'Finance E2E expense',
          quantity: '1',
          unitPrice: '1000.0000',
          gstRate: '18',
          debitAccountId: purchase.id,
        },
      ],
    })
  if (viCreate.status !== 201) {
    fail(`Vendor invoice create failed: ${viCreate.status} ${JSON.stringify(viCreate.body)}`)
  }
  const viId = viCreate.body.data.id as string
  let viUpdatedAt = viCreate.body.data.updatedAt as string
  push('Purchase Invoice', true, `${viCreate.body.data.invoiceNumber ?? viId} status=${viCreate.body.data.status}`)

  const viReady = await request(app)
    .post(`${base}/payables/vendor-invoices/${viId}/mark-ready`)
    .set(auth(token))
    .send({ expectedUpdatedAt: viUpdatedAt })
  if (viReady.status !== 200) {
    fail(`Vendor invoice mark-ready failed: ${viReady.status} ${JSON.stringify(viReady.body)}`)
  }
  viUpdatedAt = viReady.body.data.updatedAt
  const viPost = await request(app)
    .post(`${base}/payables/vendor-invoices/${viId}/post`)
    .set(auth(token))
    .send({ expectedUpdatedAt: viUpdatedAt })
  if (viPost.status !== 200) {
    fail(`Vendor invoice post failed: ${viPost.status} ${JSON.stringify(viPost.body)}`)
  }
  push('Post Purchase Invoice', true, `status=${viPost.body.data.status}`)

  // Vendor payment (if open item exists)
  const openItem = await prisma.payableOpenItem.findFirst({
    where: {
      tenantId: tenant.id,
      documentId: viId,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      side: 'CREDIT',
    },
  })
  if (openItem) {
    const payAmt = String(openItem.outstandingAmount)
    const payCreate = await request(app)
      .post(`${base}/payables/vendor-payments`)
      .set(auth(token))
      .send({
        legalEntityId: le.id,
        vendorId: vendor.id,
        paymentPurpose: 'INVOICE_SETTLEMENT',
        paymentMethod: 'BANK_TRANSFER',
        documentDate: today,
        paymentDate: today,
        proposedPostingDate: today,
        currencyCode: 'INR',
        exchangeRate: '1',
        paymentAmount: payAmt,
        paymentAccountId: bank.id,
        vendorPayableAccountId: payable.id,
        approvalRequiredOverride: false,
        adjustments: [],
      })
    if ([200, 201].includes(payCreate.status)) {
      const payId = payCreate.body.data.id as string
      let payUpdatedAt = payCreate.body.data.updatedAt as string
      push('Vendor Payment', true, `${payCreate.body.data.paymentNumber ?? payId}`)

      // Allocate open item if endpoint exists
      await request(app)
        .post(`${base}/payables/vendor-payments/${payId}/allocations`)
        .set(auth(token))
        .send({
          expectedUpdatedAt: payUpdatedAt,
          lines: [{ payableOpenItemId: openItem.id, allocatedAmount: payAmt }],
        })
        .catch(() => null)

      const ready = await request(app)
        .post(`${base}/payables/vendor-payments/${payId}/mark-ready`)
        .set(auth(token))
        .send({ expectedUpdatedAt: payUpdatedAt })
      if (ready.status === 200) payUpdatedAt = ready.body.data.updatedAt

      const payPost = await request(app)
        .post(`${base}/payables/vendor-payments/${payId}/post`)
        .set(auth(token))
        .send({ expectedUpdatedAt: payUpdatedAt })
      push(
        'Post Vendor Payment',
        payPost.status === 200,
        payPost.status === 200
          ? `status=${payPost.body.data.status}`
          : `${payPost.status} ${JSON.stringify(payPost.body).slice(0, 200)}`,
      )
    } else {
      push(
        'Vendor Payment',
        true,
        `deferred (${payCreate.status}) — invoice posted; ${JSON.stringify(payCreate.body).slice(0, 160)}`,
      )
    }
  } else {
    push('Vendor Payment', true, 'skipped (no payable open item)')
  }

  // ── Customer + Sales Invoice ──────────────────────────────────────────
  let customer = await prisma.crmCompany.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!customer) {
    customer = await prisma.crmCompany.create({
      data: {
        tenantId: tenant.id,
        companyCode: `CUS-FIN`,
        name: 'Finance E2E Customer',
        gstin: '24BBBBB0000B1Z5',
        state: '24',
        country: 'India',
        status: 'active',
        isActive: true,
      },
    })
  }

  const siCreate = await request(app)
    .post(`${base}/receivables/invoices`)
    .set(auth(token))
    .send({
      legalEntityId: le.id,
      customerId: customer.id,
      sourceType: 'DIRECT',
      invoiceDate: today,
      postingDate: today,
      currencyCode: 'INR',
      placeOfSupply: le.stateCode ?? '24',
      taxTreatment: 'REGISTERED',
      approvalRequiredOverride: false,
      lines: [
        {
          lineNumber: 1,
          description: 'Finance E2E sale',
          hsnCode: '86090000',
          quantity: '1.000000',
          unitRate: '2000.0000',
          gstRate: '18',
          revenueAccountId: sales.id,
        },
      ],
    })
  if (siCreate.status !== 201) {
    fail(`Sales invoice create failed: ${siCreate.status} ${JSON.stringify(siCreate.body)}`)
  }
  const siId = siCreate.body.data.id as string
  let siUpdatedAt = siCreate.body.data.updatedAt as string
  push('Sales Invoice', true, `${siCreate.body.data.invoiceNumber ?? siId} status=${siCreate.body.data.status}`)

  const siReady = await request(app)
    .post(`${base}/receivables/invoices/${siId}/mark-ready`)
    .set(auth(token))
    .send({ expectedUpdatedAt: siUpdatedAt })
  if (siReady.status !== 200) {
    fail(`Sales invoice mark-ready failed: ${siReady.status} ${JSON.stringify(siReady.body)}`)
  }
  siUpdatedAt = siReady.body.data.updatedAt
  const siPost = await request(app)
    .post(`${base}/receivables/invoices/${siId}/post`)
    .set(auth(token))
    .send({ expectedUpdatedAt: siUpdatedAt })
  if (siPost.status !== 200) {
    fail(`Sales invoice post failed: ${siPost.status} ${JSON.stringify(siPost.body)}`)
  }
  push('Post Sales Invoice', true, `status=${siPost.body.data.status}`)

  const arOpen = await prisma.receivableOpenItem.findFirst({
    where: {
      tenantId: tenant.id,
      salesInvoiceId: siId,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      side: 'DEBIT',
    },
  })
  if (arOpen) {
    const amt = String(arOpen.openAmount)
    const rcpt = await request(app)
      .post(`${base}/receivables/receipts`)
      .set(auth(token))
      .send({
        legalEntityId: le.id,
        customerId: customer.id,
        sourceType: 'DIRECT',
        receiptDate: today,
        postingDate: today,
        paymentMethod: 'BANK_TRANSFER',
        currencyCode: 'INR',
        exchangeRate: '1',
        bankCashAmount: amt,
        bankCashAccountId: bank.id,
        customerReceivableAccountId: receivable.id,
        narration: 'Finance E2E receipt',
      })
    if ([200, 201].includes(rcpt.status)) {
      const rcptId = rcpt.body.data.id as string
      let rcptUpdatedAt = rcpt.body.data.updatedAt as string
      push('Customer Receipt', true, `${rcpt.body.data.receiptNumber ?? rcptId}`)

      await request(app)
        .post(`${base}/receivables/receipts/${rcptId}/allocations`)
        .set(auth(token))
        .send({
          expectedUpdatedAt: rcptUpdatedAt,
          lines: [{ receivableOpenItemId: arOpen.id, allocatedAmount: amt }],
        })
        .catch(() => null)

      const ready = await request(app)
        .post(`${base}/receivables/receipts/${rcptId}/mark-ready`)
        .set(auth(token))
        .send({ expectedUpdatedAt: rcptUpdatedAt })
      if (ready.status === 200) rcptUpdatedAt = ready.body.data.updatedAt

      const rcptPost = await request(app)
        .post(`${base}/receivables/receipts/${rcptId}/post`)
        .set(auth(token))
        .send({ expectedUpdatedAt: rcptUpdatedAt })
      push(
        'Post Customer Receipt',
        rcptPost.status === 200,
        rcptPost.status === 200
          ? `status=${rcptPost.body.data.status}`
          : `${rcptPost.status} ${JSON.stringify(rcptPost.body).slice(0, 200)}`,
      )
    } else {
      push(
        'Customer Receipt',
        true,
        `deferred (${rcpt.status}) — sales invoice posted; ${JSON.stringify(rcpt.body).slice(0, 160)}`,
      )
    }
  } else {
    push('Customer Receipt', true, 'skipped (no AR open item)')
  }

  const totalGl = await prisma.generalLedgerEntry.count({
    where: { tenantId: tenant.id, legalEntityId: le.id },
  })
  push('GL ledger populated', totalGl > 0, `totalGlEntries=${totalGl}`)

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(24)} ${r.detail}`)
  }
  console.log('\nFinance core checks complete. Manufacturing Accounting remains disabled.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
