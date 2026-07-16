/** Deterministic sub-assembly WO numbering — tank first → WO-0001 on SO-0001 MRP run. */
export const SUB_ASSEMBLY_WO_SEQUENCE = [
  'SA-TANK-ASM',
  'SA-CHASSIS',
  'SA-RUN-GEAR',
  'SA-PAINT-SYS',
] as const

export function subAssemblyCreationRank(itemCode: string): number {
  const idx = SUB_ASSEMBLY_WO_SEQUENCE.indexOf(itemCode as (typeof SUB_ASSEMBLY_WO_SEQUENCE)[number])
  return idx === -1 ? 999 : idx
}

export function sortBySubAssemblyCreationOrder<T extends { itemCode: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => subAssemblyCreationRank(a.itemCode) - subAssemblyCreationRank(b.itemCode))
}
