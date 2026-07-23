/**
 * Single service resolver for the Gate & Security module.
 *
 * Pages must import `gateService` from this file — never gateApiService or
 * gateDemoService directly — so demo and API data are never mixed and
 * environment checks are not scattered across pages.
 *
 * When VITE_USE_API=true, Gate uses the live backend at
 * `/api/v1/t/:tenantSlug/gate/...`. Demo mode keeps the in-memory store.
 */

import { isApiMode } from '@/config/apiConfig'
import { gateApiService } from './gateApi'
import { gateDemoService } from './gateDemoService'
import type { GateService } from './gateServiceContract'

/** Live Gate API is mounted and Prisma models are synced to DB tables. */
const GATE_API_READY = true

export const gateService: GateService =
  GATE_API_READY && isApiMode() ? gateApiService : gateDemoService

/** True when Gate is running on the local demo store despite API mode. */
export function isGateDemoFallbackActive(): boolean {
  return isApiMode() && !GATE_API_READY
}

export { GateServiceError } from './gateServiceContract'
export type {
  CreateContractorEntryInput,
  CreateCourierEntryInput,
  CreateExpectedVisitorInput,
  CreateGatePassInput,
  CreateMaterialInwardInput,
  CreateVehicleEntryInput,
  CreateVisitorEntryInput,
  GateService,
  OutwardDocumentSearchResult,
  RecordGatePassReturnInput,
  RecordVisitorExitInput,
  VerifyMaterialOutwardInput,
} from './gateServiceContract'
