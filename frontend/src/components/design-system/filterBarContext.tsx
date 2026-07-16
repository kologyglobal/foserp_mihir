import { createContext, useContext } from 'react'

/** True when rendered inside SmartFilterBar — compact inline width for selects. */
export const FilterBarFieldContext = createContext(false)

export function useFilterBarField() {
  return useContext(FilterBarFieldContext)
}
