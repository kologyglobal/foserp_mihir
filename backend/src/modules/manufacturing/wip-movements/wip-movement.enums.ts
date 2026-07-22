export const WIP_MOVEMENT_TYPES = ['LOCATION_WIP', 'MATERIAL_RELOCATE', 'WO_TO_WO'] as const
export type WipMovementType = (typeof WIP_MOVEMENT_TYPES)[number]

export const WIP_MOVEMENT_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const
export type WipMovementStatus = (typeof WIP_MOVEMENT_STATUSES)[number]

export const OPEN_WO_STATUSES = ['RELEASED', 'IN_PROGRESS', 'ON_HOLD'] as const
