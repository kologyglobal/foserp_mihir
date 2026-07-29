/**
 * FIN-CLOSE-1 live MySQL proof:
 *   PO → GRN → inventory GL → Purchase Invoice → Vendor Invoice GL
 *   → GR/IR nets to zero + PPV posts
 *   → Purchase Return creates an AP Vendor Debit Note draft
 *
 * Creates an isolated tenant and intentionally retains it as auditable UAT evidence.
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { PERMISSIONS } from '../src/constants/permissions.js'
import {
  createSentPo,
  createSubmittedGrn,
  createTenantUser,
  ensureLegalEntity,
  ensurePermissions,
  seedPurchaseMasters,
} from '../tests/helpers/purchase-live-fixture.js'

const app = createApp()
const runStamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`

function fail(message: string, detail?: unknown): never {
  throw new Error(`${message}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`)
}

function assert(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) fail(message, detail)
}

async function ensureAccount(args: {
  tenantId: string
  legalEntityId: string
  accountCode: string
  accountName: string
  category: 'ASSET' | 'LIABILITY' | 'EXPENSE'
  accountType:
    | 'PURCHASE'
    | 'PURCHASE_RETURN'
    | 'VENDOR_PAYABLE'
    | 'RAW_MATERIAL_INVENTORY'
    | 'FINISHED_GOODS_INVENTORY'
    | 'EXPENSE'
    | 'GENERAL'
  normalBalance: 'DEBIT' | 'CREDIT'
}) {
  return prisma.account.upsert({
    where: {
      legalEntityId_accountCode: {
        legalEntityId: args.legalEntityId,
        accountCode: args.accountCode,
      },
    },
    create: {
      ...args,
      isGroup: false,
      isActive: true,
      allowManualPosting: true,
    },
    update: {
      accountName: args.accountName,
      category: args.category,
      accountType: args.accountType,
      normalBalance: args.normalBalance,
      isGroup: false,
      isActive: true,
    },
  })
}

async function upsertMapping(args: {
  tenantId: string
  legalEntityId: string
  mappingKey:
    | 'PURCHASE'
    | 'PURCHASE_RETURN'
    | 'VENDOR_PAYABLE'
    | 'RAW_MATERIAL_INVENTORY'
    | 'FINISHED_GOODS_INVENTORY'
    | 'COST_OF_GOODS_SOLD'
    | 'GRIR_CLEARING'
    | 'PURCHASE_PRICE_VARIANCE'
  accountId: string
}) {
  return prisma.defaultAccountMapping.upsert({
    where: {
      legalEntityId_mappingKey: {
        legalEntityId: args.legalEntityId,
        mappingKey: args.mappingKey,
      },
    },
    create: { ...args, isMandatory: false },
    update: { accountId: args.accountId },
  })
}

async function bootstrapFinance(tenantId: string, legalEntityId: string) {
  const purchase = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '5100',
    accountName: 'Purchases',
    category: 'EXPENSE',
    accountType: 'PURCHASE',
    normalBalance: 'DEBIT',
  })
  const purchaseReturn = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '5101',
    accountName: 'Purchase Returns',
    category: 'EXPENSE',
    accountType: 'PURCHASE_RETURN',
    normalBalance: 'CREDIT',
  })
  const payable = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '2100',
    accountName: 'Trade Payables',
    category: 'LIABILITY',
    accountType: 'VENDOR_PAYABLE',
    normalBalance: 'CREDIT',
  })
  const rawMaterial = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '1301',
    accountName: 'Raw Material Inventory',
    category: 'ASSET',
    accountType: 'RAW_MATERIAL_INVENTORY',
    normalBalance: 'DEBIT',
  })
  const finishedGoods = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '1303',
    accountName: 'Finished Goods Inventory',
    category: 'ASSET',
    accountType: 'FINISHED_GOODS_INVENTORY',
    normalBalance: 'DEBIT',
  })
  const cogs = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '5600',
    accountName: 'Cost of Goods Sold',
    category: 'EXPENSE',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
  })
  const grir = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '2110',
    accountName: 'GR/IR Clearing',
    category: 'LIABILITY',
    accountType: 'GENERAL',
    normalBalance: 'CREDIT',
  })
  const ppv = await ensureAccount({
    tenantId,
    legalEntityId,
    accountCode: '5510',
    accountName: 'Purchase Price Variance',
    category: 'EXPENSE',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
  })

  await Promise.all([
    upsertMapping({ tenantId, legalEntityId, mappingKey: 'PURCHASE', accountId: purchase.id }),
    upsertMapping({
      tenantId,
      legalEntityId,
      mappingKey: 'PURCHASE_RETURN',
      accountId: purchaseReturn.id,
    }),
    upsertMapping({
      tenantId,
      legalEntityId,
      mappingKey: 'VENDOR_PAYABLE',
      accountId: payable.id,
    }),
    upsertMapping({
      tenantId,
      legalEntityId,
      mappingKey: 'RAW_MATERIAL_INVENTORY',
      accountId: rawMaterial.id,
    }),
    upsertMapping({
      tenantId,
      legalEntityId,
      mappingKey: 'FINISHED_GOODS_INVENTORY',
      accountId: finishedGoods.id,
    }),
    upsertMapping({
      tenantId,
      legalEntityId,
      mappingKey: 'COST_OF_GOODS_SOLD',
      accountId: cogs.id,
    }),
    upsertMapping({ tenantId, legalEntityId, mappingKey: 'GRIR_CLEARING', accountId: grir.id }),
    upsertMapping({
      tenantId,
      legalEntityId,
      mappingKey: 'PURCHASE_PRICE_VARIANCE',
      accountId: ppv.id,
    }),
  ])

  await prisma.financeNumberSeries.upsert({
    where: {
      legalEntityId_documentType: {
        legalEntityId,
        documentType: 'JOURNAL',
      },
    },
    create: {
      tenantId,
      legalEntityId,
      documentType: 'JOURNAL',
      prefix: 'JV-',
      padLength: 6,
      isActive: true,
    },
    update: { isActive: true },
  })
  await prisma.financeNumberSeries.upsert({
    where: {
      legalEntityId_documentType: {
        legalEntityId,
        documentType: 'VENDOR_INVOICE',
      },
    },
    create: {
      tenantId,
      legalEntityId,
      documentType: 'VENDOR_INVOICE',
      prefix: 'VIN-',
      padLength: 6,
      isActive: true,
    },
    update: { isActive: true },
  })

  await prisma.financeFeatureControl.upsert({
    where: {
      legalEntityId_featureKey: {
        legalEntityId,
        featureKey: 'INVENTORY_ACCOUNTING',
      },
    },
    create: {
      tenantId,
      legalEntityId,
      featureKey: 'INVENTORY_ACCOUNTING',
      isEnabled: true,
    },
    update: { isEnabled: true },
  })

  return { purchase, purchaseReturn, payable, rawMaterial, grir, ppv }
}

async function main() {
  await ensurePermissions()
  const maker = await createTenantUser({
    app,
    slugPrefix: 'fin-close-1',
    permissionNames: [...PERMISSIONS],
  })
  const approver = await createTenantUser({
    app,
    slugPrefix: 'fin-close-1-appr',
    permissionNames: [...PERMISSIONS],
    tenantId: maker.tenantId,
  })
  const auth = { Authorization: `Bearer ${maker.token}` }
  const approverAuth = { Authorization: `Bearer ${approver.token}` }

  const masters = await seedPurchaseMasters(maker.tenantId)
  const legalEntityId = await ensureLegalEntity(maker.tenantId)
  await Promise.all([
    prisma.legalEntity.update({
      where: { id: legalEntityId },
      data: { stateCode: '27', gstin: '27AAAAA0000A1Z5' },
    }),
    prisma.masterVendor.update({
      where: { id: masters.vendorId },
      data: {
        state: '27',
        gstin: '27BBBBB0000B1Z5',
        pan: 'BBBBB0000B',
      },
    }),
  ])
  const accounts = await bootstrapFinance(maker.tenantId, legalEntityId)

  const po = await createSentPo(app, {
    slug: maker.slug,
    token: maker.token,
    approverToken: approver.token,
    vendorId: masters.vendorId,
    uomId: masters.uomId,
    warehouseId: masters.warehouseId,
    qty: 10,
    itemId: masters.itemId,
    itemCode: masters.itemCode,
  })
  const grn = await createSubmittedGrn(app, {
    slug: maker.slug,
    token: maker.token,
    poId: po.poId,
    poLineId: po.poLineId,
    vendorId: masters.vendorId,
    warehouseId: masters.warehouseId,
    locationId: masters.locationId,
    binId: masters.binId,
    receivedQuantity: 10,
    inspectionRequired: false,
  })

  if (grn.status !== 'INVENTORY_POSTED') {
    const postInventory = await request(app)
      .post(`/api/v1/t/${maker.slug}/purchase/grns/${grn.grnId}/post-inventory`)
      .set(auth)
      .send({})
    assert(postInventory.status === 200, 'GRN inventory posting failed', postInventory.body)
  }

  const grnEvent = await prisma.inventoryAccountingEvent.findFirst({
    where: {
      tenantId: maker.tenantId,
      sourceDocumentId: grn.grnId,
      eventType: 'GRN_INWARD',
    },
    orderBy: { createdAt: 'desc' },
  })
  assert(grnEvent?.status === 'POSTED', 'GRN accounting event did not post', grnEvent)
  assert(grnEvent.voucherId, 'GRN accounting voucher missing', grnEvent)

  const grnLedger = await prisma.generalLedgerEntry.findMany({
    where: { tenantId: maker.tenantId, voucherId: grnEvent.voucherId },
    select: { accountId: true, debitAmount: true, creditAmount: true },
  })
  const grnGrirCredit = grnLedger
    .filter((line) => line.accountId === accounts.grir.id)
    .reduce((sum, line) => sum + Number(line.creditAmount) - Number(line.debitAmount), 0)
  assert(grnGrirCredit === 1000, 'GRN did not credit GR/IR by receipt value', grnLedger)

  const invoiceBase = `/api/v1/t/${maker.slug}/purchase/invoices`
  const purchaseInvoice = await request(app)
    .post(invoiceBase)
    .set(auth)
    .send({
      vendorId: masters.vendorId,
      purchaseOrderId: po.poId,
      goodsReceiptId: grn.grnId,
      vendorInvoiceNumber: `SUP-FC1-${runStamp}`,
      lines: [
        {
          purchaseOrderLineId: po.poLineId,
          goodsReceiptLineId: grn.grnLineId,
          quantity: 10,
          rate: 110,
          taxRatePct: 0,
        },
      ],
    })
  assert(purchaseInvoice.status === 201, 'Purchase invoice create failed', purchaseInvoice.body)
  const purchaseInvoiceId = purchaseInvoice.body.data.id as string

  const submitted = await request(app)
    .post(`${invoiceBase}/${purchaseInvoiceId}/submit`)
    .set(auth)
    .send({
      overrideAuthorized: true,
      overrideRemarks: 'FIN-CLOSE-1 intentional ₹10/unit PPV test',
    })
  assert(submitted.status === 200, 'Purchase invoice submit failed', submitted.body)
  const approved = await request(app)
    .post(`${invoiceBase}/${purchaseInvoiceId}/approve`)
    .set(approverAuth)
    .send({})
  assert(approved.status === 200, 'Purchase invoice approve failed', approved.body)
  const postedPurchaseInvoice = await request(app)
    .post(`${invoiceBase}/${purchaseInvoiceId}/post`)
    .set(auth)
    .send({})
  assert(
    postedPurchaseInvoice.status === 200,
    'Purchase invoice post / AP handoff failed',
    postedPurchaseInvoice.body,
  )

  const vendorInvoiceId =
    (postedPurchaseInvoice.body.data.apHandoff?.vendorInvoiceId as string | undefined) ??
    (postedPurchaseInvoice.body.data.vendorInvoiceId as string | undefined)
  assert(vendorInvoiceId, 'AP Vendor Invoice draft was not created', postedPurchaseInvoice.body)

  const viBase = `/api/v1/t/${maker.slug}/accounting/payables/vendor-invoices`
  const viDetail = await request(app).get(`${viBase}/${vendorInvoiceId}`).set(auth)
  assert(viDetail.status === 200, 'Vendor Invoice detail failed', viDetail.body)
  const ready = await request(app)
    .post(`${viBase}/${vendorInvoiceId}/mark-ready`)
    .set(auth)
    .send({ expectedUpdatedAt: viDetail.body.data.updatedAt })
  assert(ready.status === 200, 'Vendor Invoice mark-ready failed', ready.body)
  const viPost = await request(app)
    .post(`${viBase}/${vendorInvoiceId}/post`)
    .set(auth)
    .send({ expectedUpdatedAt: ready.body.data.updatedAt })
  assert(viPost.status === 200, 'Vendor Invoice GL post failed', viPost.body)

  const viLedger = await prisma.generalLedgerEntry.findMany({
    where: {
      tenantId: maker.tenantId,
      voucherId: viPost.body.data.accountingVoucherId as string,
    },
    select: { accountId: true, debitAmount: true, creditAmount: true },
  })
  const invoiceGrirDebit = viLedger
    .filter((line) => line.accountId === accounts.grir.id)
    .reduce((sum, line) => sum + Number(line.debitAmount) - Number(line.creditAmount), 0)
  const ppvDebit = viLedger
    .filter((line) => line.accountId === accounts.ppv.id)
    .reduce((sum, line) => sum + Number(line.debitAmount) - Number(line.creditAmount), 0)
  assert(invoiceGrirDebit === 1000, 'Vendor Invoice did not release GR/IR at receipt cost', viLedger)
  assert(ppvDebit === 100, 'Vendor Invoice did not debit PPV by invoice-receipt difference', viLedger)

  const grirBalance = await prisma.generalLedgerEntry.aggregate({
    where: {
      tenantId: maker.tenantId,
      legalEntityId,
      accountId: accounts.grir.id,
    },
    _sum: { debitAmount: true, creditAmount: true },
  })
  const grirNet =
    Number(grirBalance._sum.debitAmount ?? 0) - Number(grirBalance._sum.creditAmount ?? 0)
  assert(grirNet === 0, 'GR/IR did not net to zero', grirBalance)

  const returnBase = `/api/v1/t/${maker.slug}/purchase/returns`
  const purchaseReturn = await request(app)
    .post(returnBase)
    .set(auth)
    .send({
      vendorId: masters.vendorId,
      purchaseOrderId: po.poId,
      goodsReceiptId: grn.grnId,
      warehouseId: masters.warehouseId,
      reason: 'FIN-CLOSE-1 return after invoice',
      lines: [
        {
          goodsReceiptLineId: grn.grnLineId,
          purchaseOrderLineId: po.poLineId,
          returnQuantity: 2,
        },
      ],
    })
  assert(purchaseReturn.status === 201, 'Purchase Return create failed', purchaseReturn.body)
  const returnId = purchaseReturn.body.data.id as string
  const returnSubmit = await request(app)
    .post(`${returnBase}/${returnId}/submit`)
    .set(auth)
    .send({})
  assert(returnSubmit.status === 200, 'Purchase Return submit failed', returnSubmit.body)
  const returnApprove = await request(app)
    .post(`${returnBase}/${returnId}/approve`)
    .set(approverAuth)
    .send({})
  assert(returnApprove.status === 200, 'Purchase Return approve failed', returnApprove.body)
  const returnComplete = await request(app)
    .post(`${returnBase}/${returnId}/complete`)
    .set(auth)
    .send({ remarks: 'Return after invoicing — create AP debit note' })
  assert(returnComplete.status === 200, 'Purchase Return complete failed', returnComplete.body)

  const returnRow = await prisma.purchaseReturn.findFirstOrThrow({
    where: { id: returnId, tenantId: maker.tenantId },
  })
  assert(returnRow.vendorAdjustmentId, 'Purchase Return AP adjustment link missing', returnRow)
  const adjustment = await prisma.vendorAdjustment.findFirst({
    where: { id: returnRow.vendorAdjustmentId, tenantId: maker.tenantId },
    include: { sourceLinks: true, lines: true },
  })
  assert(adjustment, 'Vendor Debit Note draft missing')
  assert(
    adjustment.adjustmentType === 'VENDOR_DEBIT_NOTE',
    'Wrong AP adjustment document type',
    adjustment,
  )
  assert(adjustment.status === 'DRAFT', 'AP adjustment must remain a draft', adjustment)
  assert(
    adjustment.sourceLinks.some(
      (link) => link.sourceType === 'PURCHASE_RETURN' && link.sourceDocumentId === returnId,
    ),
    'Vendor Debit Note lacks Purchase Return source link',
    adjustment.sourceLinks,
  )
  assert(
    Number(adjustment.adjustmentGrandTotal) === 220,
    'Debit note value must use invoiced rate',
    {
    expected: 220,
      actual: adjustment.adjustmentGrandTotal,
    },
  )

  console.log('\nFIN-CLOSE-1 LIVE MYSQL ROUND TRIP — PASS')
  console.log(`Tenant: ${maker.slug} (${maker.tenantId})`)
  console.log(`Legal entity: ${legalEntityId}`)
  console.log(`PO: ${po.poId}`)
  console.log(`GRN: ${grn.grnId} — GR/IR credit ₹${grnGrirCredit.toFixed(2)}`)
  console.log(`Purchase Invoice: ${purchaseInvoiceId}`)
  console.log(
    `Vendor Invoice: ${vendorInvoiceId} — GR/IR debit ₹${invoiceGrirDebit.toFixed(2)}, PPV debit ₹${ppvDebit.toFixed(2)}`,
  )
  console.log(`GR/IR net: ₹${grirNet.toFixed(2)}`)
  console.log(
    `Purchase Return: ${returnId} → Vendor Debit Note ${adjustment.draftReference} (${adjustment.id}) ₹${Number(adjustment.adjustmentGrandTotal).toFixed(2)}`,
  )
}

main()
  .catch((error) => {
    console.error('\nFIN-CLOSE-1 LIVE MYSQL ROUND TRIP — FAIL')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
