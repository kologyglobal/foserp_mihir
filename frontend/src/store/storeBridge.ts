/** Lazy store accessors to avoid circular ESM imports between purchase, quality, dispatch, and BOM. */

import type { useQualityStore as UseQualityStore } from './qualityStore'
import type { useMasterStore as UseMasterStore } from './masterStore'
import type { useBomStore as UseBomStore } from './bomStore'

type QualityState = ReturnType<typeof UseQualityStore.getState>
type MasterState = ReturnType<typeof UseMasterStore.getState>
type BomState = ReturnType<typeof UseBomStore.getState>

let qualityGetter: (() => QualityState) | null = null
let masterGetter: (() => MasterState) | null = null
let bomGetter: (() => BomState) | null = null

export function registerQualityStore(getter: () => QualityState) {
  qualityGetter = getter
}

export function getQualityStoreState(): QualityState {
  if (!qualityGetter) {
    throw new Error('Quality store not registered — import qualityStore before purchase/dispatch GRN or dispatch confirm')
  }
  return qualityGetter()
}

export function registerMasterStore(getter: () => MasterState) {
  masterGetter = getter
}

export function getMasterStoreState(): MasterState | null {
  return masterGetter ? masterGetter() : null
}

export function registerBomStore(getter: () => BomState) {
  bomGetter = getter
}

export function getBomStoreState(): BomState | null {
  return bomGetter ? bomGetter() : null
}
