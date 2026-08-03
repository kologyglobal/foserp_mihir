import { getPayslipHtml } from '@/services/api/hrmsApi'
import { downloadElementAsPdf, type DocumentPdfResult } from '@/utils/documentPdfDownload'

/**
 * Fetches the server-rendered payslip HTML, mounts it in a hidden off-screen container,
 * and exports it as a PDF via the shared html2canvas + jsPDF pipeline.
 */
export async function downloadPayslipPdf(payslipId: string, fileName: string): Promise<DocumentPdfResult> {
  let container: HTMLDivElement | null = null
  try {
    const html = await getPayslipHtml(payslipId)
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const styles = Array.from(parsed.querySelectorAll('style'))
      .map((s) => s.outerHTML)
      .join('')

    container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '0'
    container.style.zIndex = '-1'
    container.innerHTML = `${styles}${parsed.body.innerHTML}`
    document.body.appendChild(container)

    const target = (container.querySelector('.sheet') as HTMLElement | null) ?? container
    return await downloadElementAsPdf(target, fileName)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Payslip download failed.' }
  } finally {
    if (container) container.remove()
  }
}
