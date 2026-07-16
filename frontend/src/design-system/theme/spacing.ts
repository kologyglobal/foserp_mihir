/** 4px base spacing scale — single source for layout rhythm */
export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const

export const layoutSpacing = {
  pagePadding: spacing[5],
  sectionGap: spacing[4],
  cardPadding: spacing[4],
  formGap: spacing[3],
  gridGap: spacing[4],
  commandBarHeight: 'var(--dyn-command-height)',
  filterHeight: 'var(--dyn-filter-height)',
  kpiHeight: 'var(--dyn-kpi-height)',
  rowHeight: 'var(--dyn-row-height)',
} as const

export type SpacingToken = keyof typeof spacing
