import type { BomHeader, BomLine } from '../types/bom'
import type { RoutingHeader, RoutingOperation } from '../types/routing'
import { useBomStore } from '../store/bomStore'
import { useRoutingStore } from '../store/routingStore'
import { useMasterStore } from '../store/masterStore'

const ANCHOR_BOM_ID = 'bom-bulker-a'
const ANCHOR_RTG_ID = 'rtg-bulker-a'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

/** Clone released bulker BOM/routing for scenario products that share the same manufacturing structure. */
export function ensureDemoBomRoutingForProducts(productIds: string[]): void {
  const bomStore = useBomStore.getState()
  const routingStore = useRoutingStore.getState()
  const anchorBom = bomStore.bomHeaders.find((h) => h.id === ANCHOR_BOM_ID)
  const anchorRtg = routingStore.routingHeaders.find((h) => h.id === ANCHOR_RTG_ID)
  if (!anchorBom || !anchorRtg) return

  const anchorLines = bomStore.bomLines.filter((l) => l.bomHeaderId === ANCHOR_BOM_ID)
  const anchorOps = routingStore.routingOperations.filter((o) => o.routingHeaderId === ANCHOR_RTG_ID)

  const newHeaders: BomHeader[] = []
  const newLines: BomLine[] = []
  const newRtgHeaders: RoutingHeader[] = []
  const newOps: RoutingOperation[] = []

  for (const productId of productIds) {
    if (bomStore.getReleasedBomForProduct(productId)) continue
    const product = useMasterStore.getState().getProduct(productId)
    if (!product) continue

    const bomId = `bom-demo-${productId}`
    const rtgId = `rtg-demo-${productId}`
    const ts = new Date().toISOString()

    newHeaders.push({
      ...anchorBom,
      id: bomId,
      bomNo: `BOM-${product.productCode.replace('FG-', '')}-001`,
      productId,
      updatedAt: ts,
    })

    const lineIdMap = new Map<string, string>()
    for (const line of anchorLines) {
      lineIdMap.set(line.id, genId('bl'))
    }
    for (const line of anchorLines) {
      newLines.push({
        ...line,
        id: lineIdMap.get(line.id)!,
        bomHeaderId: bomId,
        parentLineId: line.parentLineId ? lineIdMap.get(line.parentLineId) ?? null : null,
      })
    }

    newRtgHeaders.push({
      ...anchorRtg,
      id: rtgId,
      routingNo: `RTG-${product.productCode.replace('FG-', '')}-001`,
      productId,
      updatedAt: ts,
    })

    for (const op of anchorOps) {
      newOps.push({
        ...op,
        id: genId('rop'),
        routingHeaderId: rtgId,
      })
    }
  }

  if (newHeaders.length === 0) return

  useBomStore.setState((s) => ({
    bomHeaders: [...s.bomHeaders, ...newHeaders],
    bomLines: [...s.bomLines, ...newLines],
  }))
  useRoutingStore.setState((s) => ({
    routingHeaders: [...s.routingHeaders, ...newRtgHeaders],
    routingOperations: [...s.routingOperations, ...newOps],
  }))
}
