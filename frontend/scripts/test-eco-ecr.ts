/**
 * ECO/ECR engineering change tests — npm run test:eco-ecr
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { useEcoStore } = await import('../src/store/ecoStore')
const { useApprovalStore } = await import('../src/store/approvalStore')
const { useBomStore } = await import('../src/store/bomStore')

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function reset() {
  useEcoStore.setState({ ecrs: [], ecos: [] })
  useApprovalStore.getState().resetRulesToDefault()
  useApprovalStore.setState({ requests: [] })
  resetSessionUserForTests()
  setSessionUserForTests({ role: 'engineering', name: 'Eng Head' })
}

console.log('\nECO/ECR Tests\n')
reset()

const bom = useBomStore.getState().bomHeaders.find((b) => b.status === 'released') ?? useBomStore.getState().bomHeaders[0]

const created = useEcoStore.getState().createEcr({
  changeType: 'bom',
  productId: bom?.productId ?? null,
  bomId: bom?.id ?? null,
  reason: 'Update shell plate thickness per customer spec',
  priority: 'high',
})
check(1, 'Create ECR', created.ok, created.ecrId)

const ecrId = created.ecrId!
check(2, 'Submit ECR', useEcoStore.getState().submitEcr(ecrId).ok)
check(3, 'Start engineering review', useEcoStore.getState().startEngineeringReview(ecrId).ok)
check(4, 'Complete impact analysis', useEcoStore.getState().completeImpactAnalysis(ecrId).ok)

const ecoResult = useEcoStore.getState().approveEcrForEco(ecrId)
check(5, 'Approve ECR for ECO', ecoResult.ok, ecoResult.ecoId)

const ecoId = ecoResult.ecoId!
const impact = useEcoStore.getState().computeImpactAnalysis(ecrId)
check(6, 'Impact analysis returns open WO list', Array.isArray(impact.openWorkOrders))

check(7, 'Submit ECO for approval', useEcoStore.getState().submitEcoForApproval(ecoId).ok)

setSessionUserForTests({ role: 'admin', name: 'Director' })
check(8, 'Approve ECO via matrix', useEcoStore.getState().approveEco(ecoId).ok)
check(9, 'Release ECO', useEcoStore.getState().releaseEco(ecoId).ok)
check(10, 'Implement ECO', useEcoStore.getState().implementEco(ecoId).ok)

const eco = useEcoStore.getState().getEco(ecoId)
check(11, 'ECO status implemented', eco?.approvalStatus === 'implemented')

if (bom) {
  check(12, 'Released BOM requires ECO for edit', useEcoStore.getState().requiresEcoForBomEdit(bom.id))
}

console.log(`\nECO/ECR: ${passed}/${passed + failed} passed${failed ? `, ${failed} failed` : ''}`)
if (failed > 0) process.exit(1)
