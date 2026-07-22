import { isApiMode } from '../../config/apiConfig'
import * as inventoryApi from '../api/inventoryApi'
import * as documentsApi from '../api/inventoryDocumentsApi'
import { getStockAvailability } from './inventoryService'
import { getReservations } from './traceabilityService'
import {
  dispatchTransferDemo,
  getAdjustments,
  getTransfers,
  postAdjustmentDemo,
} from './transferAdjustmentReturnService'
import {
  getStockCounts,
  postStockCountAdjustmentDemo,
} from './stockCountService'

export const inventoryApiFacade = {
  listBalances: (params?: Record<string, string | number | boolean | undefined>) =>
    isApiMode() ? inventoryApi.listInventoryBalances(params) : getStockAvailability(params as never),
  listLedger: (params?: Record<string, string | number | boolean | undefined>) => {
    if (!isApiMode()) return Promise.resolve([])
    return inventoryApi.listInventoryLedger(params)
  },
  listReservations: (params?: Record<string, string | number | boolean | undefined>) =>
    isApiMode() ? inventoryApi.listInventoryReservations(params) : getReservations(params as never),

  listTransfers: (params?: Record<string, string | number | boolean | undefined>) =>
    isApiMode() ? documentsApi.listInventoryTransfers(params) : getTransfers(params as never),
  postTransfer: (id: string) =>
    isApiMode() ? documentsApi.dispatchInventoryTransfer(id) : dispatchTransferDemo(id),

  listAdjustments: (params?: Record<string, string | number | boolean | undefined>) =>
    isApiMode() ? documentsApi.listInventoryAdjustments(params) : getAdjustments(params as never),
  postAdjustment: (id: string) =>
    isApiMode() ? documentsApi.postInventoryAdjustment(id) : postAdjustmentDemo(id),

  listStockCounts: (params?: Record<string, string | number | boolean | undefined>) =>
    isApiMode() ? documentsApi.listInventoryStockCounts(params) : getStockCounts(params as never),
  postStockCount: (id: string) =>
    isApiMode() ? documentsApi.postInventoryStockCount(id) : postStockCountAdjustmentDemo(id),
}

export { documentsApi as inventoryDocumentsApi, inventoryApi }
