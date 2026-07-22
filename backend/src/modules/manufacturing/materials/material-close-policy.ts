/**
 * Work Order material close policy (Phase 7A).
 * Defaults are tenant-safe without requiring a DB row.
 * Override via env MANUFACTURING_MATERIAL_CLOSE_POLICY when needed for pilots.
 */

export const MATERIAL_CLOSE_POLICIES = [
  'STRICT_RECONCILIATION',
  'TOLERANCE_BASED',
  'MANAGER_APPROVAL',
] as const

export type MaterialClosePolicy = (typeof MATERIAL_CLOSE_POLICIES)[number]

export type MaterialClosePolicyConfig = {
  policy: MaterialClosePolicy
  /** Absolute qty variance allowed under TOLERANCE_BASED (per line). */
  varianceAbsQty: number
  /** Percent variance allowed under TOLERANCE_BASED (of required). */
  variancePercent: number
  unusedMaterialMustReturn: boolean
  unresolvedSubstitutionBlocksClose: boolean
  openReservationBlocksClose: boolean
  unissuedShortageBlocksOperationalCompletion: boolean
  openDifferenceRequiresApproval: boolean
}

const DEFAULTS: Record<MaterialClosePolicy, MaterialClosePolicyConfig> = {
  STRICT_RECONCILIATION: {
    policy: 'STRICT_RECONCILIATION',
    varianceAbsQty: 0,
    variancePercent: 0,
    unusedMaterialMustReturn: true,
    unresolvedSubstitutionBlocksClose: true,
    openReservationBlocksClose: true,
    unissuedShortageBlocksOperationalCompletion: true,
    openDifferenceRequiresApproval: false,
  },
  TOLERANCE_BASED: {
    policy: 'TOLERANCE_BASED',
    varianceAbsQty: 0,
    variancePercent: 2,
    unusedMaterialMustReturn: false,
    unresolvedSubstitutionBlocksClose: true,
    openReservationBlocksClose: true,
    unissuedShortageBlocksOperationalCompletion: false,
    openDifferenceRequiresApproval: false,
  },
  MANAGER_APPROVAL: {
    policy: 'MANAGER_APPROVAL',
    varianceAbsQty: 0,
    variancePercent: 5,
    unusedMaterialMustReturn: false,
    unresolvedSubstitutionBlocksClose: false,
    openReservationBlocksClose: true,
    unissuedShortageBlocksOperationalCompletion: false,
    openDifferenceRequiresApproval: true,
  },
}

export function resolveMaterialClosePolicy(): MaterialClosePolicyConfig {
  const raw = (process.env.MANUFACTURING_MATERIAL_CLOSE_POLICY ?? 'TOLERANCE_BASED').trim().toUpperCase()
  const policy = (MATERIAL_CLOSE_POLICIES.includes(raw as MaterialClosePolicy)
    ? raw
    : 'TOLERANCE_BASED') as MaterialClosePolicy
  return { ...DEFAULTS[policy] }
}
