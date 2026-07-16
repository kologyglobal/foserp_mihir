import { type ReactNode } from 'react'
import { Download, ExternalLink, Printer, ScrollText, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LedgerDrawerShell } from './LedgerDrawerShell'
import { LedgerStatusBadge } from './LedgerStatusBadge'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import type { LedgerEntry, LedgerEntryAuditEvent } from '@/types/ledgerEntries'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b border-erp-border pb-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function YesNo({ value }: { value: boolean }) {
  return <span className={value ? 'text-emerald-700' : 'text-erp-muted'}>{value ? 'Yes' : 'No'}</span>
}

export function LedgerEntryDetailsDrawer({
  open,
  onClose,
  entry,
  auditEvents,
  onOpenVoucher,
  onOpenAccount,
  onOpenSource,
  onPrint,
  onExport,
  onViewAudit,
}: {
  open: boolean
  onClose: () => void
  entry: LedgerEntry | null
  auditEvents?: LedgerEntryAuditEvent[]
  onOpenVoucher?: (entry: LedgerEntry) => void
  onOpenAccount?: (entry: LedgerEntry) => void
  onOpenSource?: (entry: LedgerEntry) => void
  onPrint?: (entry: LedgerEntry) => void
  onExport?: (entry: LedgerEntry) => void
  onViewAudit?: (entry: LedgerEntry) => void
}) {
  if (!entry) return null

  const sourceHref = entry.sourceDocument?.href ?? null

  return (
    <LedgerDrawerShell
      open={open}
      onClose={onClose}
      title={entry.entryNumber}
      subtitle={`${entry.voucherNumber} · ${entry.postingDate}`}
      widthClassName="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {onOpenVoucher && entry.voucherId ? (
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold"
                onClick={() => onOpenVoucher(entry)}
              >
                <ScrollText className="mr-1 inline h-3.5 w-3.5" />
                Open voucher
              </button>
            ) : null}
            {onOpenAccount ? (
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold"
                onClick={() => onOpenAccount(entry)}
              >
                Open account
              </button>
            ) : null}
            {onOpenSource && entry.sourceDocument ? (
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold"
                onClick={() => onOpenSource(entry)}
              >
                Source document
              </button>
            ) : null}
            {onViewAudit ? (
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold"
                onClick={() => onViewAudit(entry)}
              >
                <Shield className="mr-1 inline h-3.5 w-3.5" />
                Audit ({auditEvents?.length ?? 0})
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {onPrint ? (
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] font-semibold"
                onClick={() => onPrint(entry)}
              >
                <Printer className="mr-1 inline h-3.5 w-3.5" />
                Print
              </button>
            ) : null}
            {onExport ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[12px] font-semibold"
                onClick={() => onExport(entry)}
              >
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Export
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <DetailSection title="Summary">
          <Field label="Entry number" value={entry.entryNumber} />
          <Field label="Status" value={<LedgerStatusBadge status={entry.status} isPreviewOnly={entry.isPreviewOnly} />} />
          <Field label="Posting date" value={entry.postingDate} />
          <Field label="Document date" value={entry.documentDate} />
          <Field label="Debit" value={<span className="tabular-nums">{formatCurrency(entry.debit)}</span>} />
          <Field label="Credit" value={<span className="tabular-nums">{formatCurrency(entry.credit)}</span>} />
          <Field
            label="Running balance"
            value={
              <span className="tabular-nums">
                {formatCurrency(Math.abs(entry.runningBalance))} {entry.runningBalanceSide}
              </span>
            }
          />
          <Field label="Narration" value={entry.narration || '—'} />
          <Field label="Reference" value={entry.referenceNumber || '—'} />
          <Field label="External document" value={entry.externalDocumentNumber || '—'} />
        </DetailSection>

        <DetailSection title="Account">
          <Field label="Code" value={entry.account.code} />
          <Field label="Name" value={entry.account.name} />
          <Field label="Category" value={entry.account.category} />
          <Field label="Account type" value={entry.account.accountType} />
          <Field label="Normal balance" value={entry.account.normalBalance} />
          <Field label="Control account type" value={entry.account.controlAccountType ?? '—'} />
        </DetailSection>

        <DetailSection title="Voucher">
          <Field label="Voucher number" value={entry.voucherNumber} />
          <Field label="Voucher type" value={entry.voucherType} />
          <Field label="Currency" value={entry.currency} />
          <Field label="Exchange rate" value={entry.exchangeRate} />
          <Field
            label="Base currency amount"
            value={<span className="tabular-nums">{formatCurrency(entry.baseCurrencyAmount)}</span>}
          />
        </DetailSection>

        <DetailSection title="Party">
          {entry.party ? (
            <>
              <Field label="Party name" value={entry.party.partyName} />
              <Field label="Party code" value={entry.party.partyCode} />
              <Field label="Party type" value={entry.party.partyType} />
              <Field label="GST number" value={entry.party.gstNumber ?? '—'} />
            </>
          ) : (
            <Field label="Party" value="—" />
          )}
        </DetailSection>

        <DetailSection title="Dimensions">
          <Field label="Company" value={entry.dimensions.company ?? '—'} />
          <Field label="Location" value={entry.dimensions.locationName ?? '—'} />
          <Field label="Plant" value={entry.dimensions.plantName ?? '—'} />
          <Field label="Department" value={entry.dimensions.departmentName ?? '—'} />
          <Field
            label="Cost centre"
            value={
              entry.dimensions.costCentreCode
                ? `${entry.dimensions.costCentreCode} — ${entry.dimensions.costCentreName}`
                : '—'
            }
          />
          <Field
            label="Project"
            value={
              entry.dimensions.projectCode ? `${entry.dimensions.projectCode} — ${entry.dimensions.projectName}` : '—'
            }
          />
          <Field label="Business unit" value={entry.dimensions.businessUnit ?? '—'} />
        </DetailSection>

        <DetailSection title="Manufacturing">
          <Field label="Production order" value={entry.manufacturing.productionOrder ?? '—'} />
          <Field label="Work centre" value={entry.manufacturing.workCentre ?? '—'} />
          <Field label="Machine centre" value={entry.manufacturing.machineCentre ?? '—'} />
          <Field label="Item code" value={entry.manufacturing.itemCode ?? '—'} />
          <Field label="Item name" value={entry.manufacturing.itemName ?? '—'} />
          <Field label="Item category" value={entry.manufacturing.itemCategory ?? '—'} />
          <Field label="Batch number" value={entry.manufacturing.batchNumber ?? '—'} />
          <Field label="Job work order" value={entry.manufacturing.jobWorkOrder ?? '—'} />
          <Field label="Mfg. account type" value={entry.manufacturing.manufacturingAccountType ?? '—'} />
          <Field label="Cost type" value={entry.manufacturing.costType ?? '—'} />
        </DetailSection>

        <DetailSection title="Tax">
          <Field label="GST applicable" value={<YesNo value={entry.tax.gstApplicable} />} />
          <Field label="GST type" value={entry.tax.gstType ?? '—'} />
          <Field label="GST rate" value={entry.tax.gstRate != null ? `${entry.tax.gstRate}%` : '—'} />
          <Field label="TDS applicable" value={<YesNo value={entry.tax.tdsApplicable} />} />
          <Field label="TDS section" value={entry.tax.tdsSection ?? '—'} />
          <Field
            label="Taxable amount"
            value={
              entry.tax.taxableAmount != null ? (
                <span className="tabular-nums">{formatCurrency(entry.tax.taxableAmount)}</span>
              ) : (
                '—'
              )
            }
          />
        </DetailSection>

        <DetailSection title="Source">
          {entry.sourceDocument ? (
            <>
              <Field label="Module" value={entry.sourceDocument.module} />
              <Field label="Document type" value={entry.sourceDocument.documentType} />
              <Field label="Document number" value={entry.sourceDocument.documentNumber} />
              <Field label="Document date" value={entry.sourceDocument.documentDate} />
              <Field label="Party" value={entry.sourceDocument.partyName ?? '—'} />
              <Field
                label="Amount"
                value={
                  entry.sourceDocument.amount != null ? (
                    <span className="tabular-nums">{formatCurrency(entry.sourceDocument.amount)}</span>
                  ) : (
                    '—'
                  )
                }
              />
              <Field label="Status" value={entry.sourceDocument.status} />
              <Field
                label="Route"
                value={
                  sourceHref ? (
                    <Link to={sourceHref} className="inline-flex items-center gap-1 text-erp-primary hover:underline">
                      Open document
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : (
                    <span className="text-erp-muted">Route not yet available</span>
                  )
                }
              />
            </>
          ) : (
            <Field label="Source document" value="—" />
          )}
        </DetailSection>

        <DetailSection title="Reversal">
          {entry.reversal ? (
            <>
              <Field label="Original voucher" value={entry.reversal.originalVoucherNumber ?? '—'} />
              <Field label="Reversal voucher" value={entry.reversal.reversalVoucherNumber ?? '—'} />
              <Field label="Reversal date" value={entry.reversal.reversalDate ?? '—'} />
              <Field label="Reason" value={entry.reversal.reversalReason ?? '—'} />
            </>
          ) : (
            <Field label="Reversal" value="—" />
          )}
        </DetailSection>

        <DetailSection title="Audit">
          <Field label="Created by" value={entry.createdBy} />
          <Field label="Created at" value={formatDateTime(entry.createdAt)} />
          <Field label="Posted by" value={entry.postedBy} />
          <Field label="Posted at" value={formatDateTime(entry.postedAt)} />
          <Field label="Has attachments" value={<YesNo value={entry.hasAttachments} />} />
          {auditEvents && auditEvents.length > 0 ? (
            <div className="col-span-full">
              <p className="text-[12px] text-erp-muted">
                {auditEvents.length} audit event{auditEvents.length === 1 ? '' : 's'} recorded.
                {onViewAudit ? (
                  <button
                    type="button"
                    className="ml-1 font-semibold text-erp-primary hover:underline"
                    onClick={() => onViewAudit(entry)}
                  >
                    View full trail
                  </button>
                ) : null}
              </p>
            </div>
          ) : null}
        </DetailSection>
      </div>
    </LedgerDrawerShell>
  )
}
