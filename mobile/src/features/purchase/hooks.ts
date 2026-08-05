import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { isModuleEnabled } from '@/auth/modules'
import { useSessionStore } from '@/store/sessionStore'
import {
  canAccessPurchaseApprovals,
  canCreateGrn,
  canPostGrn,
  canSubmitPurchaseRequisition,
  canViewGrns,
  canViewPurchaseOrders,
  canViewPurchaseQi,
  canViewPurchaseRequisitions,
  getGrn,
  getPurchaseApproval,
  getPurchaseOrder,
  getPurchaseRequisition,
  listGrns,
  listPurchaseApprovals,
  listPurchaseOrders,
  listPurchaseRequisitions,
  listQualityInspections,
  listQualityInspectionsForGrn,
  poFilterToStatusParam,
  prFilterToStatus,
  type GrnListFilter,
  type GrnSummary,
  type PoListFilter,
  type PrListFilter,
  type PurchaseApprovalQueueRow,
  type PurchaseApprovalReviewDetail,
  type PurchaseOrderSummary,
  type PurchaseRequisitionSummary,
  type QualityInspectionSummary,
} from '@/features/purchase/api'
import {
  canApproveInvoice,
  canCompletePurchaseQi,
  canCompleteReturn,
  canCreatePurchaseRequisition,
  canCreateReturn,
  canCreateRfq,
  canEditPurchaseQi,
  canEditPurchaseRequisition,
  canSendRfq,
  canSubmitInvoice,
  canSubmitReturn,
  canViewInvoice,
  canViewReturn,
  canViewRfq,
  getPurchaseInvoice,
  getPurchaseQualityInspection,
  getPurchaseReturn,
  getRfq,
  listPurchaseInvoices,
  listPurchaseReturns,
  listRfqs,
  type PurchaseInvoiceSummary,
  type PurchaseQiDetail,
  type PurchaseReturnSummary,
  type RfqSummary,
} from '@/features/purchase/phaseCApi'

export const purchaseKeys = {
  all: ['purchase'] as const,
  approvals: (tab = 'pending_mine') => [...purchaseKeys.all, 'approvals', tab] as const,
  approval: (id: string) => [...purchaseKeys.all, 'approval', id] as const,
  orders: (q: string, filter: string, page: number) =>
    [...purchaseKeys.all, 'orders', q, filter, page] as const,
  order: (id: string) => [...purchaseKeys.all, 'order', id] as const,
  requisitions: (q: string, filter: string, page: number) =>
    [...purchaseKeys.all, 'prs', q, filter, page] as const,
  requisition: (id: string) => [...purchaseKeys.all, 'pr', id] as const,
  grns: (q: string, filter: string, page: number) =>
    [...purchaseKeys.all, 'grns', q, filter, page] as const,
  grn: (id: string) => [...purchaseKeys.all, 'grn', id] as const,
  qiList: (q: string, status: string, page: number) =>
    [...purchaseKeys.all, 'qi-list', q, status, page] as const,
  qiForGrn: (grnId: string) => [...purchaseKeys.all, 'qi', grnId] as const,
  qiDetail: (id: string) => [...purchaseKeys.all, 'qi-detail', id] as const,
  rfqs: (q: string, status: string, page: number) =>
    [...purchaseKeys.all, 'rfqs', q, status, page] as const,
  rfq: (id: string) => [...purchaseKeys.all, 'rfq', id] as const,
  invoices: (q: string, status: string, page: number) =>
    [...purchaseKeys.all, 'invoices', q, status, page] as const,
  invoice: (id: string) => [...purchaseKeys.all, 'invoice', id] as const,
  returns: (q: string, status: string, page: number) =>
    [...purchaseKeys.all, 'returns', q, status, page] as const,
  return: (id: string) => [...purchaseKeys.all, 'return', id] as const,
  workRecv: () => [...purchaseKeys.all, 'work-recv'] as const,
  workDraftGrn: () => [...purchaseKeys.all, 'work-draft-grn'] as const,
  workDraftPr: () => [...purchaseKeys.all, 'work-draft-pr'] as const,
  workQi: () => [...purchaseKeys.all, 'work-qi'] as const,
}

export function usePurchaseModuleOn() {
  const profile = useSessionStore((s) => s.profile)
  return isModuleEnabled('purchase', profile?.modules)
}

export function usePurchaseApprovalsAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const enabled =
    perms != null &&
    isModuleEnabled('purchase', profile?.modules) &&
    canAccessPurchaseApprovals(perms)
  return { enabled, perms }
}

export function usePurchaseOrdersAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewPurchaseOrders(perms)
  const canReceive = perms != null && moduleOn && canCreateGrn(perms)
  return { moduleOn, canView, canReceive, perms }
}

export function useGrnAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewGrns(perms)
  const canCreate = perms != null && moduleOn && canCreateGrn(perms)
  const canPost = perms != null && moduleOn && canPostGrn(perms)
  const canQi = perms != null && canViewPurchaseQi(perms)
  return { moduleOn, canView, canCreate, canPost, canQi, perms }
}

export function usePrAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewPurchaseRequisitions(perms)
  const canSubmit = perms != null && moduleOn && canSubmitPurchaseRequisition(perms)
  const canCreate = perms != null && moduleOn && canCreatePurchaseRequisition(perms)
  const canEdit = perms != null && moduleOn && canEditPurchaseRequisition(perms)
  const canRfqCreate = perms != null && moduleOn && canCreateRfq(perms)
  return { moduleOn, canView, canSubmit, canCreate, canEdit, canRfqCreate, perms }
}

export function useRfqAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewRfq(perms)
  const canSend = perms != null && moduleOn && canSendRfq(perms)
  const canCreate = perms != null && moduleOn && canCreateRfq(perms)
  return { moduleOn, canView, canSend, canCreate, perms }
}

export function useInvoiceAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewInvoice(perms)
  const canSubmit = perms != null && moduleOn && canSubmitInvoice(perms)
  const canApprove = perms != null && moduleOn && canApproveInvoice(perms)
  return { moduleOn, canView, canSubmit, canApprove, perms }
}

export function useReturnAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewReturn(perms)
  const canCreate = perms != null && moduleOn && canCreateReturn(perms)
  const canSubmit = perms != null && moduleOn && canSubmitReturn(perms)
  const canComplete = perms != null && moduleOn && canCompleteReturn(perms)
  return { moduleOn, canView, canCreate, canSubmit, canComplete, perms }
}

export function usePurchaseQiActAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const moduleOn = isModuleEnabled('purchase', profile?.modules)
  const canView = perms != null && moduleOn && canViewPurchaseQi(perms)
  const canDecide = perms != null && moduleOn && canCompletePurchaseQi(perms)
  const canEdit = perms != null && moduleOn && canEditPurchaseQi(perms)
  return { moduleOn, canView, canDecide, canEdit, perms }
}

export function usePurchaseApprovals(
  tab: string = 'pending_mine',
): UseQueryResult<PurchaseApprovalQueueRow[], Error> {
  const { enabled } = usePurchaseApprovalsAccess()
  return useQuery({
    queryKey: purchaseKeys.approvals(tab),
    queryFn: () => listPurchaseApprovals(tab, 100),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function usePurchaseApproval(
  id: string,
): UseQueryResult<PurchaseApprovalReviewDetail, Error> {
  const { enabled } = usePurchaseApprovalsAccess()
  return useQuery({
    queryKey: purchaseKeys.approval(id),
    queryFn: () => getPurchaseApproval(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function usePurchaseOrdersList(
  search: string,
  filter: PoListFilter,
  page = 1,
  enabled: boolean,
) {
  const status = poFilterToStatusParam(filter)
  return useQuery({
    queryKey: purchaseKeys.orders(search, filter, page),
    queryFn: () =>
      listPurchaseOrders({
        search: search.trim() || undefined,
        status,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function usePurchaseOrderDetail(
  id: string,
  enabled: boolean,
): UseQueryResult<PurchaseOrderSummary, Error> {
  return useQuery({
    queryKey: purchaseKeys.order(id),
    queryFn: () => getPurchaseOrder(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function usePrList(search: string, filter: PrListFilter, page = 1, enabled: boolean) {
  const status = prFilterToStatus(filter)
  return useQuery({
    queryKey: purchaseKeys.requisitions(search, filter, page),
    queryFn: () =>
      listPurchaseRequisitions({
        search: search.trim() || undefined,
        status,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function usePrDetail(
  id: string,
  enabled: boolean,
): UseQueryResult<PurchaseRequisitionSummary, Error> {
  return useQuery({
    queryKey: purchaseKeys.requisition(id),
    queryFn: () => getPurchaseRequisition(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useQiRegister(
  search: string,
  status: string,
  page = 1,
  enabled: boolean,
) {
  return useQuery({
    queryKey: purchaseKeys.qiList(search, status, page),
    queryFn: () =>
      listQualityInspections({
        search: search.trim() || undefined,
        status: status || undefined,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useGrnsList(search: string, filter: GrnListFilter, page = 1, enabled: boolean) {
  const status = filter === 'all' ? undefined : filter
  return useQuery({
    queryKey: purchaseKeys.grns(search, filter, page),
    queryFn: () =>
      listGrns({
        search: search.trim() || undefined,
        status,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useGrnsForPurchaseOrder(poId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...purchaseKeys.all, 'grns-for-po', poId] as const,
    queryFn: () => listGrns({ purchaseOrderId: poId, limit: 50 }),
    enabled: enabled && Boolean(poId),
    staleTime: 15_000,
    retry: 1,
  })
}

export function useGrnDetail(id: string, enabled: boolean): UseQueryResult<GrnSummary, Error> {
  return useQuery({
    queryKey: purchaseKeys.grn(id),
    queryFn: () => getGrn(id),
    enabled: enabled && Boolean(id),
    staleTime: 8_000,
    retry: 1,
  })
}

export function useQiForGrn(
  grnId: string,
  enabled: boolean,
): UseQueryResult<QualityInspectionSummary[], Error> {
  return useQuery({
    queryKey: purchaseKeys.qiForGrn(grnId),
    queryFn: () => listQualityInspectionsForGrn(grnId),
    enabled: enabled && Boolean(grnId),
    staleTime: 20_000,
    retry: 0,
  })
}

export function usePurchaseQiDetail(
  id: string,
  enabled: boolean,
): UseQueryResult<PurchaseQiDetail, Error> {
  return useQuery({
    queryKey: purchaseKeys.qiDetail(id),
    queryFn: () => getPurchaseQualityInspection(id),
    enabled: enabled && Boolean(id),
    staleTime: 8_000,
    retry: 1,
  })
}

export function useRfqList(search: string, status: string, page = 1, enabled: boolean) {
  return useQuery({
    queryKey: purchaseKeys.rfqs(search, status, page),
    queryFn: () =>
      listRfqs({
        search: search.trim() || undefined,
        status: status || undefined,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useRfqDetail(id: string, enabled: boolean): UseQueryResult<RfqSummary, Error> {
  return useQuery({
    queryKey: purchaseKeys.rfq(id),
    queryFn: () => getRfq(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useInvoiceList(search: string, status: string, page = 1, enabled: boolean) {
  return useQuery({
    queryKey: purchaseKeys.invoices(search, status, page),
    queryFn: () =>
      listPurchaseInvoices({
        search: search.trim() || undefined,
        status: status || undefined,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useInvoiceDetail(
  id: string,
  enabled: boolean,
): UseQueryResult<PurchaseInvoiceSummary, Error> {
  return useQuery({
    queryKey: purchaseKeys.invoice(id),
    queryFn: () => getPurchaseInvoice(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useReturnList(search: string, status: string, page = 1, enabled: boolean) {
  return useQuery({
    queryKey: purchaseKeys.returns(search, status, page),
    queryFn: () =>
      listPurchaseReturns({
        search: search.trim() || undefined,
        status: status || undefined,
        page,
        limit: 30,
      }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useReturnDetail(
  id: string,
  enabled: boolean,
): UseQueryResult<PurchaseReturnSummary, Error> {
  return useQuery({
    queryKey: purchaseKeys.return(id),
    queryFn: () => getPurchaseReturn(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useInvalidatePurchase() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: purchaseKeys.all })
  }
}
