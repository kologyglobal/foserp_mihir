/**
 * Tenant commercial O2C rules from DispatchSettings (partial / multi / invoice / POD).
 */
import { prisma } from '../../../config/prisma.js'
import { UnprocessableEntityError, ValidationError } from '../../../utils/errors.js'
import {
  allowsConsolidatedInvoice,
  isAutoInvoiceMode,
  resolveDispatchPostingPolicy,
} from '../posting/dispatch-policy.js'
import { assertPodAllowsInvoice } from '../pod/dispatch-pod.service.js'

const QTY_EPS = 1e-9

/** When allowPartialDispatch is false, draft qty must equal remaining-to-dispatch. */
export async function assertPartialDispatchAllowed(
  tenantId: string,
  qty: number,
  remainingToDispatchQty: number,
  label: string,
): Promise<void> {
  const policy = await resolveDispatchPostingPolicy(tenantId, { forceHardened: true })
  if (policy.allowPartialDispatch) return
  if (Math.abs(qty - remainingToDispatchQty) > QTY_EPS) {
    throw new ValidationError(
      `Partial dispatch is disabled — quantity for ${label} must equal remaining ${remainingToDispatchQty} (got ${qty})`,
      [{ field: 'quantity', message: 'PARTIAL_DISPATCH_DISABLED' }],
    )
  }
}

/**
 * When allowMultipleDispatches is false, block a second open outbound line
 * (DRAFT or CONFIRMED) for the same sales order line.
 */
export async function assertMultipleDispatchesAllowed(
  tenantId: string,
  salesOrderLineId: string | null | undefined,
  options?: { excludeOutboundDispatchId?: string },
): Promise<void> {
  if (!salesOrderLineId) return
  const policy = await resolveDispatchPostingPolicy(tenantId, { forceHardened: true })
  if (policy.allowMultipleDispatches) return

  const existing = await prisma.outboundDispatchLine.findFirst({
    where: {
      tenantId,
      salesOrderLineId,
      ...(options?.excludeOutboundDispatchId
        ? { outboundDispatchId: { not: options.excludeOutboundDispatchId } }
        : {}),
      outboundDispatch: {
        tenantId,
        deletedAt: null,
        status: { in: ['DRAFT', 'CONFIRMED'] },
      },
    },
    select: {
      id: true,
      outboundDispatch: { select: { dispatchNo: true, status: true } },
    },
  })
  if (existing) {
    throw new ValidationError(
      `Multiple dispatches are disabled — SO line already has open dispatch ${existing.outboundDispatch.dispatchNo} (${existing.outboundDispatch.status})`,
      [{ field: 'salesOrderLineId', message: 'MULTIPLE_DISPATCHES_DISABLED' }],
    )
  }
}

/**
 * Enforce invoice mode + POD on manual Invoice Ready / SI create from outbound lines.
 */
export async function assertDispatchInvoiceCommercialPolicy(
  tenantId: string,
  outboundDispatchIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(outboundDispatchIds.filter(Boolean))]
  if (uniqueIds.length === 0) return

  const policy = await resolveDispatchPostingPolicy(tenantId, { forceHardened: true })

  if (uniqueIds.length > 1 && !allowsConsolidatedInvoice(policy.invoiceMode)) {
    throw new UnprocessableEntityError(
      'Invoice mode is ONE_PER_DISPATCH — select lines from a single outbound dispatch (or switch tenant settings to CONSOLIDATED)',
      'INVOICE_MODE_ONE_PER_DISPATCH',
    )
  }

  for (const id of uniqueIds) {
    await assertPodAllowsInvoice(tenantId, id)
  }
}

export async function shouldAutoCreateSalesInvoice(tenantId: string): Promise<{
  allowed: boolean
  reason?: string
}> {
  const policy = await resolveDispatchPostingPolicy(tenantId, { forceHardened: true })
  if (!isAutoInvoiceMode(policy.invoiceMode)) {
    return {
      allowed: false,
      reason: `invoiceMode=${policy.invoiceMode} (auto SI only when ONE_PER_DISPATCH)`,
    }
  }
  return { allowed: true }
}
