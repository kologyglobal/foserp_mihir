import { isApiMode } from '../config/apiConfig'
import { hydrateAllFromApi } from './apiHydration'
import { runDemoCrmBootstrap, runDemoErpBootstrap } from './demoBootstrap'

export interface AppBootstrapResult {
  mode: 'api' | 'demo'
  crmSkipped?: boolean
  integrityOk?: boolean
}

/**
 * Application startup orchestration.
 * API mode: no demo seeds — caller hydrates via hydrateAllFromApi after auth.
 * Demo mode: CRM ecosystem + manufacturing integrity checks.
 */
export async function runAppBootstrap(): Promise<AppBootstrapResult> {
  if (isApiMode()) {
    return { mode: 'api' }
  }

  const crm = runDemoCrmBootstrap()
  const integrity = await runDemoErpBootstrap()
  return {
    mode: 'demo',
    crmSkipped: crm.skipped,
    integrityOk: integrity.ok,
  }
}

/** Post-login API hydration — call when session is established. */
export async function runApiHydration(): Promise<void> {
  if (!isApiMode()) return
  await hydrateAllFromApi()
}

export { hydrateAllFromApi, hydrateCrmFromApi } from './apiHydration'
export { runDemoCrmBootstrap, runDemoErpBootstrap } from './demoBootstrap'
