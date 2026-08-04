/**
 * Media helpers (wired for later phases).
 * M1 installs expo-image-picker + expo-file-system but does not expose camera workflows.
 */

export const MEDIA_DEFERRED = {
  camera: 'Camera capture is deferred past M1',
  barcode: 'Barcode scanning is deferred past M1',
  attachments: 'Multipart attachment UX ships with module features',
} as const
