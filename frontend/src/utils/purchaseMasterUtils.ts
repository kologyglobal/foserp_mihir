import type { PurchaseMasterEntry, PurchaseMasterKind } from '../types/purchaseMasters'
import { usePurchaseStore } from '../store/purchaseStore'
import { useMasterStore } from '../store/masterStore'
import { getPurchaseMasterCatalog } from '../config/purchaseMastersCatalog'
import type { PurchaseMasterUsedIn } from '../types/purchaseMasters'

export function sortPurchaseMasterEntries(entries: PurchaseMasterEntry[]): PurchaseMasterEntry[] {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export function slugToKind(slug: string): PurchaseMasterKind | null {
  return getPurchaseMasterCatalog(slug)?.kind ?? null
}

export function exportMastersCsv(entries: PurchaseMasterEntry[]): string {
  const header = ['code', 'name', 'status', 'description']
  const rows = entries.map((e) => [e.code, e.name, e.status, e.description ?? ''])
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function exportMastersExcelTsv(entries: PurchaseMasterEntry[]): string {
  const header = ['Code', 'Name', 'Status', 'Sort Order', 'Description']
  const rows = entries.map((e) => [e.code, e.name, e.status, String(e.sortOrder), e.description ?? ''])
  return [header, ...rows].map((r) => r.join('\t')).join('\n')
}

export function parseMastersCsv(text: string): Array<{ code: string; name: string; status?: string; description?: string }> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase())
  const codeIdx = headers.indexOf('code')
  const nameIdx = headers.indexOf('name')
  if (codeIdx < 0 || nameIdx < 0) return []
  const statusIdx = headers.indexOf('status')
  const descIdx = headers.indexOf('description')
  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
    return {
      code: cols[codeIdx] ?? '',
      name: cols[nameIdx] ?? '',
      status: statusIdx >= 0 ? cols[statusIdx] : 'active',
      description: descIdx >= 0 ? cols[descIdx] : undefined,
    }
  }).filter((r) => r.code && r.name)
}

export function printMasterTable(title: string, entries: PurchaseMasterEntry[]) {
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:Segoe UI,sans-serif;font-size:12px;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f4f6}</style></head>
<body><h1>${title}</h1><p>Printed ${new Date().toLocaleString('en-IN')}</p>
<table><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Sort</th></tr></thead><tbody>
${entries.map((e) => `<tr><td>${e.code}</td><td>${e.name}</td><td>${e.status}</td><td>${e.sortOrder}</td></tr>`).join('')}
</tbody></table></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.print()
}

export function countPurchaseMasterUsage(entry: PurchaseMasterEntry): number {
  const purchase = usePurchaseStore.getState()
  const { kind, code } = entry

  if (kind === 'buyers') {
    return 0
  }
  if (kind === 'return-reasons') {
    return purchase.purchaseReturns.filter((r) => r.lines.some((l) => l.reason === code)).length
  }
  if (kind === 'bin-codes') {
    // Legacy Zustand PR lines do not track bin codes; domain PR usage is outside this store.
    return 0
  }
  return 0
}

export function canDeletePurchaseMasterEntry(entry: PurchaseMasterEntry): { ok: boolean; reason?: string } {
  if (entry.systemControlled) {
    return { ok: false, reason: 'System-controlled master values cannot be deleted.' }
  }
  const usage = countPurchaseMasterUsage(entry)
  if (usage > 0) {
    return { ok: false, reason: 'This master value is used in purchase documents. Deactivate instead.' }
  }
  return { ok: true }
}

export function usedInRoutes(usedIn: PurchaseMasterUsedIn[] | undefined): { label: string; route: string }[] {
  const map: Record<PurchaseMasterUsedIn, { label: string; route: string }> = {
    requisitions: { label: 'Requisitions', route: '/purchase/requisitions' },
    rfqs: { label: 'RFQs', route: '/purchase/rfqs' },
    'purchase-orders': { label: 'Purchase Orders', route: '/purchase/orders' },
    grn: { label: 'GRN Register', route: '/purchase/grn' },
    returns: { label: 'Purchase Returns', route: '/purchase/returns' },
    'vendor-quotations': { label: 'Vendor Quotations', route: '/purchase/vendor-quotations' },
    reports: { label: 'Purchase Reports', route: '/purchase/reports' },
  }
  return (usedIn ?? []).map((k) => map[k])
}

export function buildPaymentTermText(entry: PurchaseMasterEntry): string {
  const days = Number(entry.attributes.creditDays ?? 0)
  const advance = Number(entry.attributes.advancePct ?? 0)
  if (advance > 0 && days > 0) return `${advance}% Advance, Net ${days} Days`
  if (advance > 0) return `${advance}% Advance`
  if (days > 0) return `Net ${days} Days`
  return entry.name
}

export function resolveItemCategoryId(itemId: string): string | undefined {
  const item = useMasterStore.getState().getItem(itemId)
  return item?.categoryId
}
