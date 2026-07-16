import {
  bootstrapCrmEcosystemOnce,
  syncCrmStoreArtifacts,
  type CrmBootstrapResult,
} from '../demo/factories/crmEcosystemBootstrap'
import { bootstrapErpStartup, type IntegrityReport } from './erpStartup'

export { bootstrapCrmEcosystemOnce, syncCrmStoreArtifacts, type CrmBootstrapResult }
export { bootstrapErpStartup, type IntegrityReport }

/** Demo-mode CRM seed bootstrap (idempotent). */
export function runDemoCrmBootstrap(): CrmBootstrapResult {
  return bootstrapCrmEcosystemOnce()
}

/** Demo-mode manufacturing integrity + master repair. */
export async function runDemoErpBootstrap(): Promise<IntegrityReport> {
  return bootstrapErpStartup()
}
