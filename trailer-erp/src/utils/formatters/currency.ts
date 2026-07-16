export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
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
