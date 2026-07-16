import {
  approvePurchaseReturn,
  cancelPurchaseReturn,
  createDebitNoteFromReturn,
  createPurchaseReturnFromGrn,
  createPurchaseReturnFromQualityInspection,
  createReplacementPoFromReturn,
  getPurchaseReturnById,
  getPurchaseReturnList,
  postPurchaseReturn,
  resetPurchaseMockData,
  submitPurchaseReturn,
  updatePurchaseReturn,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const list = await getPurchaseReturnList()
  console.log(
    'list',
    list.map((r) => ({
      no: r.documentNumber,
      status: r.status,
      origin: r.origin,
      reason: r.returnReason,
      amount: r.totalAmount,
      dn: r.linkedDebitNoteNumber,
    })),
  )

  if (!list.some((r) => r.status === 'posted')) {
    console.error('FAIL: expected seeded posted return')
    process.exit(1)
  }
  if (!list.some((r) => r.status === 'draft')) {
    console.error('FAIL: expected seeded draft return')
    process.exit(1)
  }

  // Seeded posted return uses 10 of 50 rejected kg → 40 available.
  const fromQi = await createPurchaseReturnFromQualityInspection('prd-qi-6101')
  console.log('from QI', fromQi.documentNumber, fromQi.qualityInspectionNumber, fromQi.lines[0]?.returnQty)

  // Cap QI draft at 15 kg so GRN create still has remainder.
  await updatePurchaseReturn(fromQi.id, {
    vendorId: fromQi.vendor.id,
    origin: fromQi.origin,
    goodsReceiptId: fromQi.goodsReceiptId,
    purchaseOrderId: fromQi.purchaseOrderId,
    qualityInspectionId: fromQi.qualityInspectionId,
    returnReason: 'quality_rejection',
    debitNoteRequired: true,
    lines: fromQi.lines.map((l) => ({
      itemId: l.itemId,
      returnQty: 15,
      unitCost: l.unitCost,
      goodsReceiptLineId: l.goodsReceiptLineId,
      description: l.description,
      batchLotNo: l.batchLotNo,
      serialNumber: l.serialNumber,
      receivedQty: l.receivedQty,
      availableReturnQty: l.availableReturnQty,
      reason: 'quality_rejection',
      replacementQty: 0,
      remarks: l.remarks,
    })),
  })

  const fromGrn = await createPurchaseReturnFromGrn('prd-grn-6001', {
    origin: 'grn_rejected_quantity',
  })
  console.log('from GRN', fromGrn.documentNumber, fromGrn.origin, fromGrn.lines[0]?.returnQty)

  await updatePurchaseReturn(fromGrn.id, {
    vendorId: fromGrn.vendor.id,
    origin: fromGrn.origin,
    goodsReceiptId: fromGrn.goodsReceiptId,
    purchaseOrderId: fromGrn.purchaseOrderId,
    returnReason: 'damaged',
    transportDetails: 'Vendor pickup MH test',
    debitNoteRequired: true,
    replacementRequired: true,
    remarks: 'Smoke update',
    lines: fromGrn.lines.map((l) => ({
      itemId: l.itemId,
      returnQty: Math.min(l.returnQty, 10),
      unitCost: l.unitCost,
      goodsReceiptLineId: l.goodsReceiptLineId,
      description: l.description,
      batchLotNo: l.batchLotNo,
      serialNumber: l.serialNumber,
      receivedQty: l.receivedQty,
      availableReturnQty: l.availableReturnQty,
      reason: 'damaged',
      replacementQty: Math.min(l.returnQty, 10),
      remarks: l.remarks,
    })),
  })

  await submitPurchaseReturn(fromGrn.id)
  await approvePurchaseReturn(fromGrn.id, 'OK for smoke')
  const posted = await postPurchaseReturn(fromGrn.id)
  console.log('posted', posted.status, posted.postedAt)

  const withDn = await createDebitNoteFromReturn(fromGrn.id)
  console.log('debit note', withDn.linkedDebitNoteNumber)

  const withPo = await createReplacementPoFromReturn(fromGrn.id)
  console.log('replacement PO', withPo.linkedReplacementPoNumber)

  await submitPurchaseReturn(fromQi.id)
  await cancelPurchaseReturn(fromQi.id, 'Smoke cancel')
  const cancelled = await getPurchaseReturnById(fromQi.id)
  console.log('cancelled', cancelled?.status)

  const draftOnly = await getPurchaseReturnById('prd-ret-8002')
  try {
    await postPurchaseReturn(draftOnly!.id)
    console.error('FAIL: expected RETURN_INVALID_STATUS for draft post')
    process.exit(1)
  } catch (err) {
    console.log('post blocked', err instanceof Error ? err.message : err)
  }

  console.log('ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
