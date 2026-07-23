import { n } from '../shared/dispatch-qty.js'

type ChallanDocSource = {
  id: string
  challanNumber: string | null
  status: string
  versionNumber: number
  documentDate: Date
  movementDate: Date | null
  movementReason: string
  transportMode: string | null
  transporterName: string | null
  vehicleNumber: string | null
  lrGrNumber: string | null
  lrGrDate: Date | null
  eWayBillReference: string | null
  eWayBillDate: Date | null
  destination: string | null
  totalPackages: number
  totalQuantity: { toString(): string } | number
  grossWeight: { toString(): string } | number | null
  netWeight: { toString(): string } | number | null
  remarks: string | null
  termsText: string | null
  issuedAt: Date | null
  issuedBy: string | null
  approvedBy: string | null
  customerSnapshotJson: unknown
  shipToSnapshotJson: unknown
  legalEntitySnapshotJson: unknown
  salesOrderRefsJson: unknown
  lines?: Array<{
    lineNumber: number
    itemCodeSnapshot: string
    itemNameSnapshot: string
    hsnSacSnapshot: string | null
    uomCodeSnapshot: string | null
    challanQuantity: { toString(): string } | number
    remarks: string | null
  }>
  packages?: Array<{
    packageNumberSnapshot: string
    packageTypeSnapshot: string | null
    sealNumberSnapshot: string | null
    grossWeight: { toString(): string } | number | null
    netWeight: { toString(): string } | number | null
  }>
  tracking?: Array<{
    lotRef: string | null
    serialRef: string | null
    heatNumber: string | null
    quantity: { toString(): string } | number
  }>
  outboundDispatch?: { dispatchNo: string; salesOrderNo: string | null } | null
  packingSession?: { packingSessionNumber: string } | null
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function jsonField(obj: unknown, key: string): string {
  if (!obj || typeof obj !== 'object') return ''
  const v = (obj as Record<string, unknown>)[key]
  return v == null ? '' : String(v)
}

export function buildChallanHtml(row: ChallanDocSource): string {
  const isDraft = row.status !== 'ISSUED'
  const legal = row.legalEntitySnapshotJson
  const customer = row.customerSnapshotJson
  const shipTo = row.shipToSnapshotJson
  const watermark = isDraft
    ? `<div style="position:fixed;top:40%;left:20%;font-size:64px;color:rgba(180,0,0,0.18);transform:rotate(-25deg);pointer-events:none;font-weight:700;">DRAFT — NOT ISSUED</div>`
    : ''

  const lineRows = (row.lines ?? [])
    .map(
      (l) => `<tr>
      <td>${l.lineNumber}</td>
      <td>${esc(l.itemCodeSnapshot)}</td>
      <td>${esc(l.itemNameSnapshot)}</td>
      <td>${esc(l.hsnSacSnapshot)}</td>
      <td style="text-align:right">${esc(n(l.challanQuantity as never))}</td>
      <td>${esc(l.uomCodeSnapshot)}</td>
      <td>${esc(l.remarks)}</td>
    </tr>`,
    )
    .join('')

  const pkgRows = (row.packages ?? [])
    .map(
      (p) => `<tr>
      <td>${esc(p.packageNumberSnapshot)}</td>
      <td>${esc(p.packageTypeSnapshot)}</td>
      <td>${esc(p.sealNumberSnapshot)}</td>
      <td style="text-align:right">${p.grossWeight != null ? esc(n(p.grossWeight as never)) : ''}</td>
      <td style="text-align:right">${p.netWeight != null ? esc(n(p.netWeight as never)) : ''}</td>
    </tr>`,
    )
    .join('')

  const tracking = (row.tracking ?? [])
    .map((t) => {
      const parts = [t.lotRef && `Lot ${t.lotRef}`, t.serialRef && `Serial ${t.serialRef}`, t.heatNumber && `Heat ${t.heatNumber}`]
        .filter(Boolean)
        .join(' / ')
      return `<li>${esc(parts)} — qty ${esc(n(t.quantity as never))}</li>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${isDraft ? 'DRAFT Delivery Challan' : `Delivery Challan ${esc(row.challanNumber)}`}</title>
<style>
  body{font-family:Georgia,serif;color:#1a1a1a;margin:24px;font-size:13px}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#555}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border:1px solid #ccc;padding:6px 8px;vertical-align:top}
  th{background:#f4f4f4;text-align:left}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .box{border:1px solid #ddd;padding:10px}
  .footer{margin-top:28px;font-size:11px;color:#666}
  @media print{.no-print{display:none}}
</style>
</head>
<body>
${watermark}
<div class="grid">
  <div>
    <h1>${esc(jsonField(legal, 'name') || 'Company')}</h1>
    <div class="muted">${esc(jsonField(legal, 'note'))}</div>
  </div>
  <div style="text-align:right">
    <h1>Delivery Challan</h1>
    <div><strong>${isDraft ? 'DRAFT (not issued)' : esc(row.challanNumber)}</strong></div>
    <div>Version ${row.versionNumber}</div>
    <div>Document date: ${esc(row.documentDate.toISOString().slice(0, 10))}</div>
    ${row.movementDate ? `<div>Movement date: ${esc(row.movementDate.toISOString().slice(0, 10))}</div>` : ''}
  </div>
</div>

<div class="grid" style="margin-top:16px">
  <div class="box">
    <strong>Customer</strong>
    <div>${esc(jsonField(customer, 'name'))}</div>
    <div class="muted">${esc(jsonField(customer, 'code'))} ${esc(jsonField(customer, 'gstin'))}</div>
  </div>
  <div class="box">
    <strong>Ship-to</strong>
    <div>${esc(jsonField(shipTo, 'shipToKey'))}</div>
    <div>${esc(jsonField(shipTo, 'address'))}</div>
    ${row.destination ? `<div>Destination: ${esc(row.destination)}</div>` : ''}
  </div>
</div>

<div class="box" style="margin-top:12px">
  <strong>References</strong>
  <div>Dispatch: ${esc(row.outboundDispatch?.dispatchNo)}</div>
  <div>Sales Order: ${esc(row.outboundDispatch?.salesOrderNo)}</div>
  <div>Packing Session: ${esc(row.packingSession?.packingSessionNumber)}</div>
  <div>Movement reason: ${esc(row.movementReason)}</div>
</div>

<h3>Items</h3>
<table>
  <thead><tr><th>#</th><th>Code</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>UOM</th><th>Remarks</th></tr></thead>
  <tbody>${lineRows || '<tr><td colspan="7">No lines</td></tr>'}</tbody>
</table>

<h3>Packages</h3>
<table>
  <thead><tr><th>Package</th><th>Type</th><th>Seal</th><th>Gross</th><th>Net</th></tr></thead>
  <tbody>${pkgRows || '<tr><td colspan="5">No packages</td></tr>'}</tbody>
</table>

${tracking ? `<h3>Tracking</h3><ul>${tracking}</ul>` : ''}

<div class="box">
  <strong>Transport</strong>
  <div>Mode: ${esc(row.transportMode)}</div>
  <div>Transporter: ${esc(row.transporterName)}</div>
  <div>Vehicle: ${esc(row.vehicleNumber)}</div>
  <div>LR/GR: ${esc(row.lrGrNumber)}${row.lrGrDate ? ` (${esc(row.lrGrDate.toISOString().slice(0, 10))})` : ''}</div>
  <div>e-Way Bill: ${esc(row.eWayBillReference) || '—'}${row.eWayBillDate ? ` (${esc(row.eWayBillDate.toISOString().slice(0, 10))})` : ''} <em>(system / NIC — not manually entered)</em></div>
  <div class="muted">Manual reference only — not externally verified.</div>
</div>

<div class="box" style="margin-top:12px">
  <div>Total quantity: ${esc(n(row.totalQuantity as never))}</div>
  <div>Total packages: ${row.totalPackages}</div>
  <div>Gross weight: ${row.grossWeight != null ? esc(n(row.grossWeight as never)) : ''}</div>
  <div>Net weight: ${row.netWeight != null ? esc(n(row.netWeight as never)) : ''}</div>
</div>

${row.remarks ? `<p><strong>Remarks:</strong> ${esc(row.remarks)}</p>` : ''}
${row.termsText ? `<p><strong>Terms:</strong> ${esc(row.termsText)}</p>` : ''}

<div class="footer">
  <div>Issued by: ${esc(row.issuedBy)} ${row.issuedAt ? esc(row.issuedAt.toISOString()) : ''}</div>
  <div>Approved by: ${esc(row.approvedBy)}</div>
  <div>Authorised signatory: ______________________</div>
  <div>Document policy: DELIVERY_CHALLAN_AS_DOCUMENT_ONLY — does not post stock or fulfilment. Packed ≠ Dispatched ≠ Fulfilled.</div>
  <div>Generated: ${new Date().toISOString()} · Challan id ${esc(row.id)}</div>
</div>
</body>
</html>`
}
