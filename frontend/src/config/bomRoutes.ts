/** Canonical BOM UI — Manufacturing Setup (used on work orders). */
export const BOM_SETUP_PATH = '/manufacturing/setup/boms'

/** @deprecated Prefer BOM_SETUP_PATH — Masters/Engineering BOM UIs redirect here. */
export function resolveBomBasePath(_pathname?: string): string {
  return BOM_SETUP_PATH
}

export function bomListPath(_pathname?: string): string {
  return BOM_SETUP_PATH
}

export function bomNewPath(_pathname?: string): string {
  return BOM_SETUP_PATH
}

export function bomEditPath(_pathname: string | undefined, id: string): string {
  return `${BOM_SETUP_PATH}/${id}`
}

export function bomManagePath(_pathname: string | undefined, id: string): string {
  return `${BOM_SETUP_PATH}/${id}`
}
