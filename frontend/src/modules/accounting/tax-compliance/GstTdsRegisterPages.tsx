import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cancelEInvoice,
  cancelEWayBill,
  generateEInvoice,
  generateEWayBill,
  getEInvoices,
  getEWayBills,
  getGstExceptions,
  getInwardSupplies,
  getNotices,
  getOutwardSupplies,
  getReverseChargeSupplies,
  getTcsRegister,
  getTdsCertificates,
  getTdsChallans,
  getTdsReturns,
  getTdsTransactions,
  markRcmLiabilityPaid,
  recognizeRcmItc,
} from '@/services/accounting/taxComplianceService'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import type { EInvoiceRow, EWayBillRow, GstSupplyRow, PeriodFilterState } from '@/types/taxCompliance'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { inr, statusCell, TaxRegisterPage } from './TaxRegisterPage'
import { formatDate } from '@/utils/dates/format'

export function OutwardSuppliesPage() {
  return (
    <TaxRegisterPage
      title="Outward Supplies"
      description="Sales / outward GST register from posted sales invoices (API) or demo seed."
      exportKind="outward-supplies"
      loadRows={getOutwardSupplies}
      searchKeys={(r) => `${r.docNo} ${r.partyName} ${r.partyGstin} ${r.hsnSac}`}
      emptyTitle="No outward supplies"
      emptyHint="Posted sales invoices in the selected period will appear here."
      columns={[
        { key: 'doc', header: 'Document', render: (r) => `${r.docType} ${r.docNo}` },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.docDate) },
        { key: 'party', header: 'Party', render: (r) => r.partyName },
        { key: 'gstin', header: 'GSTIN', render: (r) => r.partyGstin || '-' },
        { key: 'pos', header: 'PoS', render: (r) => r.placeOfSupply },
        { key: 'taxable', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableValue) },
        { key: 'cgst', header: 'CGST', className: 'text-right', render: (r) => inr(r.cgst) },
        { key: 'sgst', header: 'SGST', className: 'text-right', render: (r) => inr(r.sgst) },
        { key: 'igst', header: 'IGST', className: 'text-right', render: (r) => inr(r.igst) },
        { key: 'tax', header: 'Tax', className: 'text-right', render: (r) => inr(r.totalTax) },
        { key: 'type', header: 'Type', render: (r) => r.supplyType },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function InwardSuppliesPage() {
  return (
    <TaxRegisterPage
      title="Inward Supplies"
      description="Purchase / inward GST register from posted vendor invoices (API) or demo seed."
      exportKind="inward-supplies"
      loadRows={getInwardSupplies}
      searchKeys={(r) => `${r.docNo} ${r.partyName} ${r.partyGstin}`}
      emptyTitle="No inward supplies"
      emptyHint="Posted vendor invoices in the selected period will appear here."
      columns={[
        { key: 'doc', header: 'Document', render: (r) => `${r.docType} ${r.docNo}` },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.docDate) },
        { key: 'party', header: 'Vendor', render: (r) => r.partyName },
        { key: 'gstin', header: 'GSTIN', render: (r) => r.partyGstin || '-' },
        { key: 'taxable', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableValue) },
        { key: 'cgst', header: 'CGST', className: 'text-right', render: (r) => inr(r.cgst) },
        { key: 'sgst', header: 'SGST', className: 'text-right', render: (r) => inr(r.sgst) },
        { key: 'igst', header: 'IGST', className: 'text-right', render: (r) => inr(r.igst) },
        { key: 'tax', header: 'Tax', className: 'text-right', render: (r) => inr(r.totalTax) },
        { key: 'rcm', header: 'RCM', render: (r) => (r.reverseCharge ? 'Yes' : 'No') },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function ReverseChargePage() {
  const perms = useTaxCompliancePermissions()
  const [reloadKey, setReloadKey] = useState(0)

  const loadRows = useCallback(
    async (filter: PeriodFilterState) => {
      void reloadKey
      return getReverseChargeSupplies(filter)
    },
    [reloadKey],
  )

  const onMarkPaid = async (row: GstSupplyRow) => {
    if (!perms.canGstReconcile && !perms.canGstView) return
    const paymentRef = await appPromptNote({
      title: 'Confirm RCM liability paid',
      description:
        'Records compliance confirmation that RCM self-assessment liability was paid to government. This is not PMT-06 bank posting (Phase 8).',
      confirmLabel: 'Mark paid',
      note: { required: false, label: 'Payment reference (challan / PMT ref)', placeholder: 'Optional' },
    })
    if (paymentRef === null) return
    try {
      await markRcmLiabilityPaid(row.id, {
        liabilityPaidDate: new Date().toISOString().slice(0, 10),
        liabilityPaymentRef: paymentRef.trim() || undefined,
      })
      notify.success('RCM liability marked paid')
      setReloadKey((k) => k + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to mark paid')
    }
  }

  const onRecognizeItc = async (row: GstSupplyRow) => {
    try {
      await recognizeRcmItc(row.id)
      notify.success('RCM ITC marked recognized on register')
      setReloadKey((k) => k + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Recognize ITC failed')
    }
  }

  return (
    <TaxRegisterPage
      title="Reverse Charge"
      description="Posted AP reverse-charge liability → payment confirmation → ITC recognition. Incomplete RCM GL maps block VI post with RCM_ACCOUNTING_PENDING."
      exportKind="reverse-charge"
      loadRows={loadRows}
      searchKeys={(r) => `${r.docNo} ${r.partyName} ${r.rcmLifecycleStatus ?? ''}`}
      emptyTitle="No reverse-charge liabilities"
      emptyHint="Post a vendor invoice with tax treatment REVERSE_CHARGE to populate this register."
      columns={[
        { key: 'doc', header: 'Document', render: (r) => r.docNo },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.docDate) },
        { key: 'party', header: 'Vendor', render: (r) => r.partyName },
        { key: 'taxable', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableValue) },
        { key: 'tax', header: 'RCM Tax', className: 'text-right', render: (r) => inr(r.totalTax) },
        {
          key: 'life',
          header: 'Lifecycle',
          render: (r) => statusCell(r.rcmLifecycleStatus ?? r.status),
        },
        { key: 'status', header: 'UI status', render: (r) => statusCell(r.status) },
        {
          key: 'actions',
          header: 'Actions',
          render: (r) => (
            <span className="inline-flex flex-wrap gap-1">
              {r.rcmLifecycleStatus === 'LIABILITY_POSTED' ? (
                <button
                  type="button"
                  className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] text-erp-text hover:bg-erp-surface"
                  onClick={() => void onMarkPaid(r)}
                >
                  Mark liability paid
                </button>
              ) : null}
              {r.rcmLifecycleStatus === 'LIABILITY_PAID' ? (
                <button
                  type="button"
                  className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] text-erp-text hover:bg-erp-surface"
                  onClick={() => void onRecognizeItc(r)}
                >
                  Recognize ITC
                </button>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  )
}

export function EInvoicesPage() {
  const perms = useTaxCompliancePermissions()
  const [reloadKey, setReloadKey] = useState(0)

  const loadRows = useCallback(
    async (filter: PeriodFilterState) => {
      void reloadKey
      return getEInvoices(filter)
    },
    [reloadKey],
  )

  const onGenerate = async () => {
    if (!perms.canEInvoice) return
    const salesInvoiceId = await appPromptNote({
      title: 'Generate e-invoice IRN',
      description:
        'Enter the posted sales invoice UUID (canonical AR only). Default mode is SIMULATED — not sent to the GST portal unless LIVE is explicitly gated after UAT.',
      confirmLabel: 'Generate IRN',
      note: { required: true, label: 'Sales invoice UUID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    })
    if (!salesInvoiceId?.trim()) return
    try {
      const row = await generateEInvoice(salesInvoiceId.trim())
      notify.success(row.irn ? `IRN generated (${row.providerMode ?? 'SIMULATED'})` : 'E-invoice recorded')
      setReloadKey((k) => k + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    }
  }

  const onCancel = async (row: EInvoiceRow) => {
    if (!perms.canEInvoice || row.irnStatus !== 'Generated') return
    const reason = await appPromptNote({
      title: 'Cancel e-invoice',
      description: `Cancel IRN for ${row.invoiceNo}? (${row.providerMode ?? 'SIMULATED'} provider)`,
      confirmLabel: 'Cancel IRN',
      tone: 'danger',
      note: { required: true, label: 'Cancellation reason', placeholder: 'Reason…' },
    })
    if (!reason?.trim()) return
    try {
      await cancelEInvoice(row.id, reason.trim())
      notify.success(`E-invoice cancelled (${row.providerMode ?? 'SIMULATED'})`)
      setReloadKey((k) => k + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  return (
    <TaxRegisterPage
      title="E-Invoices"
      description="IRN register from posted AR sales invoices. Provider mode via GST_EINVOICE_PROVIDER_MODE (default SIMULATED). Demo seed when offline."
      exportKind="e-invoices"
      loadRows={loadRows}
      searchKeys={(r) => `${r.invoiceNo} ${r.customerName} ${r.irn ?? ''}`}
      emptyTitle="No e-invoices"
      emptyHint="Generate from a posted B2B sales invoice (customer GSTIN required). EXCEPTION rows can be retried."
      headerExtra={
        perms.canEInvoice && perms.isApiMode ? (
          <button
            type="button"
            className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold text-erp-primary hover:bg-erp-surface"
            onClick={() => void onGenerate()}
          >
            Generate IRN
          </button>
        ) : null
      }
      columns={[
        { key: 'inv', header: 'Invoice', render: (r) => r.invoiceNo },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.invoiceDate) },
        { key: 'party', header: 'Customer', render: (r) => r.customerName },
        { key: 'taxable', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableValue) },
        { key: 'status', header: 'IRN Status', render: (r) => statusCell(r.irnStatus) },
        { key: 'mode', header: 'Mode', render: (r) => r.providerMode ?? '-' },
        { key: 'irn', header: 'IRN / Ack', render: (r) => r.irn?.slice(0, 18) ?? r.ackNo ?? '-' },
        {
          key: 'act',
          header: 'Actions',
          render: (r) =>
            perms.canEInvoice && perms.isApiMode && r.irnStatus === 'Generated' ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-rose-700 hover:underline"
                onClick={() => void onCancel(r)}
              >
                Cancel
              </button>
            ) : (
              '-'
            ),
        },
      ]}
    />
  )
}

export function EWayBillsPage() {
  const perms = useTaxCompliancePermissions()
  const [reloadKey, setReloadKey] = useState(0)

  const loadRows = useCallback(
    async (filter: PeriodFilterState) => {
      void reloadKey
      return getEWayBills(filter)
    },
    [reloadKey],
  )

  const onGenerate = async () => {
    if (!perms.canEWay) return
    const salesInvoiceId = await appPromptNote({
      title: 'Generate e-way bill',
      description:
        'Enter posted sales invoice UUID. Part A uses default route placeholders (100 km). Provider mode follows GST_EINVOICE_PROVIDER_MODE / GST_NIC_PROVIDER (default SIMULATED — not portal).',
      confirmLabel: 'Generate EWB',
      note: { required: true, label: 'Sales invoice UUID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    })
    if (!salesInvoiceId?.trim()) return
    try {
      const row = await generateEWayBill({
        sourceType: 'SALES_INVOICE',
        salesInvoiceId: salesInvoiceId.trim(),
        fromPlace: 'Factory',
        toPlace: 'Customer',
        distanceKm: 100,
        force: true,
      })
      notify.success(row.ewbNo ? `EWB ${row.ewbNo} (${row.providerMode ?? 'SIMULATED'})` : 'E-way recorded')
      setReloadKey((k) => k + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    }
  }

  const onCancel = async (row: EWayBillRow) => {
    if (!perms.canEWay || row.ewbStatus !== 'Generated') return
    const reason = await appPromptNote({
      title: 'Cancel e-way bill',
      description: `Cancel EWB for ${row.docNo}? (${row.providerMode ?? 'SIMULATED'})`,
      confirmLabel: 'Cancel EWB',
      tone: 'danger',
      note: { required: true, label: 'Cancellation reason', placeholder: 'Reason…' },
    })
    if (!reason?.trim()) return
    try {
      await cancelEWayBill(row.id, reason.trim())
      notify.success(`E-way cancelled (${row.providerMode ?? 'SIMULATED'})`)
      setReloadKey((k) => k + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  return (
    <TaxRegisterPage
      title="E-Way Bills"
      description="E-way register from posted SI or issued delivery challan/dispatch. Part A (route) + Part B (vehicle/transporter). Default SIMULATED provider; LIVE gated after UAT."
      exportKind="e-way-bills"
      loadRows={loadRows}
      searchKeys={(r) => `${r.docNo} ${r.partyName} ${r.ewbNo ?? ''}`}
      emptyTitle="No e-way bills"
      emptyHint="Generate from a posted sales invoice or issued delivery challan. EXCEPTION rows can be retried."
      headerExtra={
        perms.canEWay && perms.isApiMode ? (
          <button
            type="button"
            className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold text-erp-primary hover:bg-erp-surface"
            onClick={() => void onGenerate()}
          >
            Generate EWB
          </button>
        ) : null
      }
      columns={[
        { key: 'doc', header: 'Document', render: (r) => r.docNo },
        { key: 'party', header: 'Party', render: (r) => r.partyName },
        { key: 'route', header: 'Route', render: (r) => `${r.fromPlace} → ${r.toPlace}` },
        { key: 'km', header: 'Km', render: (r) => String(r.distanceKm) },
        { key: 'veh', header: 'Vehicle', render: (r) => r.vehicleNo ?? '-' },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.ewbStatus) },
        { key: 'mode', header: 'Mode', render: (r) => r.providerMode ?? '-' },
        { key: 'ewb', header: 'EWB No', render: (r) => r.ewbNo ?? '-' },
        {
          key: 'act',
          header: 'Actions',
          render: (r) =>
            perms.canEWay && perms.isApiMode && r.ewbStatus === 'Generated' ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-rose-700 hover:underline"
                onClick={() => void onCancel(r)}
              >
                Cancel
              </button>
            ) : (
              '-'
            ),
        },
      ]}
    />
  )
}

export function GstExceptionsPage() {
  return (
    <TaxRegisterPage
      title="GST Exceptions"
      description="Exception register for mismatches, pending IRN, RCM review, and master warnings."
      exportKind="gst-exceptions"
      loadRows={getGstExceptions}
      searchKeys={(r) => `${r.category} ${r.description} ${r.entityRef}`}
      columns={[
        { key: 'sev', header: 'Severity', render: (r) => statusCell(r.severity) },
        { key: 'cat', header: 'Category', render: (r) => r.category },
        { key: 'desc', header: 'Description', className: 'min-w-[220px] whitespace-normal', render: (r) => r.description },
        { key: 'ref', header: 'Ref', render: (r) => r.entityRef },
        { key: 'owner', header: 'Owner', render: (r) => r.owner },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function NoticesPage() {
  return (
    <TaxRegisterPage
      title="Notices"
      description="GST / Income Tax notice tracker (demo). Responses recorded for workflow only."
      exportKind="notices"
      loadRows={async () => getNotices()}
      searchKeys={(r) => `${r.noticeType} ${r.refNo} ${r.summary}`}
      columns={[
        { key: 'type', header: 'Type', render: (r) => r.noticeType },
        { key: 'ref', header: 'Reference', render: (r) => r.refNo },
        { key: 'auth', header: 'Authority', render: (r) => r.authority },
        { key: 'due', header: 'Due', render: (r) => formatDate(r.dueDate) },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
        { key: 'sum', header: 'Summary', className: 'min-w-[200px] whitespace-normal', render: (r) => r.summary },
      ]}
    />
  )
}

export function TdsTransactionsPage() {
  return (
    <TaxRegisterPage
      title="TDS Transactions"
      description="Deduction candidates from demo purchase / expense postings. Linked workbench from TDS Dashboard."
      exportKind="tds-transactions"
      loadRows={async () => getTdsTransactions()}
      searchKeys={(r) => `${r.vendorName} ${r.vendorPan} ${r.sectionCode} ${r.natureOfPayment}`}
      headerExtra={
        <Link to="/accounting/tax-compliance/tds/deductions" className="text-[12px] font-semibold text-erp-primary hover:underline">
          Open Deduction Workbench
        </Link>
      }
      columns={[
        { key: 'date', header: 'Date', render: (r) => formatDate(r.txnDate) },
        { key: 'vendor', header: 'Deductee', render: (r) => r.vendorName },
        { key: 'pan', header: 'PAN', render: (r) => r.vendorPan },
        { key: 'sec', header: 'Section', render: (r) => r.sectionCode },
        { key: 'amt', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableAmount) },
        { key: 'rate', header: 'Rate %', render: (r) => String(r.ratePercent) },
        { key: 'tds', header: 'TDS', className: 'text-right', render: (r) => inr(r.tdsAmount) },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function TdsChallansPage() {
  return (
    <TaxRegisterPage
      title="TDS Challans"
      description="Challan register — mark paid externally; no TRACES / bank payment."
      exportKind="tds-challans"
      loadRows={async () => getTdsChallans()}
      searchKeys={(r) => `${r.challanNo} ${r.cin ?? ''} ${r.sectionCode}`}
      columns={[
        { key: 'no', header: 'Challan', render: (r) => r.challanNo },
        { key: 'bsr', header: 'BSR', render: (r) => r.bsrCode },
        { key: 'paid', header: 'Paid On', render: (r) => formatDate(r.paidOn) },
        { key: 'amt', header: 'Amount', className: 'text-right', render: (r) => inr(r.amount) },
        { key: 'sec', header: 'Section', render: (r) => r.sectionCode },
        { key: 'q', header: 'Quarter', render: (r) => r.quarter },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
        { key: 'link', header: 'Linked Txns', render: (r) => String(r.linkedTxnCount) },
      ]}
    />
  )
}

export function TdsReturnsPage() {
  return (
    <TaxRegisterPage
      title="TDS Returns"
      description="24Q/26Q prep workspace — Mark Filed Externally only."
      exportKind="tds-returns"
      loadRows={async () => getTdsReturns()}
      searchKeys={(r) => `${r.formType} ${r.quarter} ${r.fyLabel}`}
      columns={[
        { key: 'form', header: 'Form', render: (r) => r.formType },
        { key: 'q', header: 'Quarter', render: (r) => `${r.quarter} ${r.fyLabel}` },
        { key: 'cnt', header: 'Deductees', render: (r) => String(r.deducteeCount) },
        { key: 'tds', header: 'Total TDS', className: 'text-right', render: (r) => inr(r.totalTds) },
        { key: 'ack', header: 'Ack / Ref', render: (r) => r.acknowledgmentNo ?? '-' },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function TdsCertificatesPage() {
  return (
    <TaxRegisterPage
      title="TDS Certificates"
      description="Form 16/16A draft preview — issue marked externally only."
      exportKind="tds-certificates"
      loadRows={async () => getTdsCertificates()}
      searchKeys={(r) => `${r.deducteeName} ${r.deducteePan} ${r.certificateNo ?? ''}`}
      columns={[
        { key: 'form', header: 'Form', render: (r) => r.formType },
        { key: 'name', header: 'Deductee', render: (r) => r.deducteeName },
        { key: 'pan', header: 'PAN', render: (r) => r.deducteePan },
        { key: 'q', header: 'Quarter', render: (r) => r.quarter },
        { key: 'amt', header: 'TDS', className: 'text-right', render: (r) => inr(r.tdsAmount) },
        { key: 'no', header: 'Certificate No', render: (r) => r.certificateNo ?? '-' },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function TcsRegisterPage() {
  return (
    <TaxRegisterPage
      title="TCS"
      description="TCS collection register (preview from setup sections)."
      exportKind="tcs-register"
      loadRows={async () => getTcsRegister()}
      searchKeys={(r) => `${r.partyName} ${r.partyPan} ${r.sectionCode}`}
      columns={[
        { key: 'date', header: 'Date', render: (r) => formatDate(r.txnDate) },
        { key: 'party', header: 'Party', render: (r) => r.partyName },
        { key: 'pan', header: 'PAN', render: (r) => r.partyPan },
        { key: 'sec', header: 'Section', render: (r) => r.sectionCode },
        { key: 'base', header: 'Collectible', className: 'text-right', render: (r) => inr(r.collectibleAmount) },
        { key: 'rate', header: 'Rate %', render: (r) => String(r.ratePercent) },
        { key: 'tcs', header: 'TCS', className: 'text-right', render: (r) => inr(r.tcsAmount) },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}
