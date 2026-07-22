export const WIP_MOVEMENT_TYPES = ['LOCATION_WIP', 'MATERIAL_RELOCATE', 'WO_TO_WO'] as const
export type WipMovementType = (typeof WIP_MOVEMENT_TYPES)[number]

export const WIP_MOVEMENT_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const
export type WipMovementStatus = (typeof WIP_MOVEMENT_STATUSES)[number]

export const WIP_MOVEMENT_TYPE_LABELS: Record<WipMovementType, string> = {
  LOCATION_WIP: 'Move WIP location',
  MATERIAL_RELOCATE: 'Relocate material',
  WO_TO_WO: 'Transfer to work order',
}

export const WIP_MOVEMENT_STATUS_LABELS: Record<WipMovementStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
}

export type WipMovementInput = {
  movementType: WipMovementType
  quantity: number
  fromWarehouseId: string
  toWarehouseId: string
  reason: string
  remarks?: string
  itemId?: string
  materialLineId?: string
  targetProductionOrderId?: string
  stageId?: string
  operationId?: string
  idempotencyKey?: string
}

export type TransferToWorkOrderInput = {
  quantity: number
  fromWarehouseId: string
  toWarehouseId: string
  reason: string
  remarks?: string
  itemId?: string
  materialLineId?: string
  idempotencyKey?: string
}

export interface WipMovement {
  id: string
  movementNumber: string
  movementType: WipMovementType
  status: WipMovementStatus
  productionOrderId: string
  productionOrderNumber: string
  targetProductionOrderId: string | null
  targetProductionOrderNumber: string | null
  itemId: string
  itemCode: string
  itemName: string
  quantity: string
  uomId: string
  fromWarehouseId: string
  fromWarehouseCode: string
  fromWarehouseName: string
  toWarehouseId: string
  toWarehouseCode: string
  toWarehouseName: string
  stageId: string | null
  operationId: string | null
  materialLineId: string | null
  reason: string
  remarks: string | null
  physicalPosted: boolean
  outboundMovementId: string | null
  inboundMovementId: string | null
  postedAt: string | null
  postedBy: string | null
  createdAt: string
  updatedAt: string
}
