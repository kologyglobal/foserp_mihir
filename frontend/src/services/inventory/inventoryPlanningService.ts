/**
 * Inventory Planning service — live API only (masters + live balances, see inventoryPlanningLive).
 */

import type { InventoryPlanningFilter, InventoryPlanningRow } from '../../types/inventoryDomain'
import {
  createLivePurchaseRequisitionFromPlanning,
  ignoreLivePlanningSuggestion,
  listLiveInventoryPlanning,
  updateLivePlanningQuantity,
  updateLivePlanningRequiredDate,
} from './inventoryPlanningLive'

export async function getInventoryPlanning(
  filter: InventoryPlanningFilter = {},
): Promise<InventoryPlanningRow[]> {
  return listLiveInventoryPlanning(filter)
}

export async function ignorePlanningSuggestion(id: string): Promise<void> {
  return ignoreLivePlanningSuggestion(id)
}

export async function updatePlanningQuantity(id: string, qty: number): Promise<void> {
  return updateLivePlanningQuantity(id, qty)
}

export async function updatePlanningRequiredDate(id: string, date: string): Promise<void> {
  return updateLivePlanningRequiredDate(id, date)
}

export async function createPurchaseRequisitionDraftDemo(
  row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  return createLivePurchaseRequisitionFromPlanning(row)
}

export async function createProductionRequestDraftDemo(
  _row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  throw new Error('Create a work order from Manufacturing → Work Orders for production replenishment')
}

export async function createTransferDraftFromPlanningDemo(
  _row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  throw new Error('Create a transfer from Inventory → Transfers')
}
