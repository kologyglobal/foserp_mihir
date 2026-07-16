/** Bumped after master mutations so lookup hooks can refetch when needed. */
let lookupVersion = 0

export function bumpMasterLookupCache(): void {
  lookupVersion += 1
}

export function getMasterLookupVersion(): number {
  return lookupVersion
}
