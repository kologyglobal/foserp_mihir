import {
  approveInvoiceMatchingException,
  approvePurchaseInvoice,
  computeInvoiceMatching,
  createDebitNoteFromInvoice,
  createDirectPurchaseInvoice,
  createPurchaseInvoice,
  createPurchaseInvoiceFromGrn,
  createPurchaseInvoiceFromPo,
  getPurchaseInvoiceById,
  getPurchaseInvoiceList,
  holdPurchaseInvoice,
  postPurchaseInvoice,
  PurchaseServiceError,
  resetPurchaseMockData,
  submitPurchaseInvoiceForApproval,
  verifyPurchaseInvoice,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const list = await getPurchaseInvoiceList()
  console.log(
    'list',
    list.map((r) => ({
      no: r.documentNumber,
      status: r.status,
      match: r.matchingResultStatus,
      total: r.totalAmount,
    })),
  )

  const fromGrn = await createPurchaseInvoiceFromGrn('prd-grn-6001')
  console.log('from GRN', fromGrn.documentNumber, fromGrn.origin, fromGrn.goodsReceiptNumber)

  // finish vendor fields then verify
  const { updatePurchaseInvoice } = await import('../src/services/purchase/purchaseService')
  await updatePurchaseInvoice(fromGrn.id, {
    vendorId: fromGrn.vendor.id,
    vendorInvoiceNumber: `SMOKE-${Date.now()}`,
    vendorInvoiceDate: fromGrn.vendorInvoiceDate,
    origin: fromGrn.origin,
    purchaseOrderId: fromGrn.purchaseOrderId,
    goodsReceiptId: fromGrn.goodsReceiptId,
    lines: fromGrn.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      rate: l.rate,
      purchaseOrderLineId: l.purchaseOrderLineId,
      goodsReceiptLineId: l.goodsReceiptLineId,
    })),
  })
  const verified = await verifyPurchaseInvoice(fromGrn.id)
  console.log('verified', verified.status, verified.matchingResultStatus)

  const fromPo = await createPurchaseInvoiceFromPo('prd-po-5001')
  console.log('from PO', fromPo.documentNumber, fromPo.origin)

  const direct = await createDirectPurchaseInvoice({
    vendorId: 'pv-skf',
    vendorInvoiceNumber: `DIR-${Date.now()}`,
    vendorInvoiceDate: new Date().toISOString().slice(0, 10),
    lines: [{ itemId: 'pi-cmp-bearing', quantity: 2, rate: 1800 }],
  })
  console.log('direct', direct.documentNumber, direct.origin)

  // Mismatch seed — posting without exception should fail
  try {
    await postPurchaseInvoice('prd-inv-7002')
    console.error('FAIL: expected MATCH_EXCEPTION_REQUIRED')
    process.exit(1)
  } catch (err) {
    console.log(
      'post blocked',
      err instanceof PurchaseServiceError ? err.code : err instanceof Error ? err.message : err,
    )
  }

  await approveInvoiceMatchingException('prd-inv-7002', 'Smoke override')
  const approved = await approvePurchaseInvoice('prd-inv-7002')
  const posted = await postPurchaseInvoice(approved.id)
  console.log('posted with exception', posted.status, posted.postedAt)

  const matching = await computeInvoiceMatching('prd-inv-7001')
  console.log('matching 7001', matching.overallStatus, 'exceeds=', matching.exceedsTolerance)

  const verifiedAgain = await verifyPurchaseInvoice(verified.id)
  await submitPurchaseInvoiceForApproval(verifiedAgain.id)
  await holdPurchaseInvoice(verifiedAgain.id, 'Waiting vendor credit note')
  const held = await getPurchaseInvoiceById(verifiedAgain.id)
  console.log('held', held?.status)

  const dn = await createDebitNoteFromInvoice('prd-inv-7001', 'Short received qty')
  console.log('debit note', dn.debitNoteNumber)

  // duplicate detection
  const dupInv = await createPurchaseInvoice({
    vendorId: 'pv-tata-steel',
    vendorInvoiceNumber: 'TS/2526/88421',
    vendorInvoiceDate: '2026-07-05',
    purchaseOrderId: 'prd-po-5001',
    goodsReceiptId: 'prd-grn-6001',
    lines: [{ itemId: 'pi-rm-hr-plate', quantity: 10, rate: 61.5 }],
  })
  console.log('duplicate flag', dupInv.matchingResultStatus)

  console.log('ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
