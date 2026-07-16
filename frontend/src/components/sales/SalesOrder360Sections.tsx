import {
  Building2,
  Calendar,
  Package,
  Truck,
  AlertCircle,
  FileText,
  Factory,
  Gauge,
  Link2,
  Receipt,
  MapPin,
  Hash,
} from 'lucide-react'
import type { SalesOrder, SalesOrderStatus } from '../../types/mrp'
import type { Customer, Product } from '../../types/master'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { formatStatus } from '../ui/Badge'
import { LiveStatusBadge, type LiveTone } from '../premium/LiveStatusBadge'
import { StatusBadge } from '../../design-system/list-page'
import { salesOrderStatusLabel, salesOrderStatusToneKey } from '../../utils/salesOrderStatus'
import { HealthScoreRing } from '../crm/Opportunity360Sections'
import { ErpButton } from '../erp/ErpButton'
import { cn } from '../../utils/cn'
import { useMasterStore } from '../../store/masterStore'
import { locationDisplayLabel } from '../../utils/locationUtils'

const FULFILLMENT_STEPS: { id: SalesOrderStatus; label: string }[] = [
  { id: 'open', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'Production' },
  { id: 'ready_dispatch', label: 'Ready' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'invoiced', label: 'Invoiced' },
]

const STATUS_ORDER: SalesOrderStatus[] = [
  'open', 'confirmed', 'in_production', 'ready_dispatch', 'dispatched', 'invoiced', 'closed',
]

function statusTone(status: SalesOrderStatus): LiveTone {
  if (status === 'open') return 'warning'
  if (status === 'closed' || status === 'invoiced') return 'healthy'
  if (status === 'dispatched' || status === 'ready_dispatch') return 'healthy'
  return 'live'
}

function stepIndex(status: SalesOrderStatus): number {
  if (status === 'closed') return STATUS_ORDER.indexOf('invoiced')
  return Math.max(0, STATUS_ORDER.indexOf(status))
}

export function salesOrderStatusTone(status: SalesOrderStatus): LiveTone {
  return statusTone(status)
}

export function resolveSalesOrderValue(order: SalesOrder, product?: Product): number {
  if (order.grandTotal != null) return order.grandTotal
  if (order.unitPrice != null) return order.unitPrice * order.qty
  if (product?.standardPrice != null) return product.standardPrice * order.qty
  return 0
}

export type SalesOrderHealthFactor = {
  label: string
  ok: boolean
  detail?: string
}

/** Checklist factors for the single Execution Health presentation (expandable). */
export function buildSalesOrderHealthFactors(input: {
  status: SalesOrderStatus
  overdue: boolean
  workOrderCount: number
  dispatchCount: number
  pendingMrp: boolean
  qcHold: boolean
}): SalesOrderHealthFactor[] {
  const confirmed = input.status !== 'open'
  const inFulfilment = ['in_production', 'ready_dispatch', 'dispatched', 'invoiced', 'closed'].includes(input.status)
  return [
    {
      label: 'Order confirmed',
      ok: confirmed,
      detail: confirmed ? formatStatus(input.status) : 'Still draft — confirm to start fulfilment',
    },
    {
      label: 'Delivery date',
      ok: !input.overdue,
      detail: input.overdue ? 'Required date has passed' : 'On schedule',
    },
    {
      label: 'MRP / work orders',
      ok: !input.pendingMrp && (input.workOrderCount > 0 || !confirmed || inFulfilment),
      detail: input.pendingMrp
        ? 'Confirmed but MRP not run'
        : input.workOrderCount > 0
          ? `${input.workOrderCount} work order(s)`
          : confirmed
            ? 'No work orders yet'
            : 'Available after confirmation',
    },
    {
      label: 'Quality hold',
      ok: !input.qcHold,
      detail: input.qcHold ? 'Pending QC on linked work orders' : 'No open QC holds',
    },
    {
      label: 'Dispatch progress',
      ok: input.dispatchCount > 0 || ['dispatched', 'invoiced', 'closed'].includes(input.status),
      detail: input.dispatchCount > 0
        ? `${input.dispatchCount} dispatch plan(s)`
        : 'No dispatch planned yet',
    },
  ]
}

export function OrderHeroCard({
  order,
  customer,
  product,
  workOrderCount,
  healthScore,
  healthFactors = [],
  onOpenCustomer,
}: {
  order: SalesOrder
  customer?: Customer
  product?: Product
  workOrderCount: number
  healthScore: number
  healthFactors?: SalesOrderHealthFactor[]
  onOpenCustomer?: () => void
}) {
  const required = order.requiredDate?.slice(0, 10) ?? ''
  const overdue =
    Boolean(required) &&
    required < new Date().toISOString().slice(0, 10) &&
    !['dispatched', 'closed', 'invoiced'].includes(order.status)
  const daysLeft = required
    ? Math.ceil((new Date(required).getTime() - Date.now()) / 86400000)
    : null
  const orderValue = resolveSalesOrderValue(order, product)
  const unitPrice = order.unitPrice ?? product?.standardPrice

  return (
    <div className="so-360-hero">
      <div className="so-360-hero__glow so-360-hero__glow--a" aria-hidden />
      <div className="so-360-hero__glow so-360-hero__glow--b" aria-hidden />

      <div className="so-360-hero__inner">
        <div className="so-360-hero__main">
          <div className="so-360-hero__badges">
            <StatusBadge
              label={salesOrderStatusLabel(order.status)}
              status={salesOrderStatusToneKey(order.status)}
            />
            {order.source ? (
              <span className="so-360-source-pill">
                {order.source === 'quotation' ? 'From quotation' : 'Direct SO'}
              </span>
            ) : null}
            {overdue ? <LiveStatusBadge label="Past due date" tone="critical" pulse={false} /> : null}
            {!overdue && daysLeft != null && daysLeft <= 14 && daysLeft >= 0 ? (
              <LiveStatusBadge label={`${daysLeft}d to delivery`} tone="warning" pulse={false} />
            ) : null}
          </div>

          <h2 className="so-360-hero__title">{product?.productName ?? 'Sales order'}</h2>

          {customer ? (
            <button
              type="button"
              onClick={onOpenCustomer}
              className="so-360-hero__customer group"
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="font-semibold text-erp-text group-hover:text-erp-primary">
                {customer.customerName}
              </span>
              <span>· {customer.city}</span>
            </button>
          ) : null}

          <div className="so-360-hero__meta">
            <span>
              <Package className="h-3.5 w-3.5" aria-hidden />
              {formatNumber(order.qty)} {product?.baseUomId ? 'nos' : 'units'}
            </span>
            <span>
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              Required {formatDate(order.requiredDate)}
            </span>
            <span>
              <Truck className="h-3.5 w-3.5" aria-hidden />
              {workOrderCount} work order{workOrderCount !== 1 ? 's' : ''}
            </span>
            {order.customerPoNumber ? (
              <span>
                <Hash className="h-3.5 w-3.5" aria-hidden />
                PO {order.customerPoNumber}
              </span>
            ) : null}
          </div>
        </div>

        <div className="so-360-hero__value-block">
          <div className="so-360-hero__value-text">
            <p className="so-360-hero__value-label">Order value</p>
            <p className="so-360-hero__value">{orderValue > 0 ? formatCurrency(orderValue) : '—'}</p>
            {unitPrice != null ? (
              <p className="so-360-hero__value-sub">
                {formatCurrency(unitPrice)} / unit
                {order.discountPct ? ` · ${order.discountPct}% disc` : ''}
              </p>
            ) : null}
          </div>
          <div className="so-360-hero__health" title="Execution health from fulfilment risks">
            <HealthScoreRing score={healthScore} size={68} />
            <div className="so-360-hero__health-meta">
              <p className="so-360-hero__value-label">Execution health</p>
              <p className="so-360-hero__health-pct" aria-label={`Execution health ${healthScore}%`}>
                {healthScore}%
              </p>
              {healthFactors.length > 0 ? (
                <details className="crm-smart-overview__why so-360-hero__why">
                  <summary className="crm-smart-overview__why-summary">Why this score</summary>
                  <ul className="crm-smart-overview__factors">
                    {healthFactors.map((f) => (
                      <li
                        key={f.label}
                        className={cn(
                          'crm-smart-overview__factor',
                          f.ok ? 'crm-smart-overview__factor--ok' : 'crm-smart-overview__factor--warn',
                        )}
                        title={f.detail}
                      >
                        <span aria-hidden>{f.ok ? '✓' : '○'}</span>
                        <span>
                          <span className="crm-smart-overview__factor-label">{f.label}</span>
                          {f.detail ? (
                            <span className="crm-smart-overview__factor-detail">{f.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrderFulfillmentStepper({
  status,
  onStepClick,
}: {
  status: SalesOrderStatus
  onStepClick?: (status: SalesOrderStatus) => void
}) {
  const idx = stepIndex(status)
  const isClosed = status === 'closed'

  return (
    <div className="opp-360-stepper so-360-stepper">
      <div className="opp-360-stepper__head">
        <div>
          <p className="opp-360-stepper__label">Fulfillment pipeline</p>
          <p className="opp-360-stepper__title">
            {isClosed ? 'Order closed' : `Step ${idx + 1} of ${FULFILLMENT_STEPS.length}`}
          </p>
        </div>
        <StatusBadge
          label={salesOrderStatusLabel(status)}
          status={salesOrderStatusToneKey(status)}
        />
      </div>

      {isClosed ? (
        <div className="opp-360-stepper__closed">
          Fulfillment complete — order closed
        </div>
      ) : (
        <div className="opp-360-stepper__track">
          {FULFILLMENT_STEPS.map((s, i) => {
            const isCurrent = s.id === status
            const isPast = i < idx
            return (
              <button
                key={s.id}
                type="button"
                aria-label={s.label}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStepClick?.(s.id)}
                className={cn(
                  'opp-360-stepper__step',
                  isCurrent && 'opp-360-stepper__step--current',
                  isPast && 'opp-360-stepper__step--past',
                )}
              >
                <div className="opp-360-stepper__bar" />
                <span className="opp-360-stepper__step-label">{s.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function OrderExecutionTiles({
  workOrderCount,
  dispatchCount,
  pendingMrp,
  qcHold,
  onOpenProduction,
  onOpenDispatch,
  onTriggerMrp,
}: {
  workOrderCount: number
  dispatchCount: number
  pendingMrp: boolean
  qcHold: boolean
  onOpenProduction?: () => void
  onOpenDispatch?: () => void
  onTriggerMrp?: () => void
}) {
  const tiles = [
    {
      id: 'mrp',
      label: 'MRP / Planning',
      value: pendingMrp ? 'Pending' : 'Planned',
      helper: pendingMrp ? 'Run MRP to create WO' : `${workOrderCount} work order(s)`,
      icon: Gauge,
      tone: pendingMrp ? 'warning' : 'success',
      onClick: pendingMrp ? onTriggerMrp : onOpenProduction,
    },
    {
      id: 'production',
      label: 'Production',
      value: workOrderCount,
      helper: qcHold ? 'QC hold active' : workOrderCount ? 'On shop floor' : 'Not started',
      icon: Factory,
      tone: qcHold ? 'danger' : workOrderCount ? 'primary' : 'neutral',
      onClick: onOpenProduction,
    },
    {
      id: 'dispatch',
      label: 'Dispatch',
      value: dispatchCount,
      helper: dispatchCount ? 'Plans linked' : 'Not scheduled',
      icon: Truck,
      tone: dispatchCount ? 'primary' : 'neutral',
      onClick: onOpenDispatch,
    },
    {
      id: 'billing',
      label: 'Billing',
      value: '—',
      helper: 'Invoice after dispatch',
      icon: Receipt,
      tone: 'neutral' as const,
    },
  ]

  return (
    <div className="so-360-exec-tiles">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          className={cn('so-360-exec-tile', tile.onClick && 'so-360-exec-tile--clickable')}
          onClick={tile.onClick}
          disabled={!tile.onClick}
        >
          <div className="so-360-exec-tile__icon">
            <tile.icon className="h-4 w-4" aria-hidden />
          </div>
          <div className="so-360-exec-tile__body">
            <span className="so-360-exec-tile__label">{tile.label}</span>
            <span className={cn('so-360-exec-tile__value', `so-360-exec-tile__value--${tile.tone}`)}>
              {tile.value}
            </span>
            <span className="so-360-exec-tile__helper">{tile.helper}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

export function OrderLinkageStrip({
  order,
  onNavigate,
}: {
  order: SalesOrder
  onNavigate: (path: string) => void
}) {
  const links = [
    order.opportunityId
      ? { label: 'Opportunity', path: `/crm/opportunities/${order.opportunityId}` }
      : null,
    order.quotationId
      ? { label: order.quotationNo ? `Quote ${order.quotationNo}` : 'Quotation', path: `/crm/quotations/${order.quotationId}` }
      : null,
  ].filter(Boolean) as { label: string; path: string }[]

  if (links.length === 0) return null

  return (
    <div className="so-360-linkage">
      <span className="so-360-linkage__title">
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        CRM chain
      </span>
      <div className="so-360-linkage__items">
        {links.map((link, i) => (
          <span key={link.path} className="so-360-linkage__item-wrap">
            {i > 0 ? <span className="so-360-linkage__sep" aria-hidden>→</span> : null}
            <button type="button" className="so-360-linkage__item" onClick={() => onNavigate(link.path)}>
              {link.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

export function OrderCommercialSummary({
  order,
  product,
}: {
  order: SalesOrder
  product?: Product
}) {
  const orderValue = resolveSalesOrderValue(order, product)
  const unitPrice = order.unitPrice ?? product?.standardPrice
  const subtotal = order.basicAmount ?? (unitPrice != null ? unitPrice * order.qty : null)
  const gst = order.gstAmount

  const rows = [
    { label: 'Quantity', value: formatNumber(order.qty) },
    { label: 'Unit price', value: unitPrice != null ? formatCurrency(unitPrice) : '—' },
    ...(order.discountPct ? [{ label: 'Discount', value: `${order.discountPct}%` }] : []),
    ...(subtotal != null ? [{ label: 'Basic amount', value: formatCurrency(subtotal) }] : []),
    ...(gst != null ? [{ label: 'GST', value: formatCurrency(gst) }] : []),
    { label: 'Payment terms', value: order.paymentTerms ?? '—' },
    { label: 'Delivery terms', value: order.deliveryTerms ?? '—' },
    { label: 'Warranty', value: order.warrantyTerms ?? '—' },
  ]

  return (
    <div className="so-360-commercial">
      <p className="so-360-commercial__title">Commercial summary</p>
      <dl className="so-360-commercial__rows">
        {rows.map((r) => (
          <div key={r.label} className="so-360-commercial__row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="so-360-commercial__total">
        <span>Grand total</span>
        <strong>{orderValue > 0 ? formatCurrency(orderValue) : '—'}</strong>
      </div>
    </div>
  )
}

export function OrderDeliveryCard({ order }: { order: SalesOrder }) {
  const locations = useMasterStore((s) => s.locations)
  const loc = order.locationId ? locations.find((l) => l.id === order.locationId) : null
  const rows = [
    { label: 'Required date', value: formatDate(order.requiredDate), icon: Calendar },
    ...(order.expectedDeliveryDate
      ? [{ label: 'Expected delivery', value: formatDate(order.expectedDeliveryDate), icon: Calendar }]
      : []),
    ...(loc
      ? [{ label: 'Location code', value: locationDisplayLabel(loc), icon: MapPin }]
      : order.deliveryLocation
        ? [{ label: 'Delivery location', value: order.deliveryLocation, icon: MapPin }]
        : []),
    ...(order.shippingAddress
      ? [{ label: 'Ship to', value: order.shippingAddress, icon: Truck }]
      : []),
    ...(order.orderDate
      ? [{ label: 'Order date', value: formatDate(order.orderDate), icon: FileText }]
      : []),
  ]

  return (
    <div className="so-360-delivery">
      <p className="so-360-delivery__title">Delivery &amp; logistics</p>
      <dl className="so-360-delivery__rows">
        {rows.map((r) => (
          <div key={r.label} className="so-360-delivery__row">
            <dt>
              <r.icon className="h-3.5 w-3.5" aria-hidden />
              {r.label}
            </dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function OrderLineItemsPanel({ order }: { order: SalesOrder }) {
  const lines = order.lines ?? []
  if (lines.length === 0) return null

  return (
    <div className="so-360-lines">
      <div className="so-360-lines__head">
        <p className="so-360-lines__title">Line items</p>
        <span className="so-360-lines__meta">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="so-360-lines__table-wrap">
        <table className="erp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>{line.lineNo}</td>
                <td>
                  <span className="font-medium text-erp-text">{line.productOrItem}</span>
                  {line.description ? (
                    <span className="block text-[11px] text-erp-muted">{line.description}</span>
                  ) : null}
                </td>
                <td className="num">{formatNumber(line.qty)}</td>
                <td className="num">{formatCurrency(line.unitPrice)}</td>
                <td className="num font-medium">{formatCurrency(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function OrderNextActionPanel({
  status,
  overdue,
  onConfirm,
  onTriggerMrp,
}: {
  status: SalesOrderStatus
  overdue: boolean
  onConfirm?: () => void
  onTriggerMrp?: () => void
}) {
  if (overdue) {
    return (
      <div className="opp-360-alert opp-360-alert--danger">
        <AlertCircle className="opp-360-alert__icon" aria-hidden />
        <div>
          <p className="opp-360-alert__title">Delivery date at risk</p>
          <p className="opp-360-alert__text">
            Expedite production or agree a revised delivery date with the customer.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'open') {
    return (
      <div className="so-360-action-card so-360-action-card--warn">
        <AlertCircle className="so-360-action-card__icon" aria-hidden />
        <div className="so-360-action-card__body">
          <p className="so-360-action-card__title">Confirm sales order</p>
          <p className="so-360-action-card__text">
            Locks commercial terms and enables MRP / production planning.
          </p>
          {onConfirm ? (
            <ErpButton type="button" size="sm" className="mt-3" onClick={onConfirm}>
              Confirm order
            </ErpButton>
          ) : null}
        </div>
      </div>
    )
  }

  if (status === 'confirmed') {
    return (
      <div className="so-360-action-card so-360-action-card--ready">
        <Package className="so-360-action-card__icon so-360-action-card__icon--success" aria-hidden />
        <div className="so-360-action-card__body">
          <p className="so-360-action-card__title">Ready for MRP</p>
          <p className="so-360-action-card__text">
            Run material planning and create work orders for this order.
          </p>
          {onTriggerMrp ? (
            <ErpButton type="button" size="sm" className="mt-3" onClick={onTriggerMrp}>
              Trigger MRP
            </ErpButton>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="so-360-action-card so-360-action-card--neutral">
      <p className="so-360-action-card__text">
        Order is in <strong className="text-erp-text">{formatStatus(status)}</strong> — track work
        orders and dispatch from the tabs above.
      </p>
    </div>
  )
}
