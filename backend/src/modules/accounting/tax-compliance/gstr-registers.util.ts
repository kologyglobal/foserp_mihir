/**
 * Phase 5 — pure register / GSTR-1 / GSTR-3B aggregation over GST ledger rows.
 * No I/O — unit-tested. Amounts come from posted snapshots only (never re-resolved).
 * Phase 10 — export/SEZ classification prefers taxTreatment / supplyType on rows.
 */

import {
  isExportOrSezDocument,
  isExportOrSezPlaceOfSupply,
  partitionExportSezDocs,
  paymentModeFromTreatment,
} from './export-sez-lut.util.js'

export type RegisterKind =
  | 'SALES'
  | 'PURCHASE'
  | 'CN_DN'
  | 'RCM'
  | 'EXPORT_SEZ'
  | 'HSN'
  | 'STATE'
  | 'LIABILITY'
  | 'ITC'
  | 'PAYMENT_SUMMARY'

export type LedgerRowLike = {
  id?: string
  documentId: string
  documentNumber: string
  documentDate: string
  documentType: string
  documentLineId?: string | null
  direction: 'OUTWARD' | 'INWARD'
  partyGstin: string | null
  companyGstin: string | null
  placeOfSupply: string | null
  hsnSacCode: string | null
  taxType: string
  taxableValue: number
  taxRate: number
  taxAmount: number
  isReverseCharge: boolean
  itcEligibility: string | null
  filingStatus: string
  /** Phase 10 — from sourceSnapshot when available */
  taxTreatment?: string | null
  supplyType?: string | null
  zeroRatedMode?: string | null
}

export type ComponentTotals = {
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
}

export type DocumentRegisterRow = {
  documentId: string
  documentNumber: string
  documentDate: string
  documentType: string
  direction: 'OUTWARD' | 'INWARD'
  partyGstin: string | null
  companyGstin: string | null
  placeOfSupply: string | null
  hsnSacCode: string | null
  isReverseCharge: boolean
  filingStatus: string
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
  taxTreatment?: string | null
  supplyType?: string | null
  zeroRatedMode?: string | null
}

export type HsnRegisterRow = {
  hsnSacCode: string
  direction: 'OUTWARD' | 'INWARD'
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
  lineCount: number
}

export type StateRegisterRow = {
  placeOfSupply: string
  direction: 'OUTWARD' | 'INWARD'
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
  documentCount: number
}

export type ComponentBreakdown = {
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
}

export type LiabilitySummary = {
  output: ComponentBreakdown
  rcm: ComponentBreakdown
  totalLiability: number
}

export type ItcSummary = {
  input: ComponentBreakdown
  eligibilityBuckets: Record<string, number>
  totalItc: number
}

export type PaymentSummary = {
  outputLiability: number
  rcmLiability: number
  itcAvailable: number
  netPayable: number
  note: string
}

export type Gstr1PrepSections = {
  b2b: DocumentRegisterRow[]
  b2c: DocumentRegisterRow[]
  creditDebitNotes: DocumentRegisterRow[]
  exportSez: DocumentRegisterRow[]
  /** Phase 10 partition of export/SEZ by payment mode */
  exportSezWpay: DocumentRegisterRow[]
  exportSezWopay: DocumentRegisterRow[]
  hsn: HsnRegisterRow[]
  totals: {
    outwardTaxable: number
    taxLiability: number
    documentCount: number
  }
}

export type Gstr3bPrepSummary = {
  outward: ComponentBreakdown
  inward: ComponentBreakdown
  rcm: ComponentBreakdown
  itc: ComponentBreakdown
  taxLiability: number
  itcAvailable: number
  netPayable: number
}

const OUTPUT = new Set(['OUTPUT_CGST', 'OUTPUT_SGST', 'OUTPUT_IGST', 'OUTPUT_CESS'])
const INPUT = new Set(['INPUT_CGST', 'INPUT_SGST', 'INPUT_IGST', 'INPUT_CESS'])
const RCM = new Set(['RCM_CGST', 'RCM_SGST', 'RCM_IGST'])
const CN_DN_TYPES = new Set(['CUSTOMER_CREDIT_NOTE', 'VENDOR_ADJUSTMENT'])

function emptyComponents(): ComponentTotals {
  return { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0 }
}

function addTaxComponent(bucket: ComponentTotals, taxType: string, taxAmount: number): void {
  if (taxType.endsWith('_CGST') || taxType === 'OUTPUT_CGST' || taxType === 'INPUT_CGST' || taxType === 'RCM_CGST') {
    bucket.cgst += taxAmount
  } else if (taxType.endsWith('_SGST') || taxType === 'OUTPUT_SGST' || taxType === 'INPUT_SGST' || taxType === 'RCM_SGST') {
    bucket.sgst += taxAmount
  } else if (taxType.endsWith('_IGST') || taxType === 'OUTPUT_IGST' || taxType === 'INPUT_IGST' || taxType === 'RCM_IGST') {
    bucket.igst += taxAmount
  } else if (taxType.endsWith('_CESS') || taxType === 'OUTPUT_CESS' || taxType === 'INPUT_CESS') {
    bucket.cess += taxAmount
  }
  bucket.totalTax += taxAmount
}

/** Normalize export/SEZ from placeOfSupply (legacy) — prefer treatment fields via isExportOrSezDocument. */
export function isExportOrSez(placeOfSupply: string | null | undefined): boolean {
  return isExportOrSezPlaceOfSupply(placeOfSupply)
}

function rowIsExportOrSez(r: Pick<LedgerRowLike, 'taxTreatment' | 'supplyType' | 'placeOfSupply'>): boolean {
  return isExportOrSezDocument({
    taxTreatment: r.taxTreatment,
    supplyType: r.supplyType,
    placeOfSupply: r.placeOfSupply,
  })
}

export function moneyRound(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function finalize(c: ComponentTotals): ComponentBreakdown {
  return {
    taxableValue: moneyRound(c.taxableValue),
    cgst: moneyRound(c.cgst),
    sgst: moneyRound(c.sgst),
    igst: moneyRound(c.igst),
    cess: moneyRound(c.cess),
    totalTax: moneyRound(c.totalTax),
  }
}

/** Collapse line-level ledger components to one document row (taxable counted once per line seed family). */
export function collapseToDocumentRows(rows: LedgerRowLike[]): DocumentRegisterRow[] {
  type Acc = DocumentRegisterRow & { _lineTaxable: Set<string> }
  const map = new Map<string, Acc>()

  for (const r of rows) {
    const key = `${r.documentType}:${r.documentId}`
    let acc = map.get(key)
    if (!acc) {
      acc = {
        documentId: r.documentId,
        documentNumber: r.documentNumber,
        documentDate: r.documentDate,
        documentType: r.documentType,
        direction: r.direction,
        partyGstin: r.partyGstin,
        companyGstin: r.companyGstin,
        placeOfSupply: r.placeOfSupply,
        hsnSacCode: r.hsnSacCode,
        isReverseCharge: r.isReverseCharge,
        filingStatus: r.filingStatus,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        totalTax: 0,
        taxTreatment: r.taxTreatment ?? null,
        supplyType: r.supplyType ?? null,
        zeroRatedMode: r.zeroRatedMode ?? paymentModeFromTreatment(r.taxTreatment),
        _lineTaxable: new Set(),
      }
      map.set(key, acc)
    }
    const lineKey = r.documentLineId || `${r.hsnSacCode ?? ''}:${r.taxableValue}`
    if (!acc._lineTaxable.has(lineKey)) {
      acc._lineTaxable.add(lineKey)
      acc.taxableValue += r.taxableValue
    }
    const bag = emptyComponents()
    addTaxComponent(bag, r.taxType, r.taxAmount)
    acc.cgst += bag.cgst
    acc.sgst += bag.sgst
    acc.igst += bag.igst
    acc.cess += bag.cess
    acc.totalTax += bag.totalTax
    if (r.filingStatus === 'FILED' || r.filingStatus === 'INCLUDED_IN_DRAFT') {
      acc.filingStatus = r.filingStatus
    }
  }

  return [...map.values()]
    .map(({ _lineTaxable: _, ...row }) => ({
      ...row,
      taxableValue: moneyRound(row.taxableValue),
      cgst: moneyRound(row.cgst),
      sgst: moneyRound(row.sgst),
      igst: moneyRound(row.igst),
      cess: moneyRound(row.cess),
      totalTax: moneyRound(row.totalTax),
    }))
    .sort((a, b) => a.documentDate.localeCompare(b.documentDate) || a.documentNumber.localeCompare(b.documentNumber))
}

function filterByKind(rows: LedgerRowLike[], kind: RegisterKind): LedgerRowLike[] {
  switch (kind) {
    case 'SALES':
      return rows.filter((r) => r.direction === 'OUTWARD' && !CN_DN_TYPES.has(r.documentType) && OUTPUT.has(r.taxType))
    case 'PURCHASE':
      return rows.filter(
        (r) =>
          r.direction === 'INWARD' &&
          !CN_DN_TYPES.has(r.documentType) &&
          !r.isReverseCharge &&
          INPUT.has(r.taxType),
      )
    case 'CN_DN':
      return rows.filter((r) => CN_DN_TYPES.has(r.documentType))
    case 'RCM':
      return rows.filter((r) => r.isReverseCharge || RCM.has(r.taxType))
    case 'EXPORT_SEZ':
      return rows.filter((r) => r.direction === 'OUTWARD' && rowIsExportOrSez(r) && OUTPUT.has(r.taxType))
    default:
      return rows
  }
}

export function buildHsnRegister(rows: LedgerRowLike[]): HsnRegisterRow[] {
  type Acc = HsnRegisterRow & { _lines: Set<string> }
  const map = new Map<string, Acc>()
  for (const r of rows) {
    if (!OUTPUT.has(r.taxType) && !INPUT.has(r.taxType) && !RCM.has(r.taxType)) continue
    const hsn = r.hsnSacCode?.trim() || 'UNCLASSIFIED'
    const key = `${r.direction}:${hsn}`
    let acc = map.get(key)
    if (!acc) {
      acc = {
        hsnSacCode: hsn,
        direction: r.direction,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        totalTax: 0,
        lineCount: 0,
        _lines: new Set(),
      }
      map.set(key, acc)
    }
    const lineKey = `${r.documentId}:${r.documentLineId ?? ''}:${r.taxableValue}`
    if (!acc._lines.has(lineKey)) {
      acc._lines.add(lineKey)
      acc.taxableValue += r.taxableValue
      acc.lineCount += 1
    }
    const bag = emptyComponents()
    addTaxComponent(bag, r.taxType, r.taxAmount)
    acc.cgst += bag.cgst
    acc.sgst += bag.sgst
    acc.igst += bag.igst
    acc.cess += bag.cess
    acc.totalTax += bag.totalTax
  }
  return [...map.values()]
    .map(({ _lines: _, ...row }) => ({
      ...row,
      taxableValue: moneyRound(row.taxableValue),
      cgst: moneyRound(row.cgst),
      sgst: moneyRound(row.sgst),
      igst: moneyRound(row.igst),
      cess: moneyRound(row.cess),
      totalTax: moneyRound(row.totalTax),
    }))
    .sort((a, b) => a.hsnSacCode.localeCompare(b.hsnSacCode) || a.direction.localeCompare(b.direction))
}

export function buildStateRegister(rows: LedgerRowLike[]): StateRegisterRow[] {
  type Acc = StateRegisterRow & { _docs: Set<string> }
  const map = new Map<string, Acc>()
  for (const r of rows) {
    if (!OUTPUT.has(r.taxType) && !INPUT.has(r.taxType) && !RCM.has(r.taxType)) continue
    const pos = r.placeOfSupply?.trim() || 'UNSPECIFIED'
    const key = `${r.direction}:${pos}`
    let acc = map.get(key)
    if (!acc) {
      acc = {
        placeOfSupply: pos,
        direction: r.direction,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        totalTax: 0,
        documentCount: 0,
        _docs: new Set(),
      }
      map.set(key, acc)
    }
    if (!acc._docs.has(r.documentId)) {
      acc._docs.add(r.documentId)
      acc.documentCount += 1
    }
    // taxable once per doc-line
    const lineKey = `${r.documentId}:${r.documentLineId ?? r.taxType}`
    // approximate: use first component row's taxable only when CGST/IGST primary
    if (r.taxType.includes('CGST') || r.taxType.includes('IGST')) {
      acc.taxableValue += r.taxableValue
    }
    const bag = emptyComponents()
    addTaxComponent(bag, r.taxType, r.taxAmount)
    acc.cgst += bag.cgst
    acc.sgst += bag.sgst
    acc.igst += bag.igst
    acc.cess += bag.cess
    acc.totalTax += bag.totalTax
    void lineKey
  }
  return [...map.values()]
    .map(({ _docs: _, ...row }) => ({
      ...row,
      taxableValue: moneyRound(row.taxableValue),
      cgst: moneyRound(row.cgst),
      sgst: moneyRound(row.sgst),
      igst: moneyRound(row.igst),
      cess: moneyRound(row.cess),
      totalTax: moneyRound(row.totalTax),
    }))
    .sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply))
}

export function buildLiabilitySummary(rows: LedgerRowLike[]): LiabilitySummary {
  const output = emptyComponents()
  const rcm = emptyComponents()
  const outLineTaxable = new Set<string>()
  const rcmLineTaxable = new Set<string>()

  for (const r of rows) {
    if (OUTPUT.has(r.taxType)) {
      const lk = `${r.documentId}:${r.documentLineId ?? ''}`
      if (!outLineTaxable.has(lk)) {
        outLineTaxable.add(lk)
        output.taxableValue += r.taxableValue
      }
      addTaxComponent(output, r.taxType, r.taxAmount)
    }
    if (RCM.has(r.taxType) || (r.isReverseCharge && RCM.has(r.taxType))) {
      const lk = `${r.documentId}:${r.documentLineId ?? ''}`
      if (!rcmLineTaxable.has(lk)) {
        rcmLineTaxable.add(lk)
        rcm.taxableValue += r.taxableValue
      }
      addTaxComponent(rcm, r.taxType, r.taxAmount)
    }
  }
  const fo = finalize(output)
  const fr = finalize(rcm)
  return {
    output: fo,
    rcm: fr,
    totalLiability: moneyRound(fo.totalTax + fr.totalTax),
  }
}

export function buildItcSummary(rows: LedgerRowLike[]): ItcSummary {
  const input = emptyComponents()
  const buckets: Record<string, number> = {}
  const lineTaxable = new Set<string>()
  for (const r of rows) {
    if (!INPUT.has(r.taxType)) continue
    const lk = `${r.documentId}:${r.documentLineId ?? ''}`
    if (!lineTaxable.has(lk)) {
      lineTaxable.add(lk)
      input.taxableValue += r.taxableValue
    }
    addTaxComponent(input, r.taxType, r.taxAmount)
    const el = r.itcEligibility ?? 'UNSPECIFIED'
    buckets[el] = moneyRound((buckets[el] ?? 0) + r.taxAmount)
  }
  const fi = finalize(input)
  return {
    input: fi,
    eligibilityBuckets: buckets,
    totalItc: fi.totalTax,
  }
}

export function buildPaymentSummary(rows: LedgerRowLike[]): PaymentSummary {
  const liab = buildLiabilitySummary(rows)
  const itc = buildItcSummary(rows)
  const net = moneyRound(liab.totalLiability - itc.totalItc)
  return {
    outputLiability: liab.output.totalTax,
    rcmLiability: liab.rcm.totalTax,
    itcAvailable: itc.totalItc,
    netPayable: net,
    note: 'Preparation-only net position from GST ledger. Not a PMT-06 challan or portal liability (Phase 8).',
  }
}

export function buildGstr1Sections(rows: LedgerRowLike[]): Gstr1PrepSections {
  const outward = rows.filter((r) => r.direction === 'OUTWARD' && OUTPUT.has(r.taxType))
  const docs = collapseToDocumentRows(outward)
  const b2b: DocumentRegisterRow[] = []
  const b2c: DocumentRegisterRow[] = []
  const exportSez: DocumentRegisterRow[] = []
  for (const d of docs) {
    if (CN_DN_TYPES.has(d.documentType)) continue
    if (
      isExportOrSezDocument({
        taxTreatment: d.taxTreatment,
        supplyType: d.supplyType,
        placeOfSupply: d.placeOfSupply,
      })
    ) {
      exportSez.push(d)
    } else if (d.partyGstin && d.partyGstin.trim().length >= 15) b2b.push(d)
    else b2c.push(d)
  }
  const parts = partitionExportSezDocs(exportSez)
  const creditDebitNotes = collapseToDocumentRows(rows.filter((r) => CN_DN_TYPES.has(r.documentType) && r.direction === 'OUTWARD'))
  const hsn = buildHsnRegister(outward)
  const taxable = moneyRound(docs.reduce((s, d) => s + d.taxableValue, 0))
  const tax = moneyRound(docs.reduce((s, d) => s + d.totalTax, 0))
  return {
    b2b,
    b2c,
    creditDebitNotes,
    exportSez,
    exportSezWpay: parts.wpay,
    exportSezWopay: parts.wopay,
    hsn,
    totals: {
      outwardTaxable: taxable,
      taxLiability: tax,
      documentCount: docs.length,
    },
  }
}

export function buildGstr3bSummary(rows: LedgerRowLike[]): Gstr3bPrepSummary {
  const output = emptyComponents()
  const inward = emptyComponents()
  const rcm = emptyComponents()
  const itc = emptyComponents()
  const outLines = new Set<string>()
  const inLines = new Set<string>()
  const rcmLines = new Set<string>()
  const itcLines = new Set<string>()

  for (const r of rows) {
    if (OUTPUT.has(r.taxType)) {
      const lk = `${r.documentId}:${r.documentLineId ?? ''}`
      if (!outLines.has(lk)) {
        outLines.add(lk)
        output.taxableValue += r.taxableValue
      }
      addTaxComponent(output, r.taxType, r.taxAmount)
    }
    if (INPUT.has(r.taxType)) {
      const lk = `${r.documentId}:${r.documentLineId ?? ''}`
      if (!inLines.has(lk)) {
        inLines.add(lk)
        inward.taxableValue += r.taxableValue
      }
      addTaxComponent(inward, r.taxType, r.taxAmount)
      if (!itcLines.has(lk)) {
        itcLines.add(lk)
        itc.taxableValue += r.taxableValue
      }
      addTaxComponent(itc, r.taxType, r.taxAmount)
    }
    if (RCM.has(r.taxType)) {
      const lk = `${r.documentId}:${r.documentLineId ?? ''}`
      if (!rcmLines.has(lk)) {
        rcmLines.add(lk)
        rcm.taxableValue += r.taxableValue
      }
      addTaxComponent(rcm, r.taxType, r.taxAmount)
    }
  }

  const fo = finalize(output)
  const fi = finalize(inward)
  const fr = finalize(rcm)
  const fitc = finalize(itc)
  const taxLiability = moneyRound(fo.totalTax + fr.totalTax)
  const itcAvailable = fitc.totalTax
  return {
    outward: fo,
    inward: fi,
    rcm: fr,
    itc: fitc,
    taxLiability,
    itcAvailable,
    netPayable: moneyRound(taxLiability - itcAvailable),
  }
}

export function buildRegisterPayload(kind: RegisterKind, rows: LedgerRowLike[]): unknown {
  switch (kind) {
    case 'SALES':
    case 'PURCHASE':
    case 'CN_DN':
    case 'RCM':
    case 'EXPORT_SEZ':
      return { kind, items: collapseToDocumentRows(filterByKind(rows, kind)) }
    case 'HSN':
      return { kind, items: buildHsnRegister(rows) }
    case 'STATE':
      return { kind, items: buildStateRegister(rows) }
    case 'LIABILITY':
      return { kind, ...buildLiabilitySummary(rows) }
    case 'ITC':
      return { kind, ...buildItcSummary(rows) }
    case 'PAYMENT_SUMMARY':
      return { kind, ...buildPaymentSummary(rows) }
    default:
      return { kind, items: [] }
  }
}

/** Period status machine: OPEN → DRAFT → LOCKED → MARKED_FILED_EXTERNAL (unlock only before filed). */
export type ReturnPeriodStatus = 'OPEN' | 'DRAFT' | 'LOCKED' | 'MARKED_FILED_EXTERNAL'

export function canPrepareReturn(status: ReturnPeriodStatus): boolean {
  return status === 'OPEN' || status === 'DRAFT'
}

export function canLockReturn(status: ReturnPeriodStatus): boolean {
  return status === 'DRAFT'
}

export function canUnlockReturn(status: ReturnPeriodStatus): boolean {
  return status === 'LOCKED'
}

export function canMarkFiledExternal(status: ReturnPeriodStatus): boolean {
  return status === 'LOCKED' || status === 'DRAFT'
}

export function isPeriodSourceImmutable(status: ReturnPeriodStatus): boolean {
  return status === 'LOCKED' || status === 'MARKED_FILED_EXTERNAL'
}
