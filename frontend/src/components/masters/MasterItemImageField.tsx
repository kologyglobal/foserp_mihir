import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { ErpButton } from '../erp/ErpButton'
import { isApiMode } from '../../config/apiConfig'
import { apiDownloadBlob, tenantPath } from '../../services/api/client'
import { formatApiError } from '../../services/api/apiErrors'
import { useMasterStore } from '../../store/masterStore'
import { notify } from '../../store/toastStore'
import { cn } from '../../utils/cn'

const MAX_BYTES = 4 * 1024 * 1024

type Props = {
  itemId?: string
  imageUrl?: string | null
  updatedAt?: string
  disabled?: boolean
  className?: string
  onImageChange?: (imageUrl: string | null) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })
}

/** Item Master product image — upload, preview, remove (API + demo). */
export function MasterItemImageField({
  itemId,
  imageUrl,
  updatedAt,
  disabled = false,
  className,
  onImageChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const updateItem = useMasterStore((s) => s.updateItem)

  const loadApiPreview = useCallback(async () => {
    if (!itemId || !imageUrl || imageUrl.startsWith('data:')) return
    try {
      const cacheKey = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : ''
      const { blob } = await apiDownloadBlob(tenantPath(`/masters/items/${itemId}/image${cacheKey}`))
      const url = URL.createObjectURL(blob)
      setPreview((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return url
      })
    } catch {
      setPreview(null)
    }
  }, [itemId, imageUrl, updatedAt])

  useEffect(() => {
    if (!imageUrl) {
      setPreview((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    if (imageUrl.startsWith('data:')) {
      setPreview(imageUrl)
      return
    }
    if (isApiMode() && itemId) {
      void loadApiPreview()
      return
    }
    setPreview(null)
  }, [imageUrl, itemId, loadApiPreview])

  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      notify.error('Please choose an image file (JPEG, PNG, WebP, or GIF).')
      return
    }
    if (file.size > MAX_BYTES) {
      notify.error('Image must be 4 MB or smaller.')
      return
    }

    if (!itemId) {
      notify.info('Save the item first, then upload an image.')
      return
    }

    setBusy(true)
    try {
      if (isApiMode()) {
        const bridge = await import('../../services/bridges/masterBatchApiBridge')
        await bridge.apiUploadItemImage(itemId, file)
        onImageChange?.('uploaded')
        await loadApiPreview()
        notify.success('Item image uploaded')
      } else {
        const dataUrl = await readFileAsDataUrl(file)
        await updateItem(itemId, { imageUrl: dataUrl })
        onImageChange?.(dataUrl)
        setPreview(dataUrl)
        notify.success('Item image saved')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!itemId) return
    setBusy(true)
    try {
      if (isApiMode()) {
        const bridge = await import('../../services/bridges/masterBatchApiBridge')
        await bridge.apiDeleteItemImage(itemId)
        onImageChange?.(null)
        setPreview(null)
        notify.success('Item image removed')
      } else {
        await updateItem(itemId, { imageUrl: null })
        onImageChange?.(null)
        setPreview(null)
        notify.success('Item image removed')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'flex h-36 w-36 items-center justify-center overflow-hidden rounded-lg border border-erp-border bg-erp-surface-alt',
          !preview && 'border-dashed',
        )}
      >
        {preview ? (
          <img src={preview} alt="Item product" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center text-erp-muted">
            <ImageIcon className="h-8 w-8 opacity-50" aria-hidden />
            <span className="text-[11px]">No image</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <ErpButton
          type="button"
          size="sm"
          variant="secondary"
          icon={Upload}
          disabled={disabled || busy || !itemId}
          onClick={() => inputRef.current?.click()}
          title={!itemId ? 'Save the item before uploading' : undefined}
        >
          {preview ? 'Change' : 'Upload'}
        </ErpButton>
        {preview ? (
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            icon={Trash2}
            disabled={disabled || busy}
            onClick={() => void handleRemove()}
          >
            Remove
          </ErpButton>
        ) : null}
      </div>
      {!itemId ? (
        <p className="text-[11px] text-erp-muted">Save the item once, then you can upload a product image.</p>
      ) : (
        <p className="text-[11px] text-erp-muted">JPEG, PNG, WebP, or GIF — max 4 MB.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={disabled || busy || !itemId}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
