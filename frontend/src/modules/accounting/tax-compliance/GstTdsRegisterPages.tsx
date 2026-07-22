import { Link } from 'react-router-dom'
import {
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
} from '@/services/accounting/taxComplianceService'
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
        { key: 'gstin', header: 'GSTIN', render: (r) => r.partyGstin || '—' },
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
        { key: 'gstin', header: 'GSTIN', render: (r) => r.partyGstin || '—' },
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
  return (
    <TaxRegisterPage
      title="Reverse Charge"
      description="Inward lines flagged for reverse charge (preview)."
      exportKind="reverse-charge"
      loadRows={getReverseChargeSupplies}
      searchKeys={(r) => `${r.docNo} ${r.partyName}`}
      columns={[
        { key: 'doc', header: 'Document', render: (r) => r.docNo },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.docDate) },
        { key: 'party', header: 'Vendor', render: (r) => r.partyName },
        { key: 'hsn', header: 'HSN/SAC', render: (r) => r.hsnSac },
        { key: 'taxable', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableValue) },
        { key: 'tax', header: 'RCM Tax Preview', className: 'text-right', render: (r) => inr(r.totalTax) },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.status) },
      ]}
    />
  )
}

export function EInvoicesPage() {
  return (
    <TaxRegisterPage
      title="E-Invoices"
      description="IRN tracking register — capture externally only; no portal generation."
      exportKind="e-invoices"
      loadRows={getEInvoices}
      searchKeys={(r) => `${r.invoiceNo} ${r.customerName} ${r.irn ?? ''}`}
      columns={[
        { key: 'inv', header: 'Invoice', render: (r) => r.invoiceNo },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.invoiceDate) },
        { key: 'party', header: 'Customer', render: (r) => r.customerName },
        { key: 'taxable', header: 'Taxable', className: 'text-right', render: (r) => inr(r.taxableValue) },
        { key: 'status', header: 'IRN Status', render: (r) => statusCell(r.irnStatus) },
        { key: 'irn', header: 'IRN / Ack', render: (r) => r.irn?.slice(0, 18) ?? r.ackNo ?? '—' },
      ]}
    />
  )
}

export function EWayBillsPage() {
  return (
    <TaxRegisterPage
      title="E-Way Bills"
      description="E-way requirement / external capture register — no portal generation."
      exportKind="e-way-bills"
      loadRows={getEWayBills}
      searchKeys={(r) => `${r.docNo} ${r.partyName} ${r.ewbNo ?? ''}`}
      columns={[
        { key: 'doc', header: 'Document', render: (r) => r.docNo },
        { key: 'party', header: 'Party', render: (r) => r.partyName },
        { key: 'route', header: 'Route', render: (r) => `${r.fromPlace} → ${r.toPlace}` },
        { key: 'km', header: 'Km', render: (r) => String(r.distanceKm) },
        { key: 'status', header: 'Status', render: (r) => statusCell(r.ewbStatus) },
        { key: 'ewb', header: 'EWB No', render: (r) => r.ewbNo ?? '—' },
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
        { key: 'ack', header: 'Ack / Ref', render: (r) => r.acknowledgmentNo ?? '—' },
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
        { key: 'no', header: 'Certificate No', render: (r) => r.certificateNo ?? '—' },
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
