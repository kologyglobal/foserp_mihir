import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeBlockProps {
  value: string
  size?: number
  className?: string
  label?: string
}

export function QrCodeBlock({ value, size = 128, className, label }: QrCodeBlockProps) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  return (
    <div className={className}>
      {dataUrl ? (
        <img src={dataUrl} alt={label ?? 'QR Code'} width={size} height={size} className="rounded border border-erp-border bg-white p-1" />
      ) : (
        <div className="flex items-center justify-center rounded border border-dashed border-erp-border bg-erp-surface text-xs text-erp-muted" style={{ width: size, height: size }}>
          QR
        </div>
      )}
      {label && <p className="mt-1 text-center text-xs text-erp-muted">{label}</p>}
    </div>
  )
}
