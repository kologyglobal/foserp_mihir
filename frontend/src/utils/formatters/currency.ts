const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Full Indian INR — e.g. ₹9,87,877.00 */
export function formatCurrency(amount: number): string {
  return inrFormatter.format(Number.isFinite(amount) ? amount : 0)
}

/** Compact INR for KPI cards — avoids breaking equal-width insight tiles */
export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)} Cr`
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)} L`
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)} K`
  return formatCurrency(amount)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

/** Strip ₹ / grouping commas for numeric entry; returns 0 for empty/invalid. */
export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[₹\s,]/g, '').trim()
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}
