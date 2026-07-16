import { useMemo } from 'react'
import { useDesignTokens } from '../ThemeProvider'
import type { TypographyRole } from '../theme/typography'

export function useTypographyClass(role: TypographyRole): string {
  const { typography } = useDesignTokens()
  return useMemo(() => {
    const map: Record<TypographyRole, string> = {
      pageTitle: 'ds-type-page-title',
      workspaceTitle: 'ds-type-workspace-title',
      sectionTitle: 'ds-type-section-title',
      cardTitle: 'ds-type-card-title',
      tableHeader: 'ds-type-table-header',
      body: 'ds-type-body',
      caption: 'ds-type-caption',
      helper: 'ds-type-helper',
      button: 'ds-type-button',
      kpiNumber: 'ds-type-kpi',
    }
    void typography
    return map[role]
  }, [typography, role])
}

export function useSpacing(token: keyof typeof import('../theme/spacing').spacing): string {
  const { spacing } = useDesignTokens()
  return spacing[token]
}
