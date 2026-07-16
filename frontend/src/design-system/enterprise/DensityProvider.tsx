import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type TableDensity = 'compact' | 'comfortable' | 'expanded'

interface DensityContextValue {
  density: TableDensity
  setDensity: (d: TableDensity) => void
  rowHeightClass: string
}

const DensityContext = createContext<DensityContextValue | null>(null)

const ROW_CLASS: Record<TableDensity, string> = {
  compact: 'ent-data-grid--compact',
  comfortable: 'ent-data-grid--comfortable',
  expanded: 'ent-data-grid--expanded',
}

export function DensityProvider({
  children,
  defaultDensity = 'comfortable',
}: {
  children: ReactNode
  defaultDensity?: TableDensity
}) {
  const [density, setDensity] = useState<TableDensity>(defaultDensity)
  const value = useMemo(
    () => ({
      density,
      setDensity,
      rowHeightClass: ROW_CLASS[density],
    }),
    [density],
  )
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext)
  if (!ctx) {
    return {
      density: 'comfortable',
      setDensity: () => {},
      rowHeightClass: ROW_CLASS.comfortable,
    }
  }
  return ctx
}

export function useDensityClass(): string {
  return useDensity().rowHeightClass
}
