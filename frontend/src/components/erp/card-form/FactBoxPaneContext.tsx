import { createContext, useContext, type ReactNode } from 'react'

type FactBoxPaneContextValue = {
  open: boolean
  collapsible: boolean
  label: string
  setOpen: (open: boolean) => void
}

const FactBoxPaneContext = createContext<FactBoxPaneContextValue | null>(null)

export function FactBoxPaneProvider({
  open,
  collapsible,
  label,
  setOpen,
  children,
}: FactBoxPaneContextValue & { children: ReactNode }) {
  return (
    <FactBoxPaneContext.Provider value={{ open, collapsible, label, setOpen }}>
      {children}
    </FactBoxPaneContext.Provider>
  )
}

export function useFactBoxPane() {
  return useContext(FactBoxPaneContext)
}
