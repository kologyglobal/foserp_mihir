import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  createPurchaseOrderFromBlanket,
  createPurchaseOrderFromPr,
  createPurchaseOrderFromVendorQuotation,
  getPurchaseOrderById,
  getPurchaseOrderList,
  releasePurchaseOrder,
  resetPurchaseMockData,
  revisePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const list = await getPurchaseOrderList()
  console.log(
    'list',
    list.map((r) => ({
      no: r.documentNumber,
      status: r.status,
      approval: r.approvalStatus,
      recv: r.receivedPercentage,
      total: r.totalAmount,
    })),
  )

  const fromPr = await createPurchaseOrderFromPr('prd-pr-1004', 'pv-pack-india')
  console.log('from PR', fromPr.documentNumber, fromPr.origin, fromPr.status)

  const fromVq = await createPurchaseOrderFromVendorQuotation('prd-vq-4001')
  console.log('from VQ', fromVq.documentNumber, fromVq.origin, fromVq.vendorQuotationNumber)

  const fromBlo = await createPurchaseOrderFromBlanket('prd-blo-9001', [
    { itemId: 'pi-con-mig-wire', quantity: 2 },
  ])
  console.log('from BLO', fromBlo.documentNumber, fromBlo.origin, fromBlo.orderType)

  const manual = await createPurchaseOrder({
    vendorId: 'pv-skf',
    origin: 'manual',
    paymentTerms: 'Net 60',
    lines: [{ itemId: 'pi-cmp-bearing', quantity: 10, rate: 1800 }],
  })
  console.log('manual', manual.documentNumber, manual.totalAmount)

  await updatePurchaseOrder(manual.id, {
    vendorId: 'pv-skf',
    freight: 500,
    packingCharges: 100,
    lines: [{ itemId: 'pi-cmp-bearing', quantity: 10, rate: 1800 }],
  })

  // Released PO cannot be updated directly
  try {
    await updatePurchaseOrder('prd-po-5002', {
      vendorId: 'pv-apollo',
      lines: [{ itemId: 'pi-rm-erw-pipe', quantity: 200, rate: 420 }],
    })
    console.error('FAIL: expected PO_NOT_EDITABLE')
    process.exit(1)
  } catch (err) {
    console.log('edit blocked', err instanceof Error ? err.message : err)
  }

  const revised = await revisePurchaseOrder('prd-po-5002', {
    reason: 'Market rate revision',
    lines: [{ id: 'prd-po-5002-l1', itemId: 'pi-rm-erw-pipe', quantity: 200, rate: 410 }],
    expectedDeliveryDate: '2026-07-16',
  })
  console.log(
    'revised',
    revised.revisionNo,
    revised.changeHistory.slice(0, 3).map((c) => ({
      field: c.fieldLabel,
      from: c.previousValue,
      to: c.newValue,
    })),
  )

  const pending = await getPurchaseOrderById('prd-po-5003')
  if (pending?.status === 'pending_approval') {
    await approvePurchaseOrder(pending.id, 'OK')
    const released = await releasePurchaseOrder(pending.id)
    console.log('approve+release', released.status, released.releasedAt)
  }

  const draft = await createPurchaseOrder({
    vendorId: 'pv-local-fasteners',
    lines: [{ itemId: 'pi-con-disc', quantity: 20, rate: 85 }],
  })
  await submitPurchaseOrder(draft.id)
  await cancelPurchaseOrder(draft.id, 'Duplicate')
  const cancelled = await getPurchaseOrderById(draft.id)
  console.log('cancelled', cancelled?.status)

  console.log('ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
