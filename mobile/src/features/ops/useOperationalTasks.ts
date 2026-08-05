/**
 * Multi-source task aggregator for Work tab.
 * Purchase sources isolate failures (approvals vs receiving vs draft GRNs/PR/QI).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { canAny } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import { useSessionStore } from '@/store/sessionStore'
import { getUserFriendlyMessage } from '@/api/errors'
import {
  canAccessPurchaseApprovals,
  canCreateGrn,
  canPostGrn,
  canSubmitPurchaseRequisition,
  canViewGrns,
  canViewPurchaseOrders,
  canViewPurchaseQi,
  canViewPurchaseRequisitions,
  isPoReceivable,
  listGrns,
  listPurchaseApprovals,
  listPurchaseOrders,
  listPurchaseRequisitions,
  listQualityInspections,
  type PurchaseApprovalQueueRow,
} from '@/features/purchase/api'
import { purchaseKeys } from '@/features/purchase/hooks'

export type MobileTaskSource = 'purchase' | 'quality' | 'store' | 'gate' | 'crm'

export interface MobileTask {
  id: string
  source: MobileTaskSource
  title: string
  subtitle?: string
  status: string
  priority?: string
  dueAt?: string
  href: string
}

export interface MobileApproval {
  id: string
  source: string
  documentType: string
  documentNumber: string
  requestedBy?: string
  requestedAt?: string
  amount?: number
  status: string
  href: string
  canAct: boolean
  documentId?: string
  documentTypeKey?:
    | 'purchase_requisition'
    | 'purchase_order'
    | 'goods_receipt_note'
    | 'gate_approval'
    | 'crm_quotation'
}

function mapPurchaseTask(row: PurchaseApprovalQueueRow): MobileTask {
  return {
    id: row.approvalId || `${row.documentType}-${row.documentId}`,
    source: 'purchase',
    title: row.documentNumber || 'Purchase document',
    subtitle: [row.documentTypeLabel, row.requestedBy, row.approvalLevelLabel]
      .filter(Boolean)
      .join(' · '),
    status: row.statusLabel || row.status || 'pending',
    priority: row.priorityLabel || row.priority,
    dueAt: row.submittedDate,
    href: `/(app)/purchase/approvals/${row.approvalId || row.documentId}`,
  }
}

export function useOperationalTasks() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const purchaseModule =
    perms != null && isModuleEnabled('purchase', profile?.modules)

  const approvalsEnabled =
    purchaseModule && canAccessPurchaseApprovals(perms)
  const recvEnabled =
    purchaseModule && canViewPurchaseOrders(perms) && canCreateGrn(perms)
  const draftEnabled =
    purchaseModule && canViewGrns(perms) && (canCreateGrn(perms) || canPostGrn(perms))
  const prDraftEnabled =
    purchaseModule &&
    canViewPurchaseRequisitions(perms) &&
    canSubmitPurchaseRequisition(perms)
  const qiEnabled = purchaseModule && canViewPurchaseQi(perms)

  const approvalsQ = useQuery({
    queryKey: purchaseKeys.approvals('pending_mine'),
    queryFn: () => listPurchaseApprovals('pending_mine', 50),
    enabled: approvalsEnabled,
    staleTime: 15_000,
    retry: 1,
  })

  const openPoQ = useQuery({
    queryKey: purchaseKeys.workRecv(),
    queryFn: async () => {
      const sent = await listPurchaseOrders({ status: 'SENT_TO_VENDOR', limit: 30 })
      const partial = await listPurchaseOrders({ status: 'PARTIALLY_RECEIVED', limit: 30 })
      const map = new Map<string, (typeof sent.items)[0]>()
      for (const po of [...sent.items, ...partial.items]) map.set(po.id, po)
      return [...map.values()].filter(isPoReceivable)
    },
    enabled: recvEnabled,
    staleTime: 20_000,
    retry: 1,
  })

  const draftGrnQ = useQuery({
    queryKey: purchaseKeys.workDraftGrn(),
    queryFn: async () => {
      const draft = await listGrns({ status: 'DRAFT', limit: 30 })
      return draft.items
    },
    enabled: draftEnabled,
    staleTime: 20_000,
    retry: 1,
  })

  const draftPrQ = useQuery({
    queryKey: purchaseKeys.workDraftPr(),
    queryFn: async () => {
      const { items } = await listPurchaseRequisitions({ status: 'DRAFT', limit: 30 })
      return items
    },
    enabled: prDraftEnabled,
    staleTime: 20_000,
    retry: 1,
  })

  const pendingQiQ = useQuery({
    queryKey: purchaseKeys.workQi(),
    queryFn: async () => {
      const { items } = await listQualityInspections({ status: 'PENDING', limit: 20 })
      return items
    },
    enabled: qiEnabled,
    staleTime: 20_000,
    retry: 1,
  })

  const tasks = useMemo(() => {
    const out: MobileTask[] = []
    if (approvalsEnabled && approvalsQ.data) {
      out.push(...approvalsQ.data.map(mapPurchaseTask))
    }
    if (prDraftEnabled && draftPrQ.data) {
      for (const pr of draftPrQ.data) {
        out.push({
          id: `pr-draft-${pr.id}`,
          source: 'purchase',
          title: `Submit ${pr.requisitionNumber || pr.id.slice(0, 8)}`,
          subtitle: [pr.requestedByName, pr.purchasePurpose].filter(Boolean).join(' · '),
          status: pr.status || 'DRAFT',
          href: `/(app)/purchase/requisitions/${pr.id}`,
        })
      }
    }
    if (recvEnabled && openPoQ.data) {
      for (const po of openPoQ.data) {
        out.push({
          id: `recv-${po.id}`,
          source: 'purchase',
          title: `Receive ${po.orderNumber || po.id.slice(0, 8)}`,
          subtitle: [po.vendorName, titleCase(po.status)].filter(Boolean).join(' · '),
          status: po.status || 'open',
          href: `/(app)/purchase/grn/receive?poId=${encodeURIComponent(po.id)}`,
        })
      }
    }
    if (draftEnabled && draftGrnQ.data) {
      for (const grn of draftGrnQ.data) {
        out.push({
          id: `grn-draft-${grn.id}`,
          source: 'purchase',
          title: `Post / submit ${grn.grnNumber || grn.id.slice(0, 8)}`,
          subtitle: [grn.vendorName, grn.purchaseOrderNumber].filter(Boolean).join(' · '),
          status: grn.status || 'DRAFT',
          href: `/(app)/purchase/grn/${grn.id}`,
        })
      }
    }
    if (qiEnabled && pendingQiQ.data) {
      for (const qi of pendingQiQ.data) {
        out.push({
          id: `qi-${qi.id}`,
          source: 'purchase',
          title: `QC ${qi.inspectionNumber || qi.id.slice(0, 8)}`,
          subtitle: [qi.goodsReceiptNumber, qi.purchaseOrderNumber, qi.vendorName]
            .filter(Boolean)
            .join(' · '),
          status: qi.status || 'PENDING',
          href: `/(app)/purchase/quality-inspections/${qi.id}`,
        })
      }
    }
    return out
  }, [
    approvalsEnabled,
    approvalsQ.data,
    prDraftEnabled,
    draftPrQ.data,
    recvEnabled,
    openPoQ.data,
    draftEnabled,
    draftGrnQ.data,
    qiEnabled,
    pendingQiQ.data,
  ])

  const showPurchase =
    approvalsEnabled || recvEnabled || draftEnabled || prDraftEnabled || qiEnabled

  const anyPurchaseLoading =
    (approvalsEnabled && approvalsQ.isLoading) ||
    (recvEnabled && openPoQ.isLoading) ||
    (draftEnabled && draftGrnQ.isLoading) ||
    (prDraftEnabled && draftPrQ.isLoading) ||
    (qiEnabled && pendingQiQ.isLoading)

  const anyPurchaseError =
    (approvalsEnabled && approvalsQ.error) ||
    (recvEnabled && openPoQ.error) ||
    (draftEnabled && draftGrnQ.error) ||
    (prDraftEnabled && draftPrQ.error) ||
    (qiEnabled && pendingQiQ.error)

  const sources = useMemo(
    () => [
      {
        source: 'purchase' as const,
        status: !showPurchase
          ? ('skipped' as const)
          : anyPurchaseLoading
            ? ('loading' as const)
            : anyPurchaseError
              ? ('error' as const)
              : ('ok' as const),
      },
      { source: 'quality' as const, status: 'skipped' as const },
      { source: 'gate' as const, status: 'skipped' as const },
      {
        source: 'crm' as const,
        status:
          perms != null &&
          isModuleEnabled('crm', profile?.modules) &&
          canAny(['crm.follow_up.view'], perms)
            ? ('skipped' as const)
            : ('skipped' as const),
      },
    ],
    [showPurchase, anyPurchaseLoading, anyPurchaseError, perms, profile?.modules],
  )

  const failed = useMemo(() => {
    const rows: Array<{ source: string; error: string }> = []
    if (approvalsEnabled && approvalsQ.error) {
      rows.push({ source: 'purchase', error: getUserFriendlyMessage(approvalsQ.error) })
    } else if (prDraftEnabled && draftPrQ.error) {
      rows.push({ source: 'purchase', error: getUserFriendlyMessage(draftPrQ.error) })
    } else if (recvEnabled && openPoQ.error) {
      rows.push({ source: 'purchase', error: getUserFriendlyMessage(openPoQ.error) })
    } else if (draftEnabled && draftGrnQ.error) {
      rows.push({ source: 'purchase', error: getUserFriendlyMessage(draftGrnQ.error) })
    } else if (qiEnabled && pendingQiQ.error) {
      rows.push({ source: 'purchase', error: getUserFriendlyMessage(pendingQiQ.error) })
    }
    return rows
  }, [
    approvalsEnabled,
    approvalsQ.error,
    prDraftEnabled,
    draftPrQ.error,
    recvEnabled,
    openPoQ.error,
    draftEnabled,
    draftGrnQ.error,
    qiEnabled,
    pendingQiQ.error,
  ])

  return {
    tasks,
    sources,
    failed,
    isLoading: showPurchase && anyPurchaseLoading,
    refetchAll: () => {
      if (approvalsEnabled) void approvalsQ.refetch()
      if (prDraftEnabled) void draftPrQ.refetch()
      if (recvEnabled) void openPoQ.refetch()
      if (draftEnabled) void draftGrnQ.refetch()
      if (qiEnabled) void pendingQiQ.refetch()
    },
    refetchSource: (source: string) => {
      if (source === 'purchase') {
        if (approvalsEnabled) void approvalsQ.refetch()
        if (prDraftEnabled) void draftPrQ.refetch()
        if (recvEnabled) void openPoQ.refetch()
        if (draftEnabled) void draftGrnQ.refetch()
        if (qiEnabled) void pendingQiQ.refetch()
      }
    },
  }
}

function titleCase(s?: string) {
  if (!s) return ''
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Unified purchase approvals for optional consumers. */
export function useUnifiedApprovals() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const crmEnabled =
    perms != null &&
    isModuleEnabled('crm', profile?.modules) &&
    canAny(['crm.quotation.view', 'crm.quotation.approve'], perms)
  const purchaseEnabled =
    perms != null &&
    isModuleEnabled('purchase', profile?.modules) &&
    canAccessPurchaseApprovals(perms)

  const purchaseQ = useQuery({
    queryKey: purchaseKeys.approvals('pending_mine'),
    queryFn: () => listPurchaseApprovals('pending_mine', 50),
    enabled: purchaseEnabled,
    staleTime: 15_000,
    retry: 1,
  })

  const items = useMemo(() => {
    if (!purchaseEnabled || !purchaseQ.data) return [] as MobileApproval[]
    return purchaseQ.data.map((row) => ({
      id: row.approvalId,
      source: 'purchase',
      documentType: row.documentTypeLabel || row.documentType,
      documentNumber: row.documentNumber,
      requestedBy: row.requestedBy,
      requestedAt: row.submittedDate,
      amount: row.amount,
      status: row.status || 'pending',
      href: `/(app)/purchase/approvals/${row.approvalId || row.documentId}`,
      canAct: Boolean(row.canAct),
      documentId: row.documentId,
      documentTypeKey: row.documentType,
    }))
  }, [purchaseEnabled, purchaseQ.data])

  const errors = useMemo(() => {
    if (!purchaseEnabled || !purchaseQ.error) return [] as Array<{ source: string; message: string }>
    return [{ source: 'purchase', message: getUserFriendlyMessage(purchaseQ.error) }]
  }, [purchaseEnabled, purchaseQ.error])

  return {
    items,
    errors,
    isLoading: purchaseEnabled && purchaseQ.isLoading,
    crmEnabled,
    refetch: () => {
      if (purchaseEnabled) void purchaseQ.refetch()
    },
  }
}
