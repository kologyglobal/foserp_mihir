import { useCallback } from 'react'
import { TaxRegisterPage } from './TaxRegisterPage'
import { getGstRegister, loadPeriodFilter } from '@/services/accounting/taxComplianceService'
import type { GstRegisterKind } from '@/services/api/taxComplianceApi'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'

type DocRow = {
  id: string
  documentNumber: string
  documentDate: string
  documentType: string
  partyGstin: string | null
  placeOfSupply: string | null
  taxableValue: number
  totalTax: number
  isReverseCharge: boolean
  hsnSacCode?: string | null
}

async function loadDocKind(kind: GstRegisterKind, filter: PeriodFilterState): Promise<DocRow[]> {
  const data = await getGstRegister(kind, filter)
  const items = (data.items as Array<Record<string, unknown>>) ?? []
  return items.map((r, i) => ({
    id: String(r.documentId ?? r.hsnSacCode ?? r.placeOfSupply ?? i),
    documentNumber: String(r.documentNumber ?? r.hsnSacCode ?? r.placeOfSupply ?? '-'),
    documentDate: String(r.documentDate ?? ''),
    documentType: String(r.documentType ?? kind),
    partyGstin: (r.partyGstin as string | null) ?? null,
    placeOfSupply: (r.placeOfSupply as string | null) ?? null,
    taxableValue: Number(r.taxableValue ?? 0),
    totalTax: Number(r.totalTax ?? 0),
    isReverseCharge: Boolean(r.isReverseCharge),
    hsnSacCode: (r.hsnSacCode as string | null) ?? null,
  }))
}

function DocRegister({
  title,
  kind,
  description,
}: {
  title: string
  kind: GstRegisterKind
  description: string
}) {
  const loadRows = useCallback((filter: PeriodFilterState) => loadDocKind(kind, filter), [kind])
  return (
    <TaxRegisterPage
      title={title}
      description={description}
      loadRows={loadRows}
      exportKind={`gst-register-${kind.toLowerCase()}`}
      emptyTitle="No ledger rows for this period"
      emptyHint="Post sales/vendor invoices so Phase 2 GST ledger entries exist, then re-filter by return period."
      searchKeys={(r) => `${r.documentNumber} ${r.partyGstin ?? ''} ${r.placeOfSupply ?? ''}`}
      columns={[
        { key: 'doc', header: 'Document', render: (r) => r.documentNumber },
        { key: 'date', header: 'Date', render: (r) => r.documentDate },
        { key: 'type', header: 'Type', render: (r) => r.documentType },
        { key: 'gstin', header: 'Party GSTIN', render: (r) => r.partyGstin || '-' },
        { key: 'pos', header: 'POS', render: (r) => r.placeOfSupply || '-' },
        { key: 'taxable', header: 'Taxable', render: (r) => formatCurrency(r.taxableValue) },
        { key: 'tax', header: 'Tax', render: (r) => formatCurrency(r.totalTax) },
      ]}
    />
  )
}

export function GstSalesRegisterPage() {
  return (
    <DocRegister
      title="Sales GST Register"
      kind="SALES"
      description="Outward supplies from posted GST ledger (not portal GSTR-1)."
    />
  )
}

export function GstExportSezRegisterPage() {
  return (
    <DocRegister
      title="Export / SEZ Register"
      kind="EXPORT_SEZ"
      description="Zero-rated export & SEZ outward rows from GST ledger (taxTreatment / POS). Not portal EXEMPT/SEZ filing."
    />
  )
}

export function GstPurchaseRegisterPage() {
  return (
    <DocRegister
      title="Purchase GST Register"
      kind="PURCHASE"
      description="Inward (non-RCM) from posted GST ledger."
    />
  )
}

export function GstRcmRegisterPage() {
  return (
    <DocRegister
      title="RCM Register"
      kind="RCM"
      description="Reverse charge rows from GST ledger. Full RCM payment/ITC lifecycle is Phase 4."
    />
  )
}

export function GstHsnRegisterPage() {
  return (
    <DocRegister
      title="HSN Summary Register"
      kind="HSN"
      description="HSN-wise aggregates from GST ledger for returns preparation."
    />
  )
}

export function GstStateRegisterPage() {
  return (
    <DocRegister
      title="State / POS Register"
      kind="STATE"
      description="Place-of-supply aggregates from GST ledger."
    />
  )
}

export function GstLiabilitySummaryPage() {
  return (
    <TaxRegisterPage
      title="GST Liability Summary"
      description="Output + RCM liability from ledger — not a challan (Phase 8)."
      loadRows={async (filter) => {
        const data = await getGstRegister('LIABILITY', filter ?? loadPeriodFilter())
        const output = (data.output as Record<string, number>) ?? {}
        const rcm = (data.rcm as Record<string, number>) ?? {}
        return [
          {
            id: 'output',
            documentNumber: 'Output liability',
            documentDate: '',
            documentType: 'OUTPUT',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: Number(output.taxableValue ?? 0),
            totalTax: Number(output.totalTax ?? 0),
            isReverseCharge: false,
          },
          {
            id: 'rcm',
            documentNumber: 'RCM liability',
            documentDate: '',
            documentType: 'RCM',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: Number(rcm.taxableValue ?? 0),
            totalTax: Number(rcm.totalTax ?? 0),
            isReverseCharge: true,
          },
          {
            id: 'total',
            documentNumber: 'Total liability',
            documentDate: '',
            documentType: 'TOTAL',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: 0,
            totalTax: Number(data.totalLiability ?? 0),
            isReverseCharge: false,
          },
        ]
      }}
      exportKind="gst-liability"
      columns={[
        { key: 'label', header: 'Bucket', render: (r) => r.documentNumber },
        { key: 'taxable', header: 'Taxable', render: (r) => formatCurrency(r.taxableValue) },
        { key: 'tax', header: 'Tax', render: (r) => formatCurrency(r.totalTax) },
      ]}
    />
  )
}

export function GstItcSummaryPage() {
  return (
    <TaxRegisterPage
      title="ITC Summary Register"
      description="Input tax credit totals from GST ledger (eligibility review still Phase 3)."
      loadRows={async (filter) => {
        const data = await getGstRegister('ITC', filter ?? loadPeriodFilter())
        const input = (data.input as Record<string, number>) ?? {}
        const buckets = (data.eligibilityBuckets as Record<string, number>) ?? {}
        const rows: DocRow[] = [
          {
            id: 'input',
            documentNumber: 'Input tax',
            documentDate: '',
            documentType: 'ITC',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: Number(input.taxableValue ?? 0),
            totalTax: Number(data.totalItc ?? input.totalTax ?? 0),
            isReverseCharge: false,
          },
        ]
        for (const [k, v] of Object.entries(buckets)) {
          rows.push({
            id: `el-${k}`,
            documentNumber: `Eligibility: ${k}`,
            documentDate: '',
            documentType: 'ELIGIBILITY',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: 0,
            totalTax: v,
            isReverseCharge: false,
          })
        }
        return rows
      }}
      exportKind="gst-itc"
      columns={[
        { key: 'label', header: 'Bucket', render: (r) => r.documentNumber },
        { key: 'taxable', header: 'Taxable', render: (r) => formatCurrency(r.taxableValue) },
        { key: 'tax', header: 'Tax / ITC', render: (r) => formatCurrency(r.totalTax) },
      ]}
    />
  )
}

export function GstPaymentSummaryPage() {
  return (
    <TaxRegisterPage
      title="GST Payment Summary (prep)"
      description="Net payable = liability − ITC from ledger. Not PMT-06."
      loadRows={async (filter) => {
        const data = await getGstRegister('PAYMENT_SUMMARY', filter ?? loadPeriodFilter())
        return [
          {
            id: 'out',
            documentNumber: 'Output liability',
            documentDate: '',
            documentType: 'OUT',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: 0,
            totalTax: Number(data.outputLiability ?? 0),
            isReverseCharge: false,
          },
          {
            id: 'rcm',
            documentNumber: 'RCM liability',
            documentDate: '',
            documentType: 'RCM',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: 0,
            totalTax: Number(data.rcmLiability ?? 0),
            isReverseCharge: true,
          },
          {
            id: 'itc',
            documentNumber: 'ITC available',
            documentDate: '',
            documentType: 'ITC',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: 0,
            totalTax: Number(data.itcAvailable ?? 0),
            isReverseCharge: false,
          },
          {
            id: 'net',
            documentNumber: 'Net payable (prep)',
            documentDate: '',
            documentType: 'NET',
            partyGstin: null,
            placeOfSupply: null,
            taxableValue: 0,
            totalTax: Number(data.netPayable ?? 0),
            isReverseCharge: false,
          },
        ]
      }}
      exportKind="gst-payment-summary"
      emptyHint={undefined}
      columns={[
        { key: 'label', header: 'Component', render: (r) => r.documentNumber },
        { key: 'amt', header: 'Amount', render: (r) => formatCurrency(r.totalTax) },
      ]}
    />
  )
}
