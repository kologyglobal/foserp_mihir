/**
 * Phase 9 — multi-GSTIN / multi-branch scope helpers (pure).
 * Hard isolation: never mix distinct company GSTINs in one return/register slice.
 */
export type GstRegistrationSlice = {
  legalEntityId: string
  branchId: string | null
  gstin: string
  stateCode: string | null
  source: 'BRANCH' | 'LEGAL_ENTITY' | 'EXPLICIT'
  isBranchScoped: boolean
}

export type BranchTransferTaxPolicy =
  | 'NOT_CONFIGURED'
  | 'SAME_GSTIN_STOCK_NO_TAX'
  | 'CROSS_GSTIN_TAXABLE_SUPPLY'
  | 'PROHIBITED'

export function normalizeGstin(value: string | null | undefined): string | null {
  const g = (value ?? '').trim().toUpperCase()
  // GSTIN / UIN lengths are typically 15; shorter tokens are ignored for isolation.
  if (g.length < 15) return null
  return g
}

/**
 * Prefer branch GSTIN when document is branch-scoped; else LE GSTIN.
 * Explicit override wins (e.g. already snapshotted companyGstin on AP).
 */
export function resolveCompanyGstinScope(input: {
  legalEntityId: string
  legalEntityGstin?: string | null
  legalEntityStateCode?: string | null
  branchId?: string | null
  branchGstin?: string | null
  branchStateCode?: string | null
  explicitCompanyGstin?: string | null
}): GstRegistrationSlice | { ok: false; message: string } {
  if (input.explicitCompanyGstin != null && input.explicitCompanyGstin.trim()) {
    const g = normalizeGstin(input.explicitCompanyGstin)
    if (!g) return { ok: false, message: 'explicit company GSTIN is invalid' }
    return {
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      gstin: g,
      stateCode: input.branchStateCode ?? input.legalEntityStateCode ?? null,
      source: 'EXPLICIT',
      isBranchScoped: Boolean(input.branchId && input.branchGstin),
    }
  }

  const branchGstin = normalizeGstin(input.branchGstin)
  if (input.branchId && branchGstin) {
    return {
      legalEntityId: input.legalEntityId,
      branchId: input.branchId,
      gstin: branchGstin,
      stateCode: input.branchStateCode ?? input.legalEntityStateCode ?? null,
      source: 'BRANCH',
      isBranchScoped: true,
    }
  }

  const leGstin = normalizeGstin(input.legalEntityGstin)
  if (!leGstin) {
    return {
      ok: false,
      message: 'No company GSTIN resolved — set Legal Entity GSTIN or Branch GSTIN',
    }
  }
  return {
    legalEntityId: input.legalEntityId,
    branchId: input.branchId ?? null,
    gstin: leGstin,
    stateCode: input.legalEntityStateCode ?? null,
    source: 'LEGAL_ENTITY',
    isBranchScoped: false,
  }
}

/** Ledger rows for a GSTIN slice — hard isolation (excludes null unless allowLegacyOrphans). */
export function filterLedgerRowsForGstinIsolation<T extends { companyGstin?: string | null }>(
  rows: T[],
  companyGstin: string,
  opts?: { allowLegacyOrphans?: boolean },
): T[] {
  const g = normalizeGstin(companyGstin)
  if (!g) return []
  const allowLegacy = opts?.allowLegacyOrphans === true
  return rows.filter((r) => {
    const rowG = normalizeGstin(r.companyGstin ?? null)
    if (rowG === g) return true
    if (!rowG && allowLegacy) return true
    return false
  })
}

/** Detect contamination: two different non-null GSTINs in the same working set. */
export function detectGstinContamination(gstins: Array<string | null | undefined>): {
  contaminated: boolean
  distinct: string[]
} {
  const set = new Set<string>()
  for (const raw of gstins) {
    const g = normalizeGstin(raw)
    if (g) set.add(g)
  }
  const distinct = [...set]
  return { contaminated: distinct.length > 1, distinct }
}

/**
 * Policy-driven branch transfer tax treatment.
 * Same GSTIN stock move → often no tax; different GSTIN → taxable supply or prohibited.
 */
export function resolveBranchTransferTaxTreatment(input: {
  policy: BranchTransferTaxPolicy
  fromGstin: string | null | undefined
  toGstin: string | null | undefined
}): {
  allowed: boolean
  chargeGst: boolean
  reason: string
} {
  const from = normalizeGstin(input.fromGstin)
  const to = normalizeGstin(input.toGstin)
  if (!from || !to) {
    return { allowed: false, chargeGst: false, reason: 'Both branch GSTINs must be configured for transfer' }
  }

  const same = from === to
  switch (input.policy) {
    case 'NOT_CONFIGURED':
      return {
        allowed: false,
        chargeGst: false,
        reason: 'Branch transfer tax policy is NOT_CONFIGURED — set policy on legal entity before transfers',
      }
    case 'PROHIBITED':
      return { allowed: false, chargeGst: false, reason: 'Branch transfers are prohibited by legal entity policy' }
    case 'SAME_GSTIN_STOCK_NO_TAX':
      if (!same) {
        return {
          allowed: false,
          chargeGst: true,
          reason: 'Policy allows only same-GSTIN stock transfers without tax — cross-GSTIN needs CROSS_GSTIN_TAXABLE_SUPPLY',
        }
      }
      return { allowed: true, chargeGst: false, reason: 'Same GSTIN — stock transfer without GST per policy' }
    case 'CROSS_GSTIN_TAXABLE_SUPPLY':
      if (same) {
        return { allowed: true, chargeGst: false, reason: 'Same GSTIN under cross-GSTIN policy — treat as non-tax book move' }
      }
      return {
        allowed: true,
        chargeGst: true,
        reason: 'Cross-GSTIN transfer — charge GST as taxable supply per policy',
      }
    default:
      return { allowed: false, chargeGst: false, reason: 'Unknown branch transfer tax policy' }
  }
}

/** Build document series prefix hint (registration / branch / LE). Does not allocate numbers. */
export function buildSeriesPrefixHint(input: {
  registrationSeriesPrefix?: string | null
  branchCode?: string | null
  legalEntityCode?: string | null
  documentHint?: string | null
}): string {
  const reg = input.registrationSeriesPrefix?.trim()
  if (reg) return reg.toUpperCase()
  const parts = [
    input.legalEntityCode?.trim().toUpperCase(),
    input.branchCode?.trim().toUpperCase(),
    input.documentHint?.trim().toUpperCase(),
  ].filter(Boolean)
  return parts.join('-') || 'GST'
}
