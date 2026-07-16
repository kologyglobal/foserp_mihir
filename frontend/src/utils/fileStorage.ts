/**
 * Local file blob store — backend-ready interface.
 * Stores base64/data-URL content in localStorage keyed by storage ref.
 */

const FILE_PREFIX = 'vasant-erp-file:'

export function createStorageRef(documentId: string, fileName: string): string {
  return `${documentId}::${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
}

export function storeFileContent(storageRef: string, content: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FILE_PREFIX + storageRef, content)
}

export function getFileContent(storageRef: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(FILE_PREFIX + storageRef)
}

export function deleteFileContent(storageRef: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(FILE_PREFIX + storageRef)
}

/** Read a browser File as data URL (for upload UI). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

export function triggerDownload(fileName: string, content: string, mimeType = 'application/octet-stream'): void {
  const link = document.createElement('a')
  link.href = content.startsWith('data:') ? content : `data:${mimeType};base64,${content}`
  link.download = fileName
  link.click()
}
