import {
  acceptQualityInspection,
  createGRNFromPo,
  getGrnList,
  getGRNById,
  getQualityInspectionById,
  getQualityInspectionList,
  postGRN,
  PurchaseServiceError,
  resetPurchaseMockData,
  submitGRN,
  updateGRN,
} from '../src/services/purchase/purchaseService'

async function expectError(code: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    console.error(`FAIL: expected ${code}`)
    process.exit(1)
  } catch (err) {
    if (err instanceof PurchaseServiceError && err.code === code) {
      console.log('blocked', code, err.message)
      return
    }
    console.error('FAIL: unexpected error', err)
    process.exit(1)
  }
}

async function main() {
  await resetPurchaseMockData()

  const list = await getGrnList()
  console.log(
    'grn list',
    list.map((r) => ({ no: r.documentNumber, status: r.status, po: r.purchaseOrderNumber })),
  )

  const qiList = await getQualityInspectionList()
  console.log(
    'qi list',
    qiList.map((r) => ({ no: r.documentNumber, status: r.status, grn: r.goodsReceiptNumber })),
  )

  // Draft / cancelled PO cannot receive
  await expectError('PO_NOT_RECEIVABLE', () =>
    createGRNFromPo({
      purchaseOrderId: 'prd-po-5003',
      warehouseId: 'loc-chakan-rm',
      warehouseName: 'Chakan RM Stores',
      lines: [{ purchaseOrderLineId: 'prd-po-5003-l1', receivedQty: 1 }],
    }),
  )

  // Create draft GRN from released PO-5002 (pending qty open; seed may already have draft GRN-6002)
  const created = await createGRNFromPo({
    purchaseOrderId: 'prd-po-5001',
    documentDate: '2026-07-15',
    vendorChallanNumber: 'TS-SMOKE-1',
    vendorChallanDate: '2026-07-15',
    gateEntryNo: 'GE-SMOKE-1',
    vehicleNo: 'MH-12-TEST-1',
    transporterName: 'Smoke Freight',
    lrNumber: 'LR-SMOKE-1',
    warehouseId: 'loc-chakan-rm',
    warehouseName: 'Chakan RM Stores',
    receivingLocation: 'Dock-A',
    inspectionRequired: true,
    lines: [
      {
        purchaseOrderLineId: 'prd-po-5001-l1',
        receivedQty: 500,
        batchNumber: 'TS-SMOKE-BATCH',
        lotNumber: 'L1',
        warehouseId: 'loc-chakan-rm',
        warehouseName: 'Chakan RM Stores',
        bin: 'RM-A-99',
      },
    ],
  })
  console.log('created draft', created.documentNumber, created.status, created.lines[0]?.batchNumber)

  // Excess without permission
  await expectError('EXCESS_QTY_REQUIRES_PERMISSION', () =>
    updateGRN(created.id, {
      allowExcess: false,
      lines: [
        {
          purchaseOrderLineId: 'prd-po-5001-l1',
          receivedQty: 99999,
          batchNumber: 'TS-SMOKE-BATCH',
          warehouseId: 'loc-chakan-rm',
          warehouseName: 'Chakan RM Stores',
        },
      ],
    }),
  )

  // Batch required
  await expectError('BATCH_REQUIRED', () =>
    updateGRN(created.id, {
      lines: [
        {
          purchaseOrderLineId: 'prd-po-5001-l1',
          receivedQty: 100,
          batchNumber: '',
          warehouseId: 'loc-chakan-rm',
          warehouseName: 'Chakan RM Stores',
        },
      ],
    }),
  )

  const submitted = await submitGRN(created.id)
  console.log(
    'submitted',
    submitted.documentNumber,
    submitted.status,
    'qi',
    submitted.qualityInspectionId,
  )

  // Post blocked while inspection pending
  await expectError('INSPECTION_INCOMPLETE', () => postGRN(submitted.id))

  if (!submitted.qualityInspectionId) {
    console.error('FAIL: expected QI after submit')
    process.exit(1)
  }
  const qi = await getQualityInspectionById(submitted.qualityInspectionId)
  if (!qi) {
    console.error('FAIL: QI missing')
    process.exit(1)
  }
  console.log('qi pending', qi.documentNumber, qi.status, qi.receivedQty)

  const accepted = await acceptQualityInspection(qi.id, qi.receivedQty, 0)
  console.log('qi accepted', accepted.status, accepted.result, accepted.acceptedQty)

  const grnReady = await getGRNById(submitted.id)
  console.log('grn after qi', grnReady?.status, grnReady?.lines[0]?.acceptedQty)

  const posted = await postGRN(submitted.id)
  console.log(
    'posted',
    posted.documentNumber,
    posted.status,
    'inventoryDeferred',
    posted.inventoryPostDeferred,
  )
  if (!posted.inventoryPostDeferred) {
    console.error('FAIL: expected inventoryPostDeferred')
    process.exit(1)
  }

  console.log('OK smoke-purchase-grn-qi')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
