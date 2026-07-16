import type { OpportunityStage } from '../types/crm'

export type StageThemeTokens = {
  accent: string
  gradient: string
  header: string
  pill: string
  funnel: string
}

const DEFAULT_STAGE_THEME: StageThemeTokens = {
  accent: 'bg-slate-400',
  gradient: 'from-slate-400 to-slate-500',
  header: 'border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-erp-surface',
  pill: 'bg-slate-100 text-slate-700',
  funnel: '#6366f1',
}

export const STAGE_THEME: Record<OpportunityStage, StageThemeTokens> = {
  new_lead: {
    accent: 'bg-blue-500',
    gradient: 'from-blue-500 to-blue-600',
    header: 'border-blue-200/80 bg-gradient-to-b from-blue-50/90 to-erp-surface',
    pill: 'bg-blue-100 text-blue-800',
    funnel: '#3b82f6',
  },
  qualified: {
    accent: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-cyan-600',
    header: 'border-cyan-200/80 bg-gradient-to-b from-cyan-50/90 to-erp-surface',
    pill: 'bg-cyan-100 text-cyan-800',
    funnel: '#06b6d4',
  },
  requirement_discussion: {
    accent: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-indigo-600',
    header: 'border-indigo-200/80 bg-gradient-to-b from-indigo-50/90 to-erp-surface',
    pill: 'bg-indigo-100 text-indigo-800',
    funnel: '#6366f1',
  },
  technical_review: {
    accent: 'bg-violet-500',
    gradient: 'from-violet-500 to-violet-600',
    header: 'border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-erp-surface',
    pill: 'bg-violet-100 text-violet-800',
    funnel: '#8b5cf6',
  },
  quotation_prepared: {
    accent: 'bg-purple-500',
    gradient: 'from-purple-500 to-purple-600',
    header: 'border-purple-200/80 bg-gradient-to-b from-purple-50/90 to-erp-surface',
    pill: 'bg-purple-100 text-purple-800',
    funnel: '#a855f7',
  },
  quotation_sent: {
    accent: 'bg-fuchsia-500',
    gradient: 'from-fuchsia-500 to-fuchsia-600',
    header: 'border-fuchsia-200/80 bg-gradient-to-b from-fuchsia-50/90 to-erp-surface',
    pill: 'bg-fuchsia-100 text-fuchsia-800',
    funnel: '#d946ef',
  },
  negotiation: {
    accent: 'bg-amber-500',
    gradient: 'from-amber-500 to-amber-600',
    header: 'border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-erp-surface',
    pill: 'bg-amber-100 text-amber-800',
    funnel: '#f59e0b',
  },
  won: {
    accent: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-emerald-600',
    header: 'border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-erp-surface',
    pill: 'bg-emerald-100 text-emerald-800',
    funnel: '#10b981',
  },
  lost: {
    accent: 'bg-red-500',
    gradient: 'from-red-500 to-red-600',
    header: 'border-red-200/80 bg-gradient-to-b from-red-50/90 to-erp-surface',
    pill: 'bg-red-100 text-red-800',
    funnel: '#ef4444',
  },
  on_hold: {
    accent: 'bg-slate-400',
    gradient: 'from-slate-400 to-slate-500',
    header: 'border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-erp-surface',
    pill: 'bg-slate-100 text-slate-700',
    funnel: '#94a3b8',
  },
}

export const CLOSED_STAGES = new Set<OpportunityStage>(['won', 'lost'])

/**
 * Safe theme lookup for pipeline/funnel UI.
 * Master-driven stage codes (or legacy slugs) may not exist in STAGE_THEME —
 * never throw on missing keys.
 */
export function resolveStageTheme(stageId: string | null | undefined): StageThemeTokens {
  if (!stageId) return DEFAULT_STAGE_THEME
  const known = STAGE_THEME[stageId as OpportunityStage]
  if (known) return known
  return DEFAULT_STAGE_THEME
}

/** Funnel / chart fill color for any stage slug. */
export function resolveStageFunnelColor(stageId: string | null | undefined): string {
  return resolveStageTheme(stageId).funnel
}
