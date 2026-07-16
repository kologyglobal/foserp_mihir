import { useInventoryStore } from '../../store/inventoryStore'
import { useMasterStore } from '../../store/masterStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Post inward movements until stock ledger depth target is met */
export function seedDemoInventory(): void {
  const master = useMasterStore.getState()
  const stockable = master.items.filter((i) => i.isStockable)
  const warehouses = master.warehouses.filter((w) => w.warehouseType === 'main' || w.warehouseType === 'sub')

  let n = useInventoryStore.getState().stockMovements.length
  while (useInventoryStore.getState().stockMovements.length < SATURATION_TARGETS.inventoryMovements && n < 500) {
    n++
    const inv = useInventoryStore.getState()
    const item = stockable[n % stockable.length]
    const wh = warehouses[n % warehouses.length]
    if (!item || !wh) break
    const qty = 10 + (n % 40)
    inv.postInward({
      itemId: item.id,
      warehouseId: wh.id,
      qty,
      referenceNo: `SAT-IN-${String(n).padStart(4, '0')}`,
      remarks: 'Demo saturation inward',
    })
    if (n % 5 === 0 && inv.getFreeQty(item.id, wh.id) > 5) {
      inv.postIssue({
        itemId: item.id,
        warehouseId: wh.id,
        qty: Math.min(5, inv.getFreeQty(item.id, wh.id)),
        referenceNo: `SAT-ISS-${String(n).padStart(4, '0')}`,
        remarks: 'Demo saturation material issue',
      })
    }
    if (n % 7 === 0) {
      const positive = n % 2 === 0
      inv.postAdjustment({
        itemId: item.id,
        warehouseId: wh.id,
        qty: positive ? 2 : 1,
        isPositive: positive,
        referenceNo: `SAT-ADJ-${String(n).padStart(4, '0')}`,
        remarks: 'Demo saturation stock adjustment',
      })
    }
  }
}
