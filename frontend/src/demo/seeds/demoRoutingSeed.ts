import { useRoutingStore } from '../../store/routingStore'
import { useMasterStore } from '../../store/masterStore'
import { ensureDemoBomRoutingForProducts } from '../demoBomRoutingClone'
import { useWorkCenterStore } from '../../store/workCenterStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

const WC_NAMES = [
  'CNC Plasma Bay', 'Profile Cutting', 'Plate Rolling', 'Tank Shell Fab',
  'Chassis Welding', 'Sub-Assembly Line 2', 'Paint Booth B', 'Final Inspection Bay',
  'Axle Fitment Line', 'Pneumatic Test Cell',
]

/** Clone routings for all products; add work centers to 20 */
export function seedDemoRoutings(): void {
  ensureDemoBomRoutingForProducts(useMasterStore.getState().products.map((p) => p.id))

  let w = useWorkCenterStore.getState().workCenters.length
  while (useWorkCenterStore.getState().workCenters.length < SATURATION_TARGETS.workCenters) {
    const name = WC_NAMES[w - 10] ?? `Production Cell ${w + 1}`
    w++
    useWorkCenterStore.setState((s) => ({
      workCenters: [
        ...s.workCenters,
        {
          id: `wc-sat-${String(w).padStart(2, '0')}`,
          workCenterCode: `WC-SAT-${String(w).padStart(2, '0')}`,
          workCenterName: name,
          department: w % 3 === 0 ? 'Subcontract' : 'Fabrication',
          plantCode: 'PUNE',
          capacityHoursPerDay: 8,
          costRatePerHour: 450 + w * 10,
          description: `Saturation demo work center — ${name}`,
          inputWarehouseCode: 'RM_STORE',
          wipWarehouseCode: 'WIP_FABRICATION',
          outputWarehouseCode: 'WIP_ASSEMBLY',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  }

  let n = useRoutingStore.getState().routingHeaders.length
  while (useRoutingStore.getState().routingHeaders.length < SATURATION_TARGETS.routings && n < 100) {
    n++
    const routing = useRoutingStore.getState()
    const product = useMasterStore.getState().products[n % useMasterStore.getState().products.length]
    if (!product || routing.getReleasedRoutingForProduct(product.id)) continue
    ensureDemoBomRoutingForProducts([product.id])
  }
}
