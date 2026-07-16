import {
  getPurchaseApprovalQueue,
  getPurchaseSetup,
  resetPurchaseMockData,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const setup = await getPurchaseSetup()
  const pending = await getPurchaseApprovalQueue('pending_mine')
  const approvedByMe = await getPurchaseApprovalQueue('approved_by_me')
  const rejectedByMe = await getPurchaseApprovalQueue('rejected_by_me')
  const all = await getPurchaseApprovalQueue('all_history')
  console.log(
    JSON.stringify(
      {
        tiers: setup.approvalMatrix.map((t) => ({ label: t.label, roles: t.requiredRoles })),
        pending: pending.map((p) => ({
          no: p.documentNumber,
          level: p.approvalLevelLabel,
          canAct: p.canAct,
          type: p.documentType,
        })),
        approvedByMe: approvedByMe.length,
        rejectedByMe: rejectedByMe.length,
        all: all.length,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
