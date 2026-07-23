/**
 * Gate & Security frontend module.
 *
 * Physical gate operations only — visitor/vehicle/material movement, passes,
 * contractors, couriers, approvals and operational reports. Uses `gateService`
 * (demo or API) via a single resolver; pages must not import implementation
 * services directly.
 */

export { gateService, GateServiceError } from './api/gateService'
export type { GateService } from './api/gateService'
export { GATE_BREADCRUMB, GATE_DEPARTMENTS, GATE_HOSTS } from './gateUi'
