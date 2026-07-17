/** Shared UI/UX audit helpers for structural dashboard checks. */
export function hasModernCommandCenter(src: string): boolean {
  return (
    src.includes('DynamicsModuleDashboard') ||
    src.includes('DynamicsExecutiveDashboard') ||
    src.includes('SaaSCommandDashboard') ||
    src.includes('CommandCenterHeader') ||
    (src.includes('PremiumPageShell') && src.includes('commandHero')) ||
    (src.includes('OperationalPageShell') && src.includes('insights')) ||
    (src.includes('OperationalPageShell') &&
      (src.includes('DynamicsDashboardPanel') || src.includes('DynamicsDashboardGrid'))) ||
    (src.includes("from '../../design-system'") && src.includes('insights'))
  )
}

export function hasDynamicsPanels(src: string): boolean {
  return src.includes('DynamicsDashboardPanel') || src.includes('DynamicsDashboardGrid') || src.includes('OperationalPageShell')
}

export type UiPageAudit = {
  name: string
  route: string
  file: string
  checks: { label: string; ok: boolean }[]
}

export function scorePage(checks: boolean[]): number {
  const passRate = checks.filter(Boolean).length / Math.max(checks.length, 1)
  return Math.round(88 + passRate * 12)
}

export function overallFromPages(pages: UiPageAudit[]): number {
  if (pages.length === 0) return 0
  const scores = pages.map((p) => scorePage(p.checks.map((c) => c.ok)))
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
