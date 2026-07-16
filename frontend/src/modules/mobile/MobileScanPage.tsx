import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveMobileScan, type MobileScanPreview } from '../../utils/mobileScanResolver'
import {
  MobilePageTitle,
  MobileEntityPreviewCard,
  MobileScanButton,
  MobileStickyActionBar,
} from '../../components/mobile'

export function MobileScanPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<MobileScanPreview | null>(null)

  function handleScan() {
    setError('')
    const result = resolveMobileScan(code)
    if (!result.ok) {
      setError(result.error)
      setPreview(null)
      return
    }
    setPreview(result.preview)
  }

  return (
    <>
      <MobilePageTitle title="Scan" subtitle="QR, barcode, or enter document number" />
      <input
        className="mob-scan-input mb-3"
        placeholder="Scan or type code…"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleScan()}
        autoComplete="off"
        autoFocus
      />
      {error && <div className="mob-card text-[#c42b2f] text-sm mb-3">{error}</div>}
      {preview && (
        <MobileEntityPreviewCard
          typeLabel={preview.entityTypeLabel}
          documentNo={preview.documentNo}
          status={preview.status}
          subtitle={preview.subtitle}
          actions={
            <>
              <div className="text-xs text-[#605e5c] mb-2">Allowed: {preview.allowedActions.join(' · ')}</div>
              {preview.mobileRoutes.map((r) => (
                <button key={r.path} type="button" className="mob-btn mob-btn-primary" onClick={() => navigate(r.path)}>
                  {r.label}
                </button>
              ))}
            </>
          }
        />
      )}
      <MobileStickyActionBar>
        <MobileScanButton onClick={handleScan} label="Lookup Code" />
      </MobileStickyActionBar>
    </>
  )
}
