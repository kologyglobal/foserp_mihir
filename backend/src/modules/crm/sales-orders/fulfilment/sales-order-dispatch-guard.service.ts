import { prisma } from '../../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../../utils/errors.js'

const BLOCKED_DISPATCH_STATUSES = new Set(['closed', 'cancelled'])

/** Block new outbound dispatch create/confirm when the sales order is closed or cancelled. */
export async function assertSalesOrderAllowsDispatch(
  tenantId: string,
  salesOrderId: string,
): Promise<void> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
    select: { status: true, salesOrderNo: true },
  })
  if (!order) throw new NotFoundError('Sales order not found')
  if (BLOCKED_DISPATCH_STATUSES.has(order.status)) {
    throw new InvalidStateError(
      `Cannot dispatch against ${order.status} sales order ${order.salesOrderNo}`,
    )
  }
}
