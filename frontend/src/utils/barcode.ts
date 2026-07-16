/**
 * Optional Code128 barcode support — QR remains primary traceability method.
 * Use for simple internal codes: item code, GRN no, trailer no.
 */
import JsBarcode from 'jsbarcode'

export type BarcodeFormat = 'CODE128'

export function generateBarcodeSvg(value: string, format: BarcodeFormat = 'CODE128'): string {
  if (!value.trim()) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, {
    format,
    displayValue: true,
    fontSize: 14,
    height: 48,
    margin: 8,
  })
  return svg.outerHTML
}

export function generateBarcodeDataUrl(value: string, format: BarcodeFormat = 'CODE128'): string {
  const svg = generateBarcodeSvg(value, format)
  if (!svg) return ''
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Barcode-eligible display codes only — not a substitute for QR traceability */
export function isBarcodeEligible(value: string): boolean {
  return /^[A-Z0-9\-_/]{3,40}$/i.test(value.trim())
}
