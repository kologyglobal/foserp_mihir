import { Navigate } from 'react-router-dom'
import { ISO_TRAVELER_MFG_BOM_ID } from '@/data/bom/isoTravelerBomSeed'

/** Traveler sheet now lives on the real ISO BOM detail (Traveler tab). */
export function BomTravelerPreviewPage() {
  return <Navigate to={`/manufacturing/bom/${ISO_TRAVELER_MFG_BOM_ID}`} replace />
}
