import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { BusinessCardConfidence, BusinessCardFields, ParsedBusinessCard } from './types'
import { EMPTY_BUSINESS_CARD_FIELDS } from './types'

export interface BusinessCardScanState {
  originalUri: string | null
  previewUri: string | null
  rotation: number
  fields: BusinessCardFields
  confidence: BusinessCardConfidence
  rawText: string
  ocrError: string | null
  preselectedCompanyId: string | null
  reset: () => void
  setImage: (uri: string) => void
  setPreviewUri: (uri: string) => void
  setRotation: (deg: number) => void
  applyParsed: (parsed: ParsedBusinessCard) => void
  setField: (key: keyof BusinessCardFields, value: string) => void
  setFields: (fields: BusinessCardFields) => void
  setOcrError: (msg: string | null) => void
  setPreselectedCompanyId: (id: string | null) => void
}

const initial = {
  originalUri: null as string | null,
  previewUri: null as string | null,
  rotation: 0,
  fields: { ...EMPTY_BUSINESS_CARD_FIELDS },
  confidence: {} as BusinessCardConfidence,
  rawText: '',
  ocrError: null as string | null,
  preselectedCompanyId: null as string | null,
}

export const businessCardScanStore = createStore<BusinessCardScanState>((set) => ({
  ...initial,
  reset: () => set({ ...initial, fields: { ...EMPTY_BUSINESS_CARD_FIELDS }, confidence: {} }),
  setImage: (uri) => set({ originalUri: uri, previewUri: uri, rotation: 0, ocrError: null }),
  setPreviewUri: (uri) => set({ previewUri: uri }),
  setRotation: (deg) => set({ rotation: deg }),
  applyParsed: (parsed) =>
    set({
      fields: parsed.fields,
      confidence: parsed.confidence,
      rawText: parsed.rawText,
      ocrError: null,
    }),
  setField: (key, value) =>
    set((s) => ({
      fields: { ...s.fields, [key]: value },
      confidence: { ...s.confidence, [key]: value ? Math.max(s.confidence[key] ?? 0, 99) : 0 },
    })),
  setFields: (fields) => set({ fields }),
  setOcrError: (msg) => set({ ocrError: msg }),
  setPreselectedCompanyId: (id) => set({ preselectedCompanyId: id }),
}))

export function useBusinessCardScan<T>(selector: (s: BusinessCardScanState) => T): T {
  return useStore(businessCardScanStore, selector)
}
