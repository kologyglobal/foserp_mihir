import { useBomStore } from '../../store/bomStore'
import { useMasterStore } from '../../store/masterStore'
import { ensureDemoBomRoutingForProducts } from '../demoBomRoutingClone'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Ensure every product has a released BOM clone — target 25 headers */
export function seedDemoBoms(): void {
  const productIds = useMasterStore.getState().products.map((p) => p.id)
  ensureDemoBomRoutingForProducts(productIds)

  let n = useBomStore.getState().bomHeaders.length
  while (useBomStore.getState().bomHeaders.length < SATURATION_TARGETS.boms) {
    n++
    const bom = useBomStore.getState()
    const product = useMasterStore.getState().products[n % productIds.length]
    if (!product || bom.getReleasedBomForProduct(product.id)) continue
    ensureDemoBomRoutingForProducts([product.id])
    if (useBomStore.getState().bomHeaders.length >= SATURATION_TARGETS.boms) break
    if (n > productIds.length * 3) break
  }
}
