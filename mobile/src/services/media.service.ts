/**
 * Media helpers — camera barcode via expo-camera; photo capture via expo-image-picker.
 */

export const MEDIA = {
  /** Device camera barcode/QR (store ScanField + BarcodeCameraModal). */
  barcodeCamera: true,
  photoCapture: true,
} as const

/** @deprecated Prefer MEDIA — kept for older imports. */
export const MEDIA_DEFERRED = {
  camera: 'Use expo-image-picker for photo capture',
  barcode: 'Use BarcodeCameraModal / ScanField camera button (expo-camera)',
  attachments: 'Multipart attachment UX ships with module features',
} as const
