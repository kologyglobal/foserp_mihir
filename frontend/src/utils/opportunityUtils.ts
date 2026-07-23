import type { OpportunityPriority, OpportunityStage } from '../types/crm'
import { OPPORTUNITY_STAGES, STAGE_LABEL } from '../types/crm'
import type { CrmMasterEntry } from '../types/crmMasters'
import { getCrmMasterEntries, getCrmMasterLabel } from '../store/crmMasterStore'

export interface OpportunityStageOption {
  id: OpportunityStage
  label: string
  probability?: number
  stageType?: string
  color?: string
}

const DEFAULT_PRIORITIES: { value: OpportunityPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const LEGACY_PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  normal: 'Normal',
  strategic: 'Strategic',
}

function mapStageEntry(e: CrmMasterEntry): OpportunityStageOption {
  const prob = e.attributes.probability
  return {
    id: e.code as OpportunityStage,
    label: e.name,
    probability: typeof prob === 'number' ? prob : undefined,
    stageType: e.attributes.stageType != null ? String(e.attributes.stageType) : undefined,
    color: e.attributes.color != null ? String(e.attributes.color) : undefined,
  }
}

/** Map master entries (or static fallback) to stage options — used by hooks and non-reactive resolvers. */
export function resolveOpportunityStagesFromEntries(entries: CrmMasterEntry[]): OpportunityStageOption[] {
  if (entries.length > 0) return entries.map(mapStageEntry)
  return OPPORTUNITY_STAGES.map((s) => ({ id: s.id, label: s.label }))
}

/** Active opportunity stages from CRM Master Setup (falls back to defaults). Prefer useResolvedOpportunityStages() in React components. */
export function resolveOpportunityStages(): OpportunityStageOption[] {
  return resolveOpportunityStagesFromEntries(getCrmMasterEntries('opportunity-stages', true))
}

export function opportunityStageLabel(stage: string): string {
  const fromMaster = getCrmMasterLabel('opportunity-stages', stage)
  if (fromMaster && fromMaster !== stage) return fromMaster
  return STAGE_LABEL[stage as OpportunityStage] ?? stage
}

export function getStageProbability(stage: OpportunityStage): number | undefined {
  const entry = getCrmMasterEntries('opportunity-stages', false).find((e) => e.code === stage)
  const prob = entry?.attributes.probability
  return typeof prob === 'number' ? prob : undefined
}

export function resolveOpportunityPriorityOptions(): { value: OpportunityPriority; label: string }[] {
  const entries = getCrmMasterEntries('opportunity-priorities', true)
  if (entries.length > 0) {
    return entries.map((e) => ({ value: e.code as OpportunityPriority, label: e.name }))
  }
  return DEFAULT_PRIORITIES
}

export function opportunityPriorityLabel(priority: string): string {
  const fromMaster = getCrmMasterLabel('opportunity-priorities', priority)
  if (fromMaster && fromMaster !== priority) return fromMaster
  return LEGACY_PRIORITY_LABELS[priority] ?? priority
}

export interface LostReasonOption {
  value: string
  label: string
}

export function resolveLostReasonOptions(): LostReasonOption[] {
  const entries = getCrmMasterEntries('lost-reasons', true)
  return entries.map((e) => ({
    value: e.code,
    label: e.name,
  }))
}

/** @deprecated Competitor Master removed — returns reason code only. */
export function formatLostReason(lostReasonCode: string, _competitorCode?: string): string {
  return parseLostReason(lostReasonCode).code || lostReasonCode
}

export function parseLostReason(stored: string): { code: string; competitorCode?: string } {
  const pipe = stored.indexOf('|')
  if (pipe > 0) {
    return { code: stored.slice(0, pipe), competitorCode: stored.slice(pipe + 1) }
  }
  return { code: stored }
}

export function displayLostReason(stored: string | null | undefined): string {
  if (!stored?.trim()) return '—'
  const { code, competitorCode } = parseLostReason(stored)
  const reasonLabel = getCrmMasterLabel('lost-reasons', code)
  const base = reasonLabel && reasonLabel !== code ? reasonLabel : stored
  if (competitorCode) {
    return `${base} — ${competitorCode}`
  }
  return base
}

export const CLOSED_OPPORTUNITY_STAGES = new Set<OpportunityStage>(['won', 'lost'])

export function openOpportunityStages(stages?: OpportunityStageOption[]): OpportunityStageOption[] {
  const all = stages ?? resolveOpportunityStages()
  return all.filter((s) => !CLOSED_OPPORTUNITY_STAGES.has(s.id) && s.id !== 'on_hold')
}

/** Pipeline stages for Dynamics detail stepper */
export function buildOpportunityPipelineStages(stage: OpportunityStage, stages?: OpportunityStageOption[]) {
  const all = stages ?? resolveOpportunityStages()
  const open = openOpportunityStages(all)
  const closed = stage === 'won' || stage === 'lost' || stage === 'on_hold'
  const isLost = stage === 'lost'
  if (closed) {
    return [
      ...open.map((s) => ({
        id: s.id,
        label: s.label,
        isPast: true,
        isCurrent: false,
        isLost: false,
        completedAt: null as string | null,
      })),
      {
        id: stage,
        label: all.find((s) => s.id === stage)?.label ?? opportunityStageLabel(stage),
        isPast: false,
        isCurrent: true,
        isLost,
        completedAt: null as string | null,
      },
    ]
  }
  const idx = Math.max(0, open.findIndex((s) => s.id === stage))
  return open.map((s, i) => ({
    id: s.id,
    label: s.label,
    isPast: i < idx,
    isCurrent: s.id === stage,
    isLost: false,
    completedAt: null as string | null,
  }))
}

export type OpportunitySortKey =
  | 'lastModified'
  | 'value'
  | 'closeDate'
  | 'probability'
  | 'name'
  | 'stage'
  | 'owner'
  | 'lastActivity'

export interface OpportunityListFilters {
  search: string
  stage: OpportunityStage | ''
  owner: string
  lostReason: string
}

export function hasActiveOpportunityFilters(filters: OpportunityListFilters): boolean {
  return (
    Boolean(filters.search.trim())
    || Boolean(filters.stage)
    || Boolean(filters.owner)
    || Boolean(filters.lostReason)
  )
}

export function sortOpportunities<T extends {
  opportunityName: string
  value: number
  probability: number
  expectedCloseDate: string
  ownerName: string
  stage: OpportunityStage
  lastActivityAt: string | null
  modifiedAt?: string | null
  createdAt?: string | null
}>(rows: T[], sortBy: OpportunitySortKey): T[] {
  const sorted = [...rows]
  const stageOrder = resolveOpportunityStages().map((s) => s.id)
  const stageRank = (stage: OpportunityStage) => {
    const i = stageOrder.indexOf(stage)
    return i >= 0 ? i : stageOrder.length
  }
  const lastTouched = (row: T) => row.modifiedAt || row.createdAt || row.lastActivityAt || ''

  switch (sortBy) {
    case 'lastModified':
      sorted.sort((a, b) => lastTouched(b).localeCompare(lastTouched(a)))
      break
    case 'closeDate':
      sorted.sort((a, b) => (a.expectedCloseDate || '9999-12-31').localeCompare(b.expectedCloseDate || '9999-12-31'))
      break
    case 'probability':
      sorted.sort((a, b) => b.probability - a.probability)
      break
    case 'name':
      sorted.sort((a, b) => a.opportunityName.localeCompare(b.opportunityName))
      break
    case 'stage':
      sorted.sort((a, b) => stageRank(a.stage) - stageRank(b.stage))
      break
    case 'owner':
      sorted.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
      break
    case 'lastActivity':
      sorted.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
      break
    case 'value':
    default:
      sorted.sort((a, b) => b.value - a.value)
      break
  }
  return sorted
}

/**
 * HubSpot-style deal name: company first, then primary product when known.
 * Examples: "UltraTech Cement" · "UltraTech Cement - 26 KL ISO Tank"
 */
export function buildHubSpotStyleOpportunityName(parts: {
  companyName?: string | null
  productName?: string | null
  contactName?: string | null
  prospectName?: string | null
}): string {
  const company = (parts.companyName ?? parts.prospectName ?? '').trim()
  const product = (parts.productName ?? '').trim()
  const contact = (parts.contactName ?? '').trim()
  if (company && product) return `${company} - ${product}`
  if (company) return company
  if (product) return product
  if (contact) return contact
  return ''
}

/** True when the current name still matches an auto-generated HubSpot-style value (safe to keep syncing). */
export function isAutoOpportunityName(
  current: string,
  parts: Parameters<typeof buildHubSpotStyleOpportunityName>[0],
): boolean {
  const trimmed = current.trim()
  if (!trimmed) return true
  const company = (parts.companyName ?? parts.prospectName ?? '').trim()
  const product = (parts.productName ?? '').trim()
  if (!company && !product) return true
  if (trimmed === company) return true
  if (product && trimmed === `${company} - ${product}`) return true
  if (product && trimmed === product) return true
  // Still auto if user only had company and we are about to append product
  if (company && product && trimmed === company) return true
  return false
}

