import { usePurchaseMasterStore } from '../../store/purchaseMasterStore'

export function itemRequiresIncomingQc(itemId: string): boolean {
  return usePurchaseMasterStore.getState().itemRequiresIncomingQc(itemId)
}

export function getQuarantineWarehouseId(): string {
  return 'wh-qc-hold'
}
