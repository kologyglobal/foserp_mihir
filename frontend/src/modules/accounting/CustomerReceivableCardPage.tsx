import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  Bell,
  HandCoins,
  Mail,
  Plus,
  ScrollText,
  User,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import {
  CollectionActivityDrawer,
  CreditHoldDialog,
  CreditStatusBadge,
  CreditUtilizationBar,
  CustomerStatementPreview,
  InvoiceStatusBadge,
  ReceiptStatusBadge,
} from '@/components/accounting/receivables'
import { getCustomerReceivableCard } from '@/services/accounting/receivablesService'
import type { CustomerReceivableCard } from '@/types/receivables'
import { RECEIVABLE_AGEING_BUCKETS } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { CrmSourceDocumentPanel } from '@/components/accounting/commercial'
import { listCommercialCommitments } from '@/data/accounting/commercialCommitmentsSeed'
import type { CommercialCommitment } from '@/types/commercialCommitments'

type CardTab =
  | 'overview'
  | 'open_invoices'
  | 'receipts'
  | 'allocations'
  | 'ageing'
  | 'credit_notes'
  | 'disputes'
  | 'collection'
  | 'statements'
  | 'audit'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'open_invoices', label: 'Open Invoices' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'ageing', label: 'Ageing' },
  { id: 'credit_notes', label: 'Credit Notes' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'collection', label: 'Collection Activity' },
  { id: 'statements', label: 'Statements' },
  { id: 'audit', label: 'Audit' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{value ?? '—'}</dd>
    </div>
  )
}

export function CustomerReceivableCardPage() {
  const { customerId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [card, setCard] = useState<CustomerReceivableCard | null>(null)
  const [commercialForCustomer, setCommercialForCustomer] = useState<CommercialCommitment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CardTab>('overview')
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)

  const load = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const [cardResult, commitments] = await Promise.all([
        getCustomerReceivableCard(customerId),
        listCommercialCommitments(),
      ])
      setCard(cardResult)
      setCommercialForCustomer(
        commitments.filter(
          (c) =>
            c.customerId === customerId ||
            c.customerName === cardResult.customer.customerName,
        ),
      )
    } catch {
      setCard(null)
      setCommercialForCustomer([])
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Receivables', to: '/accounting/receivables' },
    { label: card?.customer.customerName ?? 'Customer' },
  ]

  const openCustomerMaster = () => {
    const masterId = card?.customer.masterCustomerId
    if (masterId) navigate(`/entity360/customers/${masterId}`)
    else {
      notify.info('No linked master customer — opening company register.')
      navigate('/masters/companies')
    }
  }

  const secondary = useMemo(() => {
    if (!card) return []
    return [
      ...(perms.canCreateReceipt
        ? [{ id: 'receipt', label: 'Record Receipt', icon: Plus, onClick: () => navigate(`/accounting/receivables/receipts/new?customerId=${customerId}`) }]
        : []),
      ...(perms.canViewStatement
        ? [{ id: 'statement', label: 'View Statement', icon: ScrollText, onClick: () => setStatementOpen(true) }]
        : []),
      ...(perms.canManageCollection
        ? [{ id: 'collection', label: 'Collection Activity', icon: Mail, onClick: () => setCollectionOpen(true) }]
        : []),
      ...(perms.canManagePromise
        ? [{ id: 'promise', label: 'Payment Promise', icon: HandCoins, onClick: () => notify.info('Payment promise — use Collections workspace') }]
        : []),
      ...(perms.canPreviewReminder
        ? [{ id: 'reminder', label: 'Reminder Preview', icon: Bell, onClick: () => navigate('/accounting/receivables/reminders') }]
        : []),
      ...(perms.canManageCreditHold
        ? [{
            id: 'hold',
            label: card.customer.creditStatus === 'Credit Hold' ? 'Release Hold' : 'Credit Hold',
            icon: Ban,
            onClick: () => setHoldOpen(true),
          }]
        : []),
      { id: 'master', label: 'Open Customer Master', icon: User, onClick: openCustomerMaster },
    ]
  }, [card, customerId, navigate, openCustomerMaster, perms])

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Customer" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!card) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={User} title="Customer not found" action={<Link to="/accounting/receivables" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">Back</Link>} />
      </OperationalPageShell>
    )
  }

  const { customer } = card
  const unallocReceipts = card.receipts.filter((r) => r.unallocatedAmount > 0 && r.voucherStatus !== 'Reversed')

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={customer.customerName}
      description={`${customer.customerCode} · ${customer.territory}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/receivables/customer/${customerId}`}
      kpiStrip={[
        { id: 'out', label: 'Outstanding', value: formatCompactCurrency(card.totalOutstanding), accent: 'blue' },
        { id: 'od', label: 'Overdue', value: formatCompactCurrency(card.overdue), accent: 'red' },
        { id: 'credit', label: 'Available credit', value: formatCompactCurrency(card.availableCredit), accent: 'green' },
        { id: 'inv', label: 'Open invoices', value: card.openInvoiceCount, accent: 'slate' },
        { id: 'days', label: 'Avg collection days', value: card.averageCollectionDays, accent: 'amber' },
      ]}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CreditStatusBadge status={customer.creditStatus} />
        {card.alerts.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="h-3 w-3" />
            {a}
          </span>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-erp-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-[12px] font-semibold',
              tab === t.id ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {tab === 'overview' ? (
            <>
              <section className="rounded-lg border border-erp-border p-4">
                <h3 className="mb-3 text-[13px] font-semibold">Receivables summary</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Field label="Total outstanding" value={formatCurrency(card.totalOutstanding)} />
                  <Field label="Overdue" value={formatCurrency(card.overdue)} />
                  <Field label="Dispute amount" value={formatCurrency(card.disputeAmount)} />
                  <Field label="Last receipt" value={card.lastReceipt ? `${card.lastReceipt.receiptNumber} · ${formatCurrency(card.lastReceipt.receiptAmount)}` : '—'} />
                </dl>
              </section>
              <section className="rounded-lg border border-erp-border p-4">
                <h3 className="mb-3 text-[13px] font-semibold">Recent open invoices</h3>
                <ul className="divide-y divide-erp-border/70">
                  {card.openInvoices.filter((i) => i.outstandingBalance > 0).slice(0, 5).map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2 text-[13px]">
                      <TableLink to={`/accounting/receivables/invoice/${i.id}`}>{i.invoiceNumber}</TableLink>
                      <span className="tabular-nums">{formatCurrency(i.outstandingBalance)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {tab === 'open_invoices' ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="erp-table w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                    <th className="px-3 py-2 text-left">Invoice</th>
                    <th className="px-3 py-2 text-left">Due</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {card.openInvoices.filter((i) => i.outstandingBalance > 0).map((i) => (
                    <tr key={i.id} className="border-b border-erp-border/70">
                      <td className="px-3 py-2"><TableLink to={`/accounting/receivables/invoice/${i.id}`}>{i.invoiceNumber}</TableLink></td>
                      <td className="px-3 py-2 tabular-nums">{i.dueDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(i.outstandingBalance)}</td>
                      <td className="px-3 py-2"><InvoiceStatusBadge status={i.invoiceStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'receipts' ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="erp-table w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                    <th className="px-3 py-2 text-left">Receipt</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {card.receipts.map((r) => (
                    <tr key={r.id} className="border-b border-erp-border/70">
                      <td className="px-3 py-2"><TableLink to={`/accounting/receivables/receipts/${r.id}`}>{r.receiptNumber}</TableLink></td>
                      <td className="px-3 py-2 tabular-nums">{r.receiptDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.receiptAmount)}</td>
                      <td className="px-3 py-2"><ReceiptStatusBadge status={r.voucherStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'allocations' ? (
            <div className="space-y-2">
              {unallocReceipts.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No unallocated receipts.</p>
              ) : (
                unallocReceipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-erp-border px-3 py-2 text-[13px]">
                    <TableLink to={`/accounting/receivables/receipts/${r.id}`}>{r.receiptNumber}</TableLink>
                    <span className="tabular-nums text-amber-800">{formatCurrency(r.unallocatedAmount)} unallocated</span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === 'ageing' ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {RECEIVABLE_AGEING_BUCKETS.map((b) => (
                <div key={b} className="flex justify-between rounded-md border border-erp-border px-3 py-2 text-[13px]">
                  <dt>{b}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(card.ageing[b] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {tab === 'credit_notes' ? (
            <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
              {card.creditNotes.map((cn) => (
                <li key={cn.id} className="flex justify-between px-3 py-2 text-[13px]">
                  <span>{cn.creditNoteNumber}</span>
                  <span className="tabular-nums">{formatCurrency(cn.remainingAmount)}</span>
                </li>
              ))}
              {card.creditNotes.length === 0 ? <li className="px-3 py-4 text-erp-muted">No credit notes.</li> : null}
            </ul>
          ) : null}

          {tab === 'disputes' ? (
            <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
              {card.disputes.map((d) => (
                <li key={d.id} className="px-3 py-2 text-[13px]">
                  <span className="font-medium">{d.disputeNumber}</span> — {d.invoiceNumber} · {formatCurrency(d.disputedAmount)}
                </li>
              ))}
              {card.disputes.length === 0 ? <li className="px-3 py-4 text-erp-muted">No disputes.</li> : null}
            </ul>
          ) : null}

          {tab === 'collection' ? (
            <ul className="space-y-2">
              {card.activities.map((a) => (
                <li key={a.id} className="rounded-md border border-erp-border px-3 py-2 text-[13px]">
                  <span className="font-medium">{a.activityType}</span> — {a.outcome}
                  <p className="text-[11px] text-erp-muted">{a.activityDate} · {a.notes}</p>
                </li>
              ))}
              {card.activities.length === 0 ? <p className="text-erp-muted">No collection activity.</p> : null}
            </ul>
          ) : null}

          {tab === 'statements' ? (
            <p className="text-[13px] text-erp-muted">
              Use <button type="button" className="font-medium text-sky-700 hover:underline" onClick={() => setStatementOpen(true)}>View Statement</button> to preview customer statement (demo).
            </p>
          ) : null}

          {tab === 'audit' && perms.canViewAudit ? (
            <ul className="space-y-2">
              {card.audit.map((a) => (
                <li key={a.id} className="rounded-md border border-erp-border px-3 py-2 text-[13px]">
                  <span className="font-medium">{a.action}</span> — {a.details}
                  <p className="text-[11px] text-erp-muted">{a.performedBy} · {formatDateTime(a.performedAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="space-y-4">
          {commercialForCustomer[0] ? (
            <>
              <CrmSourceDocumentPanel
                source={{
                  customerId: commercialForCustomer[0].customerId,
                  customerName: commercialForCustomer[0].customerName,
                  opportunityId: commercialForCustomer[0].opportunityId,
                  opportunityNo: commercialForCustomer[0].opportunityName,
                  opportunityStage: commercialForCustomer[0].opportunityStage,
                  quotationId: commercialForCustomer[0].quotationId,
                  quotationNo: commercialForCustomer[0].quotationNo,
                  quotationRevision: commercialForCustomer[0].quotationRevision,
                  quotationHeaderStatus: commercialForCustomer[0].quotationHeaderStatus,
                  quotationDocumentStatus: commercialForCustomer[0].quotationDocumentStatus,
                  customerApprovalStatus: commercialForCustomer[0].customerApprovalStatus,
                  salesOrderId: commercialForCustomer[0].salesOrderId,
                  salesOrderNo: commercialForCustomer[0].salesOrderNo,
                  salesOrderStatus: commercialForCustomer[0].salesOrderStatus,
                  ownerName: commercialForCustomer[0].ownerName,
                  accountingStatus: commercialForCustomer[0].accountingStatus,
                }}
              />
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-[12px]">
                <p className="font-semibold text-amber-900">Pending Commercial Value</p>
                <p className="mt-1 tabular-nums font-semibold">
                  {formatCurrency(
                    commercialForCustomer
                      .filter((c) => c.accountingStatus !== 'posted')
                      .reduce((s, c) => s + c.commercialValue, 0),
                  )}
                </p>
                <p className="mt-1 text-erp-muted">Not included in posted outstanding.</p>
                {(commercialForCustomer[0].latestActivityLabel || commercialForCustomer[0].nextFollowUpLabel) && (
                  <dl className="mt-2 space-y-1 border-t border-amber-200/80 pt-2">
                    {commercialForCustomer[0].latestActivityLabel ? (
                      <div>
                        <dt className="text-erp-muted">Latest activity</dt>
                        <dd>{commercialForCustomer[0].latestActivityLabel}</dd>
                      </div>
                    ) : null}
                    {commercialForCustomer[0].nextFollowUpLabel ? (
                      <div>
                        <dt className="text-erp-muted">Next follow-up</dt>
                        <dd>
                          {commercialForCustomer[0].nextFollowUpLabel}
                          {commercialForCustomer[0].nextFollowUpDue
                            ? ` · due ${commercialForCustomer[0].nextFollowUpDue}`
                            : ''}
                          {commercialForCustomer[0].nextFollowUpStatus
                            ? ` · ${commercialForCustomer[0].nextFollowUpStatus}`
                            : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                )}
                <Link
                  to="/accounting/commercial-commitments"
                  className="mt-2 inline-block font-semibold text-erp-primary hover:underline"
                >
                  View Commercial Commitments →
                </Link>
              </div>
            </>
          ) : null}
          <div className="rounded-lg border border-erp-border bg-erp-surface-alt/30 p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Fact box</h3>
          <dl className="space-y-3">
            <Field label="Contact" value={`${customer.contactPerson} · ${customer.mobile}`} />
            <Field label="Email" value={customer.email} />
            <Field label="Billing address" value={customer.billingAddress} />
            <Field label="Shipping address" value={customer.shippingAddress} />
            <Field label="GST" value={customer.gstNumber ? `${customer.gstNumber} (${customer.gstRegistrationType})` : '—'} />
            <Field label="Payment terms" value={customer.paymentTerms} />
            <Field label="Credit limit" value={formatCurrency(customer.creditLimit)} />
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Credit utilization</dt>
              <dd className="mt-1">
                <CreditUtilizationBar used={card.totalOutstanding} limit={customer.creditLimit} />
              </dd>
            </div>
            <Field label="Salesperson" value={customer.salesperson} />
            <Field label="Collection owner" value={customer.collectionOwner} />
          </dl>
        </div>
        </aside>
      </div>

      <CollectionActivityDrawer
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        customerSummary={{
          customerId,
          customerName: customer.customerName,
          outstanding: card.totalOutstanding,
          overdue: card.overdue,
          creditLimit: customer.creditLimit,
          oldestDueDate: card.openInvoices.find((i) => i.outstandingBalance > 0)?.dueDate ?? null,
          collectionOwner: customer.collectionOwner,
        }}
        onSaved={() => void load()}
      />
      <CustomerStatementPreview open={statementOpen} onClose={() => setStatementOpen(false)} customerId={customerId} customerName={customer.customerName} />
      <CreditHoldDialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        customerId={customerId}
        customerName={customer.customerName}
        creditStatus={customer.creditStatus}
        onSaved={() => void load()}
      />
    </OperationalPageShell>
  )
}
