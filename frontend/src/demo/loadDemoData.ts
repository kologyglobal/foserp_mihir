export type { LoadDemoDataResult } from './demoTypes'

import { seedFullFactoryDemoData, validateDemoData, clearDemoData } from './seeds/demoFullFactorySeed'

export { seedFullFactoryDemoData, validateDemoData, clearDemoData }

/** Load full interconnected demo dataset into all ERP stores. */
export function loadDemoData() {
  return seedFullFactoryDemoData()
}
