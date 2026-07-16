/** Resolve BOM list base path from current route — masters vs engineering workspace */
export function resolveBomBasePath(pathname: string): '/masters/bom' | '/engineering/bom' {
  return pathname.startsWith('/engineering/bom') ? '/engineering/bom' : '/masters/bom'
}

export function bomListPath(pathname: string): string {
  return resolveBomBasePath(pathname)
}

export function bomNewPath(pathname: string): string {
  return `${resolveBomBasePath(pathname)}/new`
}

export function bomEditPath(pathname: string, id: string): string {
  return `${resolveBomBasePath(pathname)}/${id}/edit`
}

export function bomManagePath(pathname: string, id: string): string {
  return `${resolveBomBasePath(pathname)}/${id}/manage`
}
