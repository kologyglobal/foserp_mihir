/** True for Purchase module routes (`/purchase` and children). */
export function isPurchasePath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  return path === '/purchase' || path.startsWith('/purchase/')
}
