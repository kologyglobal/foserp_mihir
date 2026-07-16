export interface WorkCenter {
  id: string
  workCenterCode: string
  workCenterName: string
  department: string
  plantCode: string
  capacityHoursPerDay: number
  costRatePerHour: number
  description: string
  /** Where material enters this work center (e.g. RM_STORE or upstream WIP). */
  inputWarehouseCode: string | null
  /** Where WIP accumulates while the operation is in progress. */
  wipWarehouseCode: string | null
  /** Where output is staged after operation completion / QC release. */
  outputWarehouseCode: string | null
  isActive: boolean
  createdAt: string
}

export interface WorkCenterWarehouseMapping {
  inputWarehouseCode: string
  wipWarehouseCode: string
  outputWarehouseCode: string
}
