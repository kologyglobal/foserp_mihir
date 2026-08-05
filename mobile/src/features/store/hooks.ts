import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { isModuleEnabled } from '@/auth/modules'
import { useSessionStore } from '@/store/sessionStore'
import {
  canAccessMaterialIssue,
  canAccessMaterialReturn,
  canViewMaterials,
  canViewStock,
  canViewStockCounts,
  canCountStock,
  canCreateStockCount,
  canSubmitStockCount,
  canViewTransfers,
  canCreateTransfer,
  canSubmitTransfer,
  canApproveTransfer,
  canDispatchTransfer,
  canReceiveTransfer,
  canCancelTransfer,
  canViewWorkOrders,
  getStockCount,
  getTransfer,
  listStockCounts,
  listTransfers,
  listWarehouses,
  listWorkOrderMaterials,
  listWorkOrders,
  searchStockByCode,
  type StockCountDoc,
  type TransferDoc,
  type WarehouseSummary,
  type WorkOrderMaterialLine,
  type WorkOrderSummary,
} from '@/features/store/api'

export const storeKeys = {
  all: ['store'] as const,
  workOrders: (search = '') => [...storeKeys.all, 'work-orders', search] as const,
  materials: (woId: string) => [...storeKeys.all, 'materials', woId] as const,
  stockSearch: (q: string) => [...storeKeys.all, 'stock-search', q] as const,
  stockCounts: (status = '') => [...storeKeys.all, 'stock-counts', status] as const,
  stockCount: (id: string) => [...storeKeys.all, 'stock-count', id] as const,
  transfers: (status = '') => [...storeKeys.all, 'transfers', status] as const,
  transfer: (id: string) => [...storeKeys.all, 'transfer', id] as const,
  warehouses: () => [...storeKeys.all, 'warehouses'] as const,
}

export function useMaterialIssueAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const mfgOn = isModuleEnabled('manufacturing', profile?.modules)
  const canIssue = perms != null && mfgOn && canAccessMaterialIssue(perms)
  const canReturn = perms != null && mfgOn && canAccessMaterialReturn(perms)
  const canLoadWo = perms != null && mfgOn && canViewWorkOrders(perms)
  const canLoadMats = perms != null && mfgOn && canViewMaterials(perms)
  return { canIssue, canReturn, canLoadWo, canLoadMats, mfgOn, perms }
}

export function useStockAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const invOn = isModuleEnabled('inventory', profile?.modules)
  const canView = perms != null && invOn && canViewStock(perms)
  const canCounts = perms != null && invOn && canViewStockCounts(perms)
  const canCount = perms != null && invOn && canCountStock(perms)
  const canCreate = perms != null && invOn && canCreateStockCount(perms)
  const canSubmit = perms != null && invOn && canSubmitStockCount(perms)
  return { canView, canCounts, canCount, canCreate, canSubmit, invOn, perms }
}

export function useTransferAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const invOn = isModuleEnabled('inventory', profile?.modules)
  const on = perms != null && invOn
  return {
    invOn,
    perms,
    canView: on && canViewTransfers(perms),
    canCreate: on && canCreateTransfer(perms),
    canSubmit: on && canSubmitTransfer(perms),
    canApprove: on && canApproveTransfer(perms),
    canDispatch: on && canDispatchTransfer(perms),
    canReceive: on && canReceiveTransfer(perms),
    canCancel: on && canCancelTransfer(perms),
  }
}

export function useWorkOrderSearch(
  search: string,
  enabled: boolean,
): UseQueryResult<WorkOrderSummary[], Error> {
  const trimmed = search.trim()
  return useQuery({
    queryKey: storeKeys.workOrders(trimmed),
    queryFn: () => listWorkOrders({ search: trimmed || undefined, limit: 25 }),
    enabled: enabled && trimmed.length >= 1,
    staleTime: 20_000,
    retry: 1,
  })
}

export function useWorkOrderMaterials(
  workOrderId: string | null,
  enabled: boolean,
): UseQueryResult<WorkOrderMaterialLine[], Error> {
  return useQuery({
    queryKey: storeKeys.materials(workOrderId ?? ''),
    queryFn: () => listWorkOrderMaterials(workOrderId!),
    enabled: enabled && Boolean(workOrderId),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useStockSearch(query: string, enabled: boolean) {
  const q = query.trim()
  return useQuery({
    queryKey: storeKeys.stockSearch(q),
    queryFn: () => searchStockByCode(q),
    enabled: enabled && q.length >= 1,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useStockCountsList(enabled: boolean, status?: string) {
  return useQuery({
    queryKey: storeKeys.stockCounts(status ?? ''),
    queryFn: () => listStockCounts({ limit: 40, status }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useStockCountDetail(id: string, enabled: boolean): UseQueryResult<StockCountDoc, Error> {
  return useQuery({
    queryKey: storeKeys.stockCount(id),
    queryFn: () => getStockCount(id),
    enabled: enabled && Boolean(id),
    staleTime: 8_000,
    retry: 1,
  })
}

export function useWarehouses(enabled: boolean): UseQueryResult<WarehouseSummary[], Error> {
  return useQuery({
    queryKey: storeKeys.warehouses(),
    queryFn: () => listWarehouses({ limit: 50 }),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useTransfersList(enabled: boolean, status?: string) {
  return useQuery({
    queryKey: storeKeys.transfers(status ?? ''),
    queryFn: () => listTransfers({ limit: 40, status }),
    enabled,
    staleTime: 12_000,
    retry: 1,
  })
}

export function useTransferDetail(
  id: string,
  enabled: boolean,
): UseQueryResult<TransferDoc, Error> {
  return useQuery({
    queryKey: storeKeys.transfer(id),
    queryFn: () => getTransfer(id),
    enabled: enabled && Boolean(id),
    staleTime: 8_000,
    retry: 1,
  })
}

export function useInvalidateStore() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: storeKeys.all })
  }
}
