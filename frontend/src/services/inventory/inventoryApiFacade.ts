import * as inventoryApi from '../api/inventoryApi'
import * as documentsApi from '../api/inventoryDocumentsApi'

export const inventoryApiFacade = {
  listBalances: (params?: Record<string, string | number | boolean | undefined>) =>
    inventoryApi.listInventoryBalances(params),
  listLedger: (params?: Record<string, string | number | boolean | undefined>) =>
    inventoryApi.listInventoryLedger(params),
  listReservations: (params?: Record<string, string | number | boolean | undefined>) =>
    inventoryApi.listInventoryReservations(params),

  listTransfers: (params?: Record<string, string | number | boolean | undefined>) =>
    documentsApi.listInventoryTransfers(params),
  postTransfer: (id: string) => documentsApi.dispatchInventoryTransfer(id),

  listAdjustments: (params?: Record<string, string | number | boolean | undefined>) =>
    documentsApi.listInventoryAdjustments(params),
  postAdjustment: (id: string) => documentsApi.postInventoryAdjustment(id),

  listStockCounts: (params?: Record<string, string | number | boolean | undefined>) =>
    documentsApi.listInventoryStockCounts(params),
  postStockCount: (id: string) => documentsApi.postInventoryStockCount(id),
}

export { documentsApi as inventoryDocumentsApi, inventoryApi }
