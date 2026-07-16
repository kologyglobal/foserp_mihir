import { useEcoStore } from '../../store/ecoStore'
import { useMasterStore } from '../../store/masterStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Top up ECR/ECO records with linked products */
export function seedDemoEngineering(): void {
  const ecoStore = useEcoStore.getState()
  const products = useMasterStore.getState().products

  while (useEcoStore.getState().ecrs.length < SATURATION_TARGETS.ecrs) {
    const n = useEcoStore.getState().ecrs.length + 1
    const p = products[n % products.length]
    ecoStore.createEcr({
      changeType: n % 3 === 0 ? 'routing' : 'bom',
      productId: p?.id ?? null,
      bomId: p?.manufacturing.releasedBomHeaderId ?? null,
      reason: `Saturation ECR ${n} — ${p?.productName ?? 'product'} revision`,
      priority: n % 4 === 0 ? 'high' : 'medium',
    })
  }

  for (const ecr of [...useEcoStore.getState().ecrs]) {
    if (useEcoStore.getState().ecos.length >= SATURATION_TARGETS.ecos) break
    if (ecr.status === 'draft') {
      ecoStore.submitEcr(ecr.id)
      ecoStore.startEngineeringReview(ecr.id)
      ecoStore.completeImpactAnalysis(ecr.id)
    }
    if (!useEcoStore.getState().ecos.some((e) => e.ecrId === ecr.id) && ecr.status === 'impact_analysis') {
      ecoStore.approveEcrForEco(ecr.id)
    }
  }
}
