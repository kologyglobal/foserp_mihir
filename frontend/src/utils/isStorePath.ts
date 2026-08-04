/** True for Store / Inventory module routes (nav label Store, path stays `/inventory`). */
export function isStorePath(pathname: string): boolean {
  return pathname === '/inventory' || pathname.startsWith('/inventory/')
}
