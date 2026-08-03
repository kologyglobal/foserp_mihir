import type { CrmOpportunity, PipelineStage } from '@/types/crm'
import { formatDate, titleCaseLabel } from '@/features/crm/utils'
import { colors } from '@/theme'

export function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

export function isGenericOppTitle(value: string): boolean {
  const t = value.trim().toLowerCase()
  return !t || t === 'opportunity' || t === 'opportunities' || t === 'new opportunity'
}

export function oppAmount(o: CrmOpportunity): number {
  const n = Number(o.amount ?? o.value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** CRM company — primary identity on cards. */
export function companyOf(o: CrmOpportunity): string {
  const fromApi = str(o.companyName) || str(o.customerName)
  if (fromApi) return fromApi
  const title = str(o.opportunityName) || str(o.name)
  if (title && !isGenericOppTitle(title)) return title
  return 'Unknown company'
}

export function opportunityTitleOf(o: CrmOpportunity): string {
  const t = str(o.opportunityName) || str(o.name)
  if (!t || isGenericOppTitle(t)) return ''
  const company = str(o.companyName) || str(o.customerName)
  if (company && t.toLowerCase() === company.toLowerCase()) return ''
  return t
}

export function productOf(o: CrmOpportunity): string {
  const lines = Array.isArray(o.lines) ? o.lines : []
  const labels = lines
    .map((l) => str(l.productOrItem) || str(l.description))
    .filter(Boolean)
  if (labels.length === 1) return labels[0]!
  if (labels.length > 1) return `${labels[0]} + ${labels.length - 1} more`

  const req = str(o.productRequirement)
  if (req && !req.startsWith('{')) return req

  return opportunityTitleOf(o)
}

export function ownerOf(o: CrmOpportunity): string {
  return str(o.ownerName) || 'Unassigned'
}

export function contactOf(o: CrmOpportunity): string {
  return str(o.contactName) || str(o.contactPerson) || str(o.primaryContactName) || ''
}

export function companyIdOf(o: CrmOpportunity): string {
  return str(o.customerId) || str(o.companyId)
}

export function stageLabelOf(o: CrmOpportunity, stages: PipelineStage[]): string {
  const byId = stages.find((s) => s.id === o.stageId)
  if (byId) return byId.name
  const key = str(o.stageName || o.stage || o.status).toLowerCase()
  const bySlug = stages.find(
    (s) => s.slug.toLowerCase() === key || s.name.toLowerCase() === key,
  )
  if (bySlug) return bySlug.name
  return titleCaseLabel(o.stageName || o.stage || o.status, 'Open')
}

export function stageIdOf(o: CrmOpportunity, stages: PipelineStage[]): string | null {
  if (o.stageId && stages.some((s) => s.id === o.stageId)) return o.stageId
  const key = str(o.stageName || o.stage || o.status).toLowerCase()
  const hit = stages.find(
    (s) => s.slug.toLowerCase() === key || s.name.toLowerCase() === key,
  )
  return hit?.id ?? null
}

export function parseDay(value?: string | null): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  const ymd = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function startOfToday(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

export function isClosedStage(stage: PipelineStage | undefined, label: string): boolean {
  if (stage?.isClosedWon || stage?.isClosedLost) return true
  const s = label.toLowerCase()
  return s.includes('won') || s.includes('lost') || s.includes('closed')
}

export function dueMeta(expectedCloseDate?: string | null): {
  label: string
  color: string
} {
  const d = parseDay(expectedCloseDate)
  if (!d) return { label: 'No close date', color: colors.textMuted }
  const today = startOfToday()
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) {
    return { label: `Overdue · ${formatDate(expectedCloseDate)}`, color: colors.danger }
  }
  if (diff === 0) return { label: 'Due today', color: colors.danger }
  if (diff === 1) return { label: 'Due tomorrow', color: colors.orange }
  return { label: formatDate(expectedCloseDate), color: colors.textMuted }
}

/**
 * Ranked open opportunities for the focus deck:
 * overdue → due today → soon → higher value.
 * Caps at 25 so the deck stays actionable.
 */
export function buildTodayFocusList(
  all: CrmOpportunity[],
  stages: PipelineStage[],
  options?: { snoozedIds?: Set<string>; dismissedIds?: Set<string>; limit?: number },
): CrmOpportunity[] {
  const snoozed = options?.snoozedIds ?? new Set<string>()
  const dismissed = options?.dismissedIds ?? new Set<string>()
  const limit = options?.limit ?? 25
  const today = startOfToday().getTime()

  const open = all.filter((o) => {
    if (snoozed.has(o.id) || dismissed.has(o.id)) return false
    const sid = stageIdOf(o, stages)
    const stage = stages.find((s) => s.id === sid)
    return !isClosedStage(stage, stageLabelOf(o, stages))
  })

  const scored = open.map((o) => {
    const day = parseDay(o.expectedCloseDate)
    const dayMs = day?.getTime() ?? Number.POSITIVE_INFINITY
    const daysOut = Math.round((dayMs - today) / 86_400_000)
    const isOverdue = day != null && daysOut < 0
    const isToday = day != null && daysOut === 0
    const isSoon = day != null && daysOut > 0 && daysOut <= 14
    // Prefer dated deals; undated still appear after dated ones
    let rank = 3
    if (isOverdue) rank = 0
    else if (isToday) rank = 1
    else if (isSoon) rank = 2
    return { o, rank, daysOut: Math.abs(daysOut), amount: oppAmount(o) }
  })

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.daysOut !== b.daysOut) return a.daysOut - b.daysOut
    return b.amount - a.amount
  })

  return scored.slice(0, limit).map((s) => s.o)
}
