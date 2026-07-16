export { colors, type DesignSystemColor } from './colors'
export { spacing, layoutSpacing, type SpacingToken } from './spacing'
export { fontFamily, typography, fontWeight, type TypographyRole } from './typography'
export { radius } from './radius'
export { shadows } from './shadows'
export { zIndex } from './zIndex'
export { breakpoints, mediaQueries } from './breakpoints'

import { colors } from './colors'
import { spacing, layoutSpacing } from './spacing'
import { typography, fontFamily, fontWeight } from './typography'
import { radius } from './radius'
import { shadows } from './shadows'
import { zIndex } from './zIndex'
import { breakpoints } from './breakpoints'

/** Unified theme object for charts, PDF, and programmatic styling */
export const designTheme = {
  colors,
  spacing,
  layoutSpacing,
  typography,
  fontFamily,
  fontWeight,
  radius,
  shadows,
  zIndex,
  breakpoints,
} as const
