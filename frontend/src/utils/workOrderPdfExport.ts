/** Browser print → Save as PDF for work order shop-floor documents. */
export function printWorkOrderDocument(options?: { fileName?: string }): void {
  const previousTitle = document.title
  if (options?.fileName?.trim()) {
    document.title = options.fileName.trim().replace(/\.pdf$/i, '')
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      try {
        window.print()
      } finally {
        window.setTimeout(() => {
          document.title = previousTitle
        }, 800)
      }
    }, 120)
  })
}

export function workOrderPdfFileName(workOrderNo: string): string {
  const safe = workOrderNo.trim().replace(/[^\w.-]+/g, '_') || 'WorkOrder'
  return `${safe}.pdf`
}
