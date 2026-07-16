import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  Building2,
  HandCoins,
  Plus,
  ScrollText,
  Truck,
  User,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import {
  BankVerificationStatusBadge,
  PayableAuditDrawer,
  PayableInvoiceStatusBadge,
  PaymentHoldDialog,
  VendorPaymentStatusBadge,
  VendorStatementPreview,
} from '@/components/accounting/payables'
import { getPayablesAuditTrail, getVendorPayablesCard, PayablesServiceError } from '@/services/accounting/payablesService'
import type { PayablesAuditEntry, VendorPayablesCard } from '@/types/payables'
import { PAYABLE_AGEING_BUCKETS } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type CardTab =
  | 'overview'
  | 'open_invoices'
  | 'payments'
  | 'allocations'
  | 'ageing'
  | 'advances'
  | 'debit_notes'
  | 'disputes'
  | 'statements'
  | 'audit'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'open_invoices', label: 'Open Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'ageing', label: 'Ageing' },
  { id: 'advances', label: 'Advances' },
  { id: 'debit_notes', label: 'Debit Notes' },
  { id: 'disputes', label: 'Disputes' },
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

export function VendorPayablesCardPage() {
  const { vendorId = '' } = useParams()
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [card, setCard] = useState<VendorPayablesCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CardTab>('overview')
  const [statementOpen, setStatementOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState<PayablesAuditEntry[]>([])

  const load = useCallback(async () => {
    if (!vendorId) return
    setLoading(true)
    try {
      setCard(await getVendorPayablesCard(vendorId))
    } catch {
      setCard(null)
    } finally {
      setLoading(false)
    }
  }, [vendorId])

  useEffect(() => {
    void load()
  }, [load])

  const openVendorMaster = () => {
    const masterId = card?.vendor.masterVendorId
    if (masterId) {
      navigate(`/masters/vendors/${masterId}`)
      return
    }
    notify.info('No linked vendor master — opening vendor register.')
    navigate('/masters/vendors')
  }

  const openAudit = async () => {
    if (!vendorId) return
    try {
      const entries = await getPayablesAuditTrail(undefined, vendorId)
      setAuditEntries(entries.length ? entries : await getPayablesAuditTrail())
      setAuditOpen(true)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Failed to load audit trail')
    }
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Payables', to: '/accounting/payables' },
    { label: 'Vendor Outstanding', to: '/accounting/payables/outstanding' },
    { label: card?.vendor.name ?? 'Vendor' },
  ]

  const secondary = useMemo(() => {
    if (!card) return []
    return [
      ...(perms.canCreatePayment
        ? [{ id: 'payment', label: 'Create Payment', icon: Plus, onClick: () => navigate(`/accounting/payables/payments/new?vendorId=${vendorId}`) }]
        : []),
      ...(perms.canCreatePaymentProposal
        ? [{ id: 'proposal', label: 'Payment Proposal', icon: HandCoins, onClick: () => navigate('/accounting/payables/payment-proposals') }]
        : []),
      ...(perms.canViewStatement
        ? [{ id: 'statement', label: 'Statement', icon: ScrollText, onClick: () => setStatementOpen(true) }]
        : []),
      ...(perms.canManagePaymentHold
        ? [{
            id: 'hold',
            label: card.vendor.status === 'On Hold' ? 'Release Hold' : 'Payment Hold',
            icon: Ban,
            onClick: () => setHoldOpen(true),
          }]
        : []),
      { id: 'master', label: 'Open Vendor Master', icon: User, onClick: openVendorMaster },
    ]
  }, [card, navigate, openVendorMaster, perms, vendorId])

  if (!perms.canViewVendor) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Vendor" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={Truck} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Vendor" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!card) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={Truck} title="Vendor not found" action={<Link to="/accounting/payables/outstanding" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">Back</Link>} />
      </OperationalPageShell>
    )
  }

  const { vendor, outstanding } = card
  const unallocPayments = card.recentPayments.filter((p) => p.unallocatedAmount > 0 && p.status === 'Posted')
  const ageingSummary = PAYABLE_AGEING_BUCKETS.reduce(
    (acc, bucket) => {
      acc[bucket] = card.openInvoices
        .filter((i) => i.ageingBucket === bucket)
        .reduce((s, i) => s + i.outstandingBalance, 0)
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={vendor.name}
      description={`${vendor.code} · ${vendor.category} · ${vendor.state}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/payables/vendor/${vendorId}`}
      kpiStrip={[
        { id: 'out', label: 'Outstanding', value: formatCompactCurrency(outstanding.totalOutstanding), accent: 'blue' },
        { id: 'od', label: 'Overdue', value: formatCompactCurrency(outstanding.overdueAmount), accent: 'red' },
        { id: 'adv', label: 'Advances', value: formatCompactCurrency(outstanding.advanceBalance), accent: 'green' },
        { id: 'dn', label: 'Debit notes', value: formatCompactCurrency(outstanding.debitNoteBalance), accent: 'amber' },
        { id: 'inv', label: 'Open invoices', value: outstanding.openInvoiceCount, accent: 'slate' },
      ]}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            vendor.status === 'On Hold' ? 'bg-red-50 text-red-900 ring-red-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200',
          )}
        >
          {vendor.status}
        </span>
        {vendor.msmeCategory !== 'Not MSME' ? (
          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-200">
            MSME · {vendor.msmeCategory}
          </span>
        ) : null}
        <BankVerificationStatusBadge status={vendor.bankVerificationStatus} />
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
                <h3 className="mb-3 text-[13px] font-semibold">Payables summary</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Field label="Total outstanding" value={formatCurrency(outstanding.totalOutstanding)} />
                  <Field label="Overdue" value={formatCurrency(outstanding.overdueAmount)} />
                  <Field label="Dispute amount" value={formatCurrency(outstanding.disputeAmount)} />
                  <Field label="Unallocated payments" value={formatCurrency(outstanding.unallocatedPayment)} />
                  <Field label="Credit utilization" value={`${outstanding.creditUtilization}%`} />
                  <Field
                    label="Last payment"
                    value={
                      outstanding.lastPaymentDate
                        ? `${outstanding.lastPaymentDate} · ${formatCurrency(outstanding.lastPaymentAmount)}`
                        : '—'
                    }
                  />
                </dl>
              </section>
              <section className="rounded-lg border border-erp-border p-4">
                <h3 className="mb-3 text-[13px] font-semibold">Recent open invoices</h3>
                <ul className="divide-y divide-erp-border/70">
                  {card.openInvoices.slice(0, 5).map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2 text-[13px]">
                      <TableLink to={`/accounting/payables/invoices/${i.id}`}>{i.invoiceNumber}</TableLink>
                      <span className="tabular-nums">{formatCurrency(i.outstandingBalance)}</span>
                    </li>
                  ))}
                  {card.openInvoices.length === 0 ? <li className="py-2 text-erp-muted">No open invoices.</li> : null}
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
                  {card.openInvoices.map((i) => (
                    <tr key={i.id} className="border-b border-erp-border/70">
                      <td className="px-3 py-2">
                        <TableLink to={`/accounting/payables/invoices/${i.id}`}>{i.invoiceNumber}</TableLink>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{i.dueDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(i.outstandingBalance)}</td>
                      <td className="px-3 py-2">
                        <PayableInvoiceStatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'payments' ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="erp-table w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                    <th className="px-3 py-2 text-left">Payment</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {card.recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-erp-border/70">
                      <td className="px-3 py-2">
                        <TableLink to={`/accounting/payables/payments/${p.id}`}>{p.paymentNumber}</TableLink>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{p.paymentDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.amount)}</td>
                      <td className="px-3 py-2">
                        <VendorPaymentStatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'allocations' ? (
            <div className="space-y-2">
              {unallocPayments.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No unallocated payments.</p>
              ) : (
                unallocPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-erp-border px-3 py-2 text-[13px]">
                    <TableLink to={`/accounting/payables/payments/${p.id}`}>{p.paymentNumber}</TableLink>
                    <span className="tabular-nums text-amber-800">{formatCurrency(p.unallocatedAmount)} unallocated</span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === 'ageing' ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {PAYABLE_AGEING_BUCKETS.map((b) => (
                <div key={b} className="flex justify-between rounded-md border border-erp-border px-3 py-2 text-[13px]">
                  <dt>{b}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(ageingSummary[b] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {tab === 'advances' ? (
            <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
              {card.advances.map((a) => (
                <li key={a.id} className="flex justify-between px-3 py-2 text-[13px]">
                  <span>{a.advanceNumber}</span>
                  <span className="tabular-nums">{formatCurrency(a.remainingAmount)}</span>
                </li>
              ))}
              {card.advances.length === 0 ? <li className="px-3 py-4 text-erp-muted">No advances.</li> : null}
            </ul>
          ) : null}

          {tab === 'debit_notes' ? (
            <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
              {card.debitNotes.map((dn) => (
                <li key={dn.id} className="flex justify-between px-3 py-2 text-[13px]">
                  <span>{dn.debitNoteNumber}</span>
                  <span className="tabular-nums">{formatCurrency(dn.remainingAmount)}</span>
                </li>
              ))}
              {card.debitNotes.length === 0 ? <li className="px-3 py-4 text-erp-muted">No debit notes.</li> : null}
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

          {tab === 'statements' ? (
            <p className="text-[13px] text-erp-muted">
              Use{' '}
              <button type="button" className="font-medium text-sky-700 hover:underline" onClick={() => setStatementOpen(true)}>
                View Statement
              </button>{' '}
              to preview vendor statement (demo).
            </p>
          ) : null}

          {tab === 'audit' && perms.canViewAudit ? (
            <div className="space-y-2">
              <button type="button" className="erp-btn erp-btn-ghost h-8 px-3 text-[12px]" onClick={() => void openAudit()}>
                Open full audit drawer
              </button>
              <ul className="space-y-2">
                {card.paymentHolds.map((h) => (
                  <li key={h.id} className="rounded-md border border-erp-border px-3 py-2 text-[13px]">
                    <span className="font-medium">Hold · {h.reason}</span>
                    <p className="text-[11px] text-erp-muted">
                      {h.placedBy} · {formatDateTime(h.placedAt)}
                    </p>
                  </li>
                ))}
                {card.paymentHolds.length === 0 ? <p className="text-erp-muted">No active holds on record.</p> : null}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="hidden rounded-lg border border-erp-border bg-erp-surface-alt/30 p-4 lg:block">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <Building2 className="h-4 w-4 text-erp-muted" />
            Fact box
          </h3>
          <dl className="space-y-3">
            <Field label="Contact" value={`${vendor.contactPerson} · ${vendor.mobile}`} />
            <Field label="Email" value={vendor.email} />
            <Field label="GST" value={vendor.gstin ?? '—'} />
            <Field label="PAN" value={vendor.pan ?? '—'} />
            <Field label="MSME" value={vendor.msmeCategory !== 'Not MSME' ? `${vendor.msmeCategory} · ${vendor.msmeStatus}` : 'Not applicable'} />
            <Field label="Bank verification" value={<BankVerificationStatusBadge status={vendor.bankVerificationStatus} />} />
            <Field label="Payment terms" value={vendor.paymentTerms} />
            <Field label="Credit days" value={vendor.creditDays} />
            <Field label="Credit limit" value={formatCurrency(vendor.creditLimit)} />
            <Field label="Buyer" value={vendor.buyer} />
            <Field label="Vendor group" value={vendor.vendorGroup} />
          </dl>
        </aside>
      </div>

      <VendorStatementPreview
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        vendorId={vendorId}
        vendorName={vendor.name}
      />
      <PaymentHoldDialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        vendorId={vendorId}
        vendorName={vendor.name}
        vendorStatus={vendor.status}
        onSaved={() => void load()}
      />
      <PayableAuditDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={vendorId}
        entityLabel={vendor.name}
        entries={auditEntries.map((e) => ({
          id: e.id,
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          details: e.details,
          performedBy: e.performedBy,
          performedAt: e.performedAt,
          isDemo: e.isDemo,
        }))}
      />
    </OperationalPageShell>
  )
}
