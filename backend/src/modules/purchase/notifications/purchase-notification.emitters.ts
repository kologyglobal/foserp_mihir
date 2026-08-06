/**
 * Purchase-domain in-app notifications.
 * Reads Purchase Setup `notificationPreferences` (inApp toggles).
 * Email channel is stored but not delivered yet (preference only).
 */
import type { NotificationCategory, NotificationPriority } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { logger } from '../../../config/logger.js'
import { buildDedupKey } from '../../notifications/notification.constants.js'
import * as notificationService from '../../notifications/notification.service.js'
import {
  normalizeNotificationPreferences,
  type PurchaseNotificationEventKey,
  type PurchaseNotificationPreferences,
} from '../setup/purchase-setup.mapper.js'

export const PURCHASE_NOTIFICATION_TYPES = {
  PR_PENDING_APPROVAL: 'PR_PENDING_APPROVAL',
  PO_PENDING_APPROVAL: 'PO_PENDING_APPROVAL',
  RFQ_RESPONSE_DUE: 'RFQ_RESPONSE_DUE',
  PO_DELIVERY_APPROACHING: 'PO_DELIVERY_APPROACHING',
  PO_OVERDUE: 'PO_OVERDUE',
  GRN_PENDING_INSPECTION: 'GRN_PENDING_INSPECTION',
  INVOICE_MISMATCH: 'INVOICE_MISMATCH',
  INVOICE_PENDING_APPROVAL: 'INVOICE_PENDING_APPROVAL',
} as const

const EVENT_TO_TYPE: Record<PurchaseNotificationEventKey, string> = {
  prPendingApproval: PURCHASE_NOTIFICATION_TYPES.PR_PENDING_APPROVAL,
  rfqResponseDue: PURCHASE_NOTIFICATION_TYPES.RFQ_RESPONSE_DUE,
  poDeliveryApproaching: PURCHASE_NOTIFICATION_TYPES.PO_DELIVERY_APPROACHING,
  poOverdue: PURCHASE_NOTIFICATION_TYPES.PO_OVERDUE,
  grnPendingInspection: PURCHASE_NOTIFICATION_TYPES.GRN_PENDING_INSPECTION,
  invoiceMismatch: PURCHASE_NOTIFICATION_TYPES.INVOICE_MISMATCH,
  invoicePendingApproval: PURCHASE_NOTIFICATION_TYPES.INVOICE_PENDING_APPROVAL,
}

function safeNotify(promise: Promise<unknown>): void {
  void promise.catch((err) => {
    logger.warn('purchase notification failed', { message: (err as Error).message })
  })
}

async function loadPurchaseNotificationPrefs(
  tenantId: string,
): Promise<PurchaseNotificationPreferences> {
  const row = await prisma.purchaseSettings.findFirst({
    where: { tenantId },
    select: { notificationPreferences: true },
  })
  return normalizeNotificationPreferences(row?.notificationPreferences)
}

async function isEventEnabled(
  tenantId: string,
  event: PurchaseNotificationEventKey,
): Promise<boolean> {
  const prefs = await loadPurchaseNotificationPrefs(tenantId)
  return Boolean(prefs[event]?.inApp)
}

/** Users with a given permission (for fan-out). Caps at 100. */
export async function listUsersWithPermission(
  tenantId: string,
  permission: string,
  excludeUserId?: string | null,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      deletedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      userRoles: {
        some: {
          role: {
            deletedAt: null,
            rolePermissions: {
              some: { permission: { name: permission } },
            },
          },
        },
      },
    },
    select: { id: true },
    take: 100,
  })
  return users.map((u) => u.id)
}

type EmitArgs = {
  tenantId: string
  actorUserId?: string | null
  event: PurchaseNotificationEventKey
  recipientUserIds: string[]
  title: string
  message: string
  priority?: NotificationPriority
  category?: NotificationCategory
  entityType: string
  entityId: string
  entityCode?: string | null
  entityName?: string | null
  actionUrl: string
  primaryAction?: string
  secondaryAction?: string
  dedupeExtra?: string
  metadata?: Record<string, unknown>
  skipSelf?: boolean
}

async function emitPurchaseEvent(args: EmitArgs): Promise<void> {
  const enabled = await isEventEnabled(args.tenantId, args.event)
  if (!enabled) return

  const type = EVENT_TO_TYPE[args.event]
  const recipients = [...new Set(args.recipientUserIds.filter(Boolean))]
  const category = args.category ?? 'APPROVAL'
  const priority = args.priority ?? 'HIGH'
  const skipSelf = args.skipSelf !== false

  for (const recipientUserId of recipients) {
    if (skipSelf && args.actorUserId && args.actorUserId === recipientUserId) {
      continue
    }
    safeNotify(
      notificationService.create({
        tenantId: args.tenantId,
        recipientUserId,
        actorUserId: args.actorUserId,
        category,
        type,
        priority,
        title: args.title,
        message: args.message,
        entityType: args.entityType,
        entityId: args.entityId,
        entityCode: args.entityCode ?? undefined,
        entityName: args.entityName ?? undefined,
        actionUrl: args.actionUrl,
        primaryAction: args.primaryAction ?? 'REVIEW',
        secondaryAction: args.secondaryAction,
        deduplicationKey: buildDedupKey([
          args.tenantId,
          type,
          args.entityId,
          recipientUserId,
          args.dedupeExtra,
        ]),
        sourceEventId: `${type}:${args.entityId}:${recipientUserId}:${args.dedupeExtra ?? ''}`,
        metadata: args.metadata ?? null,
      }),
    )
  }
}

function moneyLabel(amount?: number | null): string | null {
  if (amount == null || !Number.isFinite(amount)) return null
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

export function notifyPrPendingApproval(ctx: {
  tenantId: string
  actorUserId: string
  prId: string
  prNumber: string
  amount?: number | null
}): void {
  safeNotify(
    (async () => {
      const recipients = await listUsersWithPermission(
        ctx.tenantId,
        'purchase.pr.approve',
        ctx.actorUserId,
      )
      if (!recipients.length) return
      await emitPurchaseEvent({
        tenantId: ctx.tenantId,
        actorUserId: ctx.actorUserId,
        event: 'prPendingApproval',
        recipientUserIds: recipients,
        title: 'Purchase requisition pending approval',
        message: [ctx.prNumber, moneyLabel(ctx.amount), 'awaits your approval.']
          .filter(Boolean)
          .join(' · '),
        entityType: 'purchase_requisition',
        entityId: ctx.prId,
        entityCode: ctx.prNumber,
        actionUrl: `/purchase/approvals?documentType=PURCHASE_REQUISITION&documentId=${ctx.prId}`,
        primaryAction: 'REVIEW',
        secondaryAction: 'APPROVE',
        priority: 'HIGH',
        category: 'APPROVAL',
      })
    })(),
  )
}

/** Uses same setup flag as PR pending (no separate PO pending key). */
export function notifyPoPendingApproval(ctx: {
  tenantId: string
  actorUserId: string
  poId: string
  poNumber: string
  amount?: number | null
}): void {
  safeNotify(
    (async () => {
      const prefs = await loadPurchaseNotificationPrefs(ctx.tenantId)
      if (!prefs.prPendingApproval.inApp) return
      const recipients = await listUsersWithPermission(
        ctx.tenantId,
        'purchase.po.approve',
        ctx.actorUserId,
      )
      const pending = await prisma.purchaseApproval.findFirst({
        where: {
          tenantId: ctx.tenantId,
          purchaseOrderId: ctx.poId,
          status: 'PENDING',
        },
        orderBy: { level: 'desc' },
        select: { level: true },
      })
      const levelKey = String(pending?.level ?? 1)
      const type = PURCHASE_NOTIFICATION_TYPES.PO_PENDING_APPROVAL
      for (const recipientUserId of recipients) {
        if (recipientUserId === ctx.actorUserId) continue
        safeNotify(
          notificationService.create({
            tenantId: ctx.tenantId,
            recipientUserId,
            actorUserId: ctx.actorUserId,
            category: 'APPROVAL',
            type,
            priority: 'HIGH',
            title: 'Purchase order pending approval',
            message: [ctx.poNumber, moneyLabel(ctx.amount), 'awaits your approval.']
              .filter(Boolean)
              .join(' · '),
            entityType: 'purchase_order',
            entityId: ctx.poId,
            entityCode: ctx.poNumber,
            actionUrl: `/purchase/approvals?documentType=PURCHASE_ORDER&documentId=${ctx.poId}`,
            primaryAction: 'REVIEW',
            secondaryAction: 'APPROVE',
            deduplicationKey: buildDedupKey([
              ctx.tenantId,
              type,
              ctx.poId,
              recipientUserId,
              levelKey,
            ]),
          }),
        )
      }
    })(),
  )
}

export function notifyInvoicePendingApproval(ctx: {
  tenantId: string
  actorUserId: string
  invoiceId: string
  invoiceNumber: string
  amount?: number | null
  mismatch?: boolean
  mismatchRemarks?: string | null
}): void {
  safeNotify(
    (async () => {
      const recipients = await listUsersWithPermission(
        ctx.tenantId,
        'purchase.invoice.approve',
        ctx.actorUserId,
      )
      await emitPurchaseEvent({
        tenantId: ctx.tenantId,
        actorUserId: ctx.actorUserId,
        event: 'invoicePendingApproval',
        recipientUserIds: recipients,
        title: 'Purchase invoice pending approval',
        message: [ctx.invoiceNumber, moneyLabel(ctx.amount), 'awaits approval.']
          .filter(Boolean)
          .join(' · '),
        entityType: 'purchase_invoice',
        entityId: ctx.invoiceId,
        entityCode: ctx.invoiceNumber,
        actionUrl: `/purchase/invoices/${ctx.invoiceId}`,
        priority: 'HIGH',
        category: 'APPROVAL',
      })
      if (ctx.mismatch) {
        await emitPurchaseEvent({
          tenantId: ctx.tenantId,
          actorUserId: ctx.actorUserId,
          event: 'invoiceMismatch',
          recipientUserIds: recipients,
          title: 'Purchase invoice match exception',
          message: [
            ctx.invoiceNumber,
            '3-way match exceeded tolerance',
            ctx.mismatchRemarks?.trim() || null,
          ]
            .filter(Boolean)
            .join(' · '),
          entityType: 'purchase_invoice',
          entityId: ctx.invoiceId,
          entityCode: ctx.invoiceNumber,
          actionUrl: `/purchase/invoices/${ctx.invoiceId}`,
          priority: 'CRITICAL',
          category: 'RISK',
          dedupeExtra: 'mismatch',
        })
      }
    })(),
  )
}

export function notifyGrnPendingInspection(ctx: {
  tenantId: string
  actorUserId: string
  grnId: string
  grnNumber: string
}): void {
  safeNotify(
    (async () => {
      const quality = await listUsersWithPermission(ctx.tenantId, 'purchase.quality.inspect')
      const incoming = await listUsersWithPermission(ctx.tenantId, 'quality.incoming.view')
      const recipients = [...new Set([...quality, ...incoming])]
      if (!recipients.length) {
        recipients.push(
          ...(await listUsersWithPermission(ctx.tenantId, 'purchase.grn.view')),
        )
      }
      await emitPurchaseEvent({
        tenantId: ctx.tenantId,
        actorUserId: ctx.actorUserId,
        event: 'grnPendingInspection',
        recipientUserIds: recipients,
        title: 'GRN pending quality inspection',
        message: `${ctx.grnNumber} is submitted and awaits inspection.`,
        entityType: 'goods_receipt',
        entityId: ctx.grnId,
        entityCode: ctx.grnNumber,
        actionUrl: `/purchase/grn/${ctx.grnId}`,
        primaryAction: 'OPEN',
        priority: 'HIGH',
        category: 'APPROVAL',
        skipSelf: false,
      })
    })(),
  )
}

/**
 * Scheduler: RFQ due (today/overdue), PO delivery approaching (within 3 days), PO overdue.
 */
export async function scanPurchaseDueNotifications(tenantId: string): Promise<void> {
  try {
    const prefs = await loadPurchaseNotificationPrefs(tenantId)
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const inThreeDays = new Date(startOfToday)
    inThreeDays.setDate(inThreeDays.getDate() + 3)
    const dayKey = startOfToday.toISOString().slice(0, 10)

    if (prefs.rfqResponseDue.inApp) {
      const rfqRows = await prisma.requestForQuotation.findMany({
        where: {
          tenantId,
          deletedAt: null,
          responseDueDate: { not: null, lte: inThreeDays },
          status: { in: ['SENT', 'QUOTATION_RECEIVED', 'UNDER_COMPARISON'] },
        },
        select: {
          id: true,
          rfqNumber: true,
          responseDueDate: true,
          createdById: true,
        },
        take: 80,
      })
      const buyers = await listUsersWithPermission(tenantId, 'purchase.rfq.view')
      for (const rfq of rfqRows) {
        const due = rfq.responseDueDate
        if (!due) continue
        const overdue = due < startOfToday
        const recipients = [...buyers, rfq.createdById].filter(
          (id): id is string => Boolean(id),
        )
        await emitPurchaseEvent({
          tenantId,
          event: 'rfqResponseDue',
          recipientUserIds: recipients,
          title: overdue ? 'RFQ response overdue' : 'RFQ response due soon',
          message: `${rfq.rfqNumber} · due ${due.toISOString().slice(0, 10)}`,
          entityType: 'rfq',
          entityId: rfq.id,
          entityCode: rfq.rfqNumber,
          actionUrl: `/purchase/rfq/${rfq.id}`,
          primaryAction: 'OPEN',
          priority: overdue ? 'CRITICAL' : 'NORMAL',
          category: 'RISK',
          dedupeExtra: dayKey,
          skipSelf: false,
        })
      }
    }

    if (prefs.poDeliveryApproaching.inApp || prefs.poOverdue.inApp) {
      const poRows = await prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          deletedAt: null,
          expectedDeliveryDate: { not: null },
          status: {
            in: [
              'APPROVED',
              'SENT_TO_VENDOR',
              'PARTIALLY_RECEIVED',
              'PARTIALLY_INVOICED',
            ],
          },
        },
        select: {
          id: true,
          orderNumber: true,
          expectedDeliveryDate: true,
          createdById: true,
        },
        take: 120,
      })

      const poViewers = await listUsersWithPermission(tenantId, 'purchase.po.view')
      for (const po of poRows) {
        const due = po.expectedDeliveryDate
        if (!due) continue
        const code = po.orderNumber
        const recipients = [...poViewers, po.createdById].filter(
          (id): id is string => Boolean(id),
        )
        if (due < startOfToday && prefs.poOverdue.inApp) {
          await emitPurchaseEvent({
            tenantId,
            event: 'poOverdue',
            recipientUserIds: recipients,
            title: 'Purchase order delivery overdue',
            message: `${code} · expected ${due.toISOString().slice(0, 10)}`,
            entityType: 'purchase_order',
            entityId: po.id,
            entityCode: code,
            actionUrl: `/purchase/orders/${po.id}`,
            primaryAction: 'OPEN',
            priority: 'CRITICAL',
            category: 'RISK',
            dedupeExtra: dayKey,
            skipSelf: false,
          })
        } else if (
          due >= startOfToday &&
          due <= inThreeDays &&
          prefs.poDeliveryApproaching.inApp
        ) {
          await emitPurchaseEvent({
            tenantId,
            event: 'poDeliveryApproaching',
            recipientUserIds: recipients,
            title: 'PO delivery approaching',
            message: `${code} · expected ${due.toISOString().slice(0, 10)}`,
            entityType: 'purchase_order',
            entityId: po.id,
            entityCode: code,
            actionUrl: `/purchase/orders/${po.id}`,
            primaryAction: 'OPEN',
            priority: 'NORMAL',
            category: 'RISK',
            dedupeExtra: dayKey,
            skipSelf: false,
          })
        }
      }
    }
  } catch (err) {
    logger.warn('purchase due notification scan failed', {
      tenantId,
      message: (err as Error).message,
    })
  }
}
