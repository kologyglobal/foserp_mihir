import {
  getRfqList,
  getRFQById,
  resetPurchaseMockData,
  sendRFQ,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const list = await getRfqList()
  console.log(
    JSON.stringify(
      {
        list: list.map((r) => ({
          no: r.documentNumber,
          status: r.status,
          vendors: r.vendorCount,
          items: r.itemCount,
          value: r.estimatedValue,
          responses: r.responsesReceived,
        })),
      },
      null,
      2,
    ),
  )
  const draft = list.find((r) => r.status === 'draft')
  if (draft) {
    const before = await getRFQById(draft.id)
    console.log('draft vendors', before?.vendors.map((v) => ({ name: v.vendorName, status: v.status })))
    const sent = await sendRFQ(draft.id)
    console.log('after send', sent.status, sent.vendors.map((v) => v.status))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
