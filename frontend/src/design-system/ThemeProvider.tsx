import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { designTheme } from './theme'

export type DesignTheme = typeof designTheme

interface ThemeContextValue {
  theme: DesignTheme
  density: 'comfortable' | 'compact'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: designTheme,
  density: 'comfortable',
})

export interface ThemeProviderProps {
  children: ReactNode
  density?: 'comfortable' | 'compact'
}

/** Wraps the ERP — all pages inherit tokens via CSS variables on :root */
export function ThemeProvider({ children, density = 'comfortable' }: ThemeProviderProps) {
  const value = useMemo(() => ({ theme: designTheme, density }), [density])

  return (
    <ThemeContext.Provider value={value}>
      <div className="ds-root d365-app" data-density={density}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function useDesignTokens() {
  return useContext(ThemeContext).theme
}
