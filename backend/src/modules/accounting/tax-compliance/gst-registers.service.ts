/**
 * Phase 5 — live GST registers / GSTR prep from `gst_ledger_entries` (posted snapshots).
 */
import { prisma } from '../../../config/prisma.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  buildRegisterPayload,
  buildGstr1Sections,
  buildGstr3bSummary,
  type LedgerRowLike,
  type RegisterKind,
} from './gstr-registers.util.js'
import { filterLedgerRowsForGstinIsolation } from './gst-registration-scope.util.js'

function num(v: { toString(): string } | number | string | null | undefined): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapRows(
  rows: Array<{
    id: string
    documentId: string
    documentNumber: string
    documentDate: Date
    documentType: string
    documentLineId: string
    direction: 'OUTWARD' | 'INWARD'
    partyGstin: string | null
    companyGstin: string | null
    placeOfSupply: string | null
    hsnSacCode: string | null
    taxType: string
    taxableValue: unknown
    taxRate: unknown
    taxAmount: unknown
    isReverseCharge: boolean
    itcEligibility: string | null
    filingStatus: string
    sourceSnapshot?: unknown
  }>,
): LedgerRowLike[] {
  return rows.map((r) => {
    const snap =
      r.sourceSnapshot && typeof r.sourceSnapshot === 'object'
        ? (r.sourceSnapshot as Record<string, unknown>)
        : null
    return {
      id: r.id,
      documentId: r.documentId,
      documentNumber: r.documentNumber,
      documentDate: r.documentDate.toISOString().slice(0, 10),
      documentType: r.documentType,
      documentLineId: r.documentLineId || null,
      direction: r.direction,
      partyGstin: r.partyGstin,
      companyGstin: r.companyGstin,
      placeOfSupply: r.placeOfSupply,
      hsnSacCode: r.hsnSacCode,
      taxType: r.taxType,
      taxableValue: num(r.taxableValue as never),
      taxRate: num(r.taxRate as never),
      taxAmount: num(r.taxAmount as never),
      isReverseCharge: r.isReverseCharge,
      itcEligibility: r.itcEligibility,
      filingStatus: r.filingStatus,
      taxTreatment: (snap?.taxTreatment as string | undefined) ?? null,
      supplyType: (snap?.supplyType as string | undefined) ?? null,
      zeroRatedMode: (snap?.zeroRatedMode as string | undefined) ?? null,
    }
  })
}

export async function loadLedgerRowsForPeriod(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  /**
   * Phase 9: when true (default), only exact companyGstin match — no cross-GSTIN leak.
   * Set allowLegacyOrphans to include pre-Phase-9 rows with null companyGstin (migration only).
   */
  allowLegacyOrphans?: boolean
}): Promise<LedgerRowLike[]> {
  const where: {
    tenantId: string
    legalEntityId: string
    returnPeriod: string
    companyGstin?: string | { in: string[] } | null
    OR?: Array<{ companyGstin: string } | { companyGstin: null }>
  } = {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
  }

  const g = params.companyGstin?.trim().toUpperCase() || null
  const allowLegacy =
    params.allowLegacyOrphans === true || process.env.GST_MULTI_GSTIN_ALLOW_LEGACY_ORPHANS === 'true'

  if (g) {
    if (allowLegacy) {
      where.OR = [{ companyGstin: g }, { companyGstin: null }]
    } else {
      where.companyGstin = g
    }
  }

  const rows = await prisma.gstLedgerEntry.findMany({
    where,
    orderBy: [{ documentDate: 'asc' }, { documentNumber: 'asc' }],
  })

  let mapped = mapRows(rows as never)
  if (g) {
    mapped = filterLedgerRowsForGstinIsolation(mapped, g, { allowLegacyOrphans: allowLegacy })
  }
  return mapped
}

export async function getGstRegister(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  kind: RegisterKind
}): Promise<Record<string, unknown>> {
  const le = await getLegalEntityOrThrow(params.tenantId, params.legalEntityId)
  const gstin = (params.companyGstin ?? le.gstin ?? '').trim().toUpperCase() || null
  const rows = await loadLedgerRowsForPeriod({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: gstin,
  })
  const payload = buildRegisterPayload(params.kind, rows) as Record<string, unknown>
  return {
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: gstin,
    source: 'GST_LEDGER',
    readinessLabel: 'GST_RETURNS_PREPARATION',
    disclaimer:
      'Registers are prepared from posted GST ledger snapshots. Not a portal filing and not FULL GST COMPLIANT.',
    ...payload,
  }
}

export async function getGstr1Preparation(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}): Promise<Record<string, unknown>> {
  const le = await getLegalEntityOrThrow(params.tenantId, params.legalEntityId)
  const gstin = (params.companyGstin ?? le.gstin ?? '').trim().toUpperCase() || null
  const rows = await loadLedgerRowsForPeriod({ ...params, companyGstin: gstin })
  const sections = buildGstr1Sections(rows)
  return {
    returnType: 'GSTR1',
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: gstin,
    source: 'GST_LEDGER',
    ...sections,
    outwardTaxable: sections.totals.outwardTaxable,
    taxLiability: sections.totals.taxLiability,
    itcAvailable: 0,
    netPayable: sections.totals.taxLiability,
    disclaimer: 'GSTR-1 preparation only — no GST portal submit (Phase 12).',
  }
}

export async function getGstr3bPreparation(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}): Promise<Record<string, unknown>> {
  const le = await getLegalEntityOrThrow(params.tenantId, params.legalEntityId)
  const gstin = (params.companyGstin ?? le.gstin ?? '').trim().toUpperCase() || null
  const rows = await loadLedgerRowsForPeriod({ ...params, companyGstin: gstin })
  const summary = buildGstr3bSummary(rows)
  return {
    returnType: 'GSTR3B',
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: gstin,
    source: 'GST_LEDGER',
    ...summary,
    outwardTaxable: summary.outward.taxableValue,
    disclaimer: 'GSTR-3B preparation only — no portal liability confirmation or challan (Phases 8/12).',
    formatHint: {
      outwardTaxable: formatForPersistence(summary.outward.taxableValue),
      taxLiability: formatForPersistence(summary.taxLiability),
    },
  }
}
