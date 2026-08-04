/**
 * Image prep + OCR for business cards (Expo-compatible).
 *
 * Strategies (in order):
 * 1. Optional remote OCR URL (EXPO_PUBLIC_BUSINESS_CARD_OCR_URL)
 * 2. Optional native ML Kit module if linked in a dev build
 * 3. Structured failure — UI allows retry / manual review (card image still kept)
 *
 * Never auto-creates CRM records.
 */

import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system'
import { env } from '@/config/env'
import { parseBusinessCardText } from './parseBusinessCardText'
import type { ParsedBusinessCard } from './types'

export class BusinessCardOcrError extends Error {
  code: 'OCR_FAILED' | 'OCR_UNAVAILABLE' | 'POOR_IMAGE' | 'UNREADABLE' | 'OFFLINE'

  constructor(code: BusinessCardOcrError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'BusinessCardOcrError'
  }
}

export async function rotateImage(uri: string, degrees: number): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: degrees }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  )
  return result.uri
}

/**
 * Auto edge crop: inset ~6% (pseudo edge detection for card frames).
 * Full CV edge detection is deferred to native ML modules.
 */
export async function autoCropCard(uri: string): Promise<string> {
  const meta = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  })
  // second pass — scale then crop middle band
  const width = meta.width || 1000
  const height = meta.height || 1000
  const padX = Math.round(width * 0.06)
  const padY = Math.round(height * 0.08)
  const cropW = Math.max(100, width - padX * 2)
  const cropH = Math.max(100, height - padY * 2)
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        crop: {
          originX: padX,
          originY: padY,
          width: cropW,
          height: cropH,
        },
      },
      { resize: { width: 1400 } },
    ],
    { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
  )
  return result.uri
}

async function readBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding:
      (FileSystem as { EncodingType?: { Base64: string } }).EncodingType?.Base64 ?? 'base64',
  } as FileSystem.ReadingOptions)
}

async function tryRemoteOcr(uri: string): Promise<string | null> {
  const endpoint =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BUSINESS_CARD_OCR_URL) ||
    (env as { businessCardOcrUrl?: string }).businessCardOcrUrl ||
    ''
  if (!endpoint) return null
  try {
    const base64 = await readBase64(uri)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { text?: string; data?: { text?: string } }
    return body.text || body.data?.text || null
  } catch {
    return null
  }
}

async function tryNativeMlKit(uri: string): Promise<string | null> {
  try {
    // Optional peer — only present in prebuild / dev clients that link ML Kit
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition') as {
      default: { recognize: (u: string) => Promise<{ text?: string; blocks?: Array<{ text?: string }> }> }
    }
    const TextRecognition = mod.default
    if (!TextRecognition?.recognize) return null
    const result = await TextRecognition.recognize(uri)
    if (result?.text?.trim()) return result.text
    const blocks = result?.blocks?.map((b) => b.text || '').filter(Boolean).join('\n')
    return blocks || null
  } catch {
    return null
  }
}

export async function runBusinessCardOcr(imageUri: string): Promise<ParsedBusinessCard> {
  if (!imageUri) {
    throw new BusinessCardOcrError('POOR_IMAGE', 'No image to scan.')
  }

  // Dev / UAT fixture — inject fixed card text without native OCR
  const mockText =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BUSINESS_CARD_OCR_MOCK_TEXT) || ''
  if (mockText.trim()) {
    return parseBusinessCardText(mockText)
  }

  // Prep: mild auto-crop + compress for OCR
  let prepared = imageUri
  try {
    prepared = await autoCropCard(imageUri)
  } catch {
    prepared = imageUri
  }

  let text: string | null = null
  text = await tryRemoteOcr(prepared)
  if (!text) text = await tryNativeMlKit(prepared)

  if (!text || !text.trim()) {
    throw new BusinessCardOcrError(
      'OCR_UNAVAILABLE',
      'Could not read text from this card. Improve lighting, recrop, or enter fields manually on the review screen.',
    )
  }

  const parsed = parseBusinessCardText(text)
  const nonEmpty = Object.values(parsed.fields).filter((v) => v.trim()).length
  if (nonEmpty === 0) {
    throw new BusinessCardOcrError(
      'UNREADABLE',
      'Card text was detected but no business fields could be extracted. Edit fields manually.',
    )
  }
  return parsed
}

export async function prepareCardImageForUpload(uri: string): Promise<{
  localUri: string
  contentBase64: string
  originalFilename: string
  mimeType: string
}> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  )
  const contentBase64 = await readBase64(compressed.uri)
  return {
    localUri: compressed.uri,
    contentBase64,
    originalFilename: `business_card_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  }
}
