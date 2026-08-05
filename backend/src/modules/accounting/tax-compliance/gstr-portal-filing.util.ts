/**
 * Phase 12 — GSTR portal filing readiness & pure helpers (no I/O).
 * SIMULATED default; LIVE hard-gated like e-invoice / e-way NIC adapters.
 * Does not claim GSTN/GSP certification or FULL GST COMPLIANT.
 */
import { createHash } from 'crypto'

export type GstrFilingProviderMode = 'SIMULATED' | 'LIVE'

export type GstrFilingSessionStatusLike =
  | 'DRAFT'
  | 'PACKAGE_READY'
  | 'PENDING_CHECKER'
  | 'SUBMITTED_SIMULATED'
  | 'ACCEPTED_SIMULATED'
  | 'LIVE_BLOCKED'
  | 'FAILED'
  | 'MARKED_FILED'

export type ReturnPeriodStatusLike =
  | 'OPEN'
  | 'DRAFT'
  | 'LOCKED'
  | 'MARKED_FILED_EXTERNAL'

/** Env mode — `GST_PORTAL_FILING_PROVIDER_MODE` (default SIMULATED). */
export function resolveGstrFilingProviderMode(
  env: NodeJS.ProcessEnv = process.env,
): GstrFilingProviderMode {
  const raw = (env.GST_PORTAL_FILING_PROVIDER_MODE ?? 'SIMULATED').trim().toUpperCase()
  return raw === 'LIVE' ? 'LIVE' : 'SIMULATED'
}

/**
 * LIVE operational readiness (env only — no network).
 * Core FOS does **not** ship certified GSP/GSTN HTTP transport.
 */
export function assertLiveGstrFilingConfigured(env: NodeJS.ProcessEnv = process.env): {
  ready: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.GST_PORTAL_FILING_LIVE_UAT_CERTIFIED !== 'true') {
    blockers.push(
      'GST_PORTAL_FILING_LIVE_UAT_CERTIFIED must be "true" after certified GSP/GSTN UAT (never default)',
    )
  }
  const required = [
    'GST_PORTAL_FILING_API_BASE_URL',
    'GST_PORTAL_FILING_USERNAME',
    'GST_PORTAL_FILING_PASSWORD',
    'GST_PORTAL_FILING_CLIENT_ID',
    'GST_PORTAL_FILING_CLIENT_SECRET',
  ] as const
  for (const key of required) {
    if (!env[key]?.trim()) blockers.push(`Missing env ${key} for LIVE portal filing`)
  }
  if (env.GST_PORTAL_FILING_HTTP_TRANSPORT_READY !== 'true') {
    blockers.push(
      'GST_PORTAL_FILING_HTTP_TRANSPORT_READY is not true — core build has no certified GSP/GSTN HTTP transport (SIMULATED only until UAT connector is integrated)',
    )
  }
  return { ready: blockers.length === 0, blockers }
}

/** Package may only be frozen from a LOCKED Phase 5 period. */
export function canCreateFilingPackage(returnPeriodStatus: ReturnPeriodStatusLike): boolean {
  return returnPeriodStatus === 'LOCKED'
}

export function canSubmitFiling(status: GstrFilingSessionStatusLike): boolean {
  return status === 'PACKAGE_READY' || status === 'FAILED' || status === 'LIVE_BLOCKED'
}

export function canApproveChecker(status: GstrFilingSessionStatusLike): boolean {
  return status === 'PENDING_CHECKER'
}

export function canCaptureArn(status: GstrFilingSessionStatusLike): boolean {
  return (
    status === 'PACKAGE_READY' ||
    status === 'SUBMITTED_SIMULATED' ||
    status === 'ACCEPTED_SIMULATED' ||
    status === 'LIVE_BLOCKED' ||
    status === 'FAILED'
  )
}

export function canMarkFiledFromSession(status: GstrFilingSessionStatusLike): boolean {
  return (
    status === 'ACCEPTED_SIMULATED' ||
    status === 'SUBMITTED_SIMULATED' ||
    status === 'PACKAGE_READY' ||
    status === 'LIVE_BLOCKED'
  )
}

export function buildFilingPackageEnvelope(input: {
  returnType: 'GSTR1' | 'GSTR3B'
  returnPeriod: string
  companyGstin: string
  legalEntityId: string
  snapshot: unknown
  draftVersion: number
  packagedAt: string
}): Record<string, unknown> {
  const snapshotHash = createHash('sha256')
    .update(JSON.stringify(input.snapshot ?? {}))
    .digest('hex')
    .slice(0, 32)
  return {
    schemaVersion: 1,
    readinessLabel: 'GST_PORTAL_FILING_SIMULATED',
    disclaimer:
      'Filing package built from Phase 5 locked snapshot. Simulated submit does not reach GST portal. Not FULL GST COMPLIANT.',
    returnType: input.returnType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B',
    returnPeriod: input.returnPeriod,
    companyGstin: input.companyGstin,
    legalEntityId: input.legalEntityId,
    draftVersion: input.draftVersion,
    packagedAt: input.packagedAt,
    snapshotHash,
    snapshot: input.snapshot,
  }
}

export function simulatePortalSubmit(input: {
  returnType: 'GSTR1' | 'GSTR3B'
  returnPeriod: string
  companyGstin: string
  packageVersion: number
  snapshotHash?: string | null
}): {
  acknowledgmentRef: string
  providerRef: string
  filedOnPortalDate: string
  request: Record<string, unknown>
  response: Record<string, unknown>
} {
  const typeKey = input.returnType === 'GSTR1' ? 'G1' : 'G3'
  const seed = `${input.companyGstin}|${input.returnPeriod}|${typeKey}|${input.packageVersion}|${input.snapshotHash ?? ''}`
  const dig = createHash('sha256').update(seed).digest('hex').toUpperCase()
  const arn = `SIM-ARN-${typeKey}-${input.returnPeriod.replace('-', '')}-${dig.slice(0, 12)}`
  const providerRef = `SIM-FILING-${dig.slice(12, 28)}`
  const filedOn = new Date().toISOString().slice(0, 10)
  const request = {
    mode: 'SIMULATED',
    operation: 'SAVE_AND_FILE',
    returnType: input.returnType,
    returnPeriod: input.returnPeriod,
    companyGstin: input.companyGstin,
    packageVersion: input.packageVersion,
    snapshotHash: input.snapshotHash ?? null,
  }
  const response = {
    mode: 'SIMULATED',
    status: 'ACCEPTED',
    acknowledgmentRef: arn,
    providerRef,
    filedOnPortalDate: filedOn,
    note: 'Local simulation only — not submitted to GSTN/GSP.',
  }
  return {
    acknowledgmentRef: arn,
    providerRef,
    filedOnPortalDate: filedOn,
    request,
    response,
  }
}

export function getPortalFilingCapabilitySummary(env: NodeJS.ProcessEnv = process.env): {
  providerMode: GstrFilingProviderMode
  isSimulated: boolean
  liveReady: boolean
  liveBlockers: string[]
  verdict: 'READY_WITH_CONDITIONS'
  notFullGstCompliant: true
  note: string
} {
  const mode = resolveGstrFilingProviderMode(env)
  const live = assertLiveGstrFilingConfigured(env)
  return {
    providerMode: mode,
    isSimulated: mode === 'SIMULATED',
    liveReady: mode === 'LIVE' && live.ready,
    liveBlockers: mode === 'LIVE' ? live.blockers : [],
    verdict: 'READY_WITH_CONDITIONS',
    notFullGstCompliant: true,
    note:
      mode === 'SIMULATED'
        ? 'Portal filing is SIMULATED by default. Packages reuse Phase 5 locked returns; ARN is local. Not GST portal success.'
        : live.ready
          ? 'LIVE mode gates passed but core ship has no registered HTTP transport factory — treat as blocked until connector integrates.'
          : `LIVE mode selected but blocked: ${live.blockers.join('; ')}`,
  }
}
