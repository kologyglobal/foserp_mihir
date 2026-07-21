import type { QuotationPrintLayout, QuotationSectionType } from '../../types/crm'
import { PRINT_LAYOUT_SECTION_OPTIONS } from '../../utils/quotationEngine/printLayout'
import { Select } from '../forms/Inputs'

interface QuotationPrintLayoutPanelProps {
  layout: QuotationPrintLayout
  onChange: (layout: QuotationPrintLayout) => void
}

export function QuotationPrintLayoutPanel({ layout, onChange }: QuotationPrintLayoutPanelProps) {
  function patch(partial: Partial<QuotationPrintLayout>) {
    onChange({ ...layout, ...partial })
  }

  function togglePageBreak(sectionType: QuotationSectionType) {
    const set = new Set(layout.pageBreakBefore)
    if (set.has(sectionType)) set.delete(sectionType)
    else set.add(sectionType)
    patch({ pageBreakBefore: [...set] })
  }

  return (
    <div className="quo-layout-panel">
      <h3 className="quo-layout-panel__title">Print / PDF layout</h3>
      <p className="quo-layout-panel__hint">Controls how quotation documents render on screen, in print, and when exported to PDF.</p>

      <div className="quo-layout-panel__grid">
        <label className="quo-layout-panel__field">
          <span>Page size</span>
          <Select value={layout.pageSize} onChange={(e) => patch({ pageSize: e.target.value as QuotationPrintLayout['pageSize'] })}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </Select>
        </label>
        <label className="quo-layout-panel__field">
          <span>Margin (mm)</span>
          <input
            type="number"
            min={8}
            max={25}
            value={layout.marginMm}
            onChange={(e) => patch({ marginMm: Number(e.target.value) })}
          />
        </label>
        <label className="quo-layout-panel__field">
          <span>Font scale</span>
          <input
            type="range"
            min={0.85}
            max={1.15}
            step={0.05}
            value={layout.fontScale}
            onChange={(e) => patch({ fontScale: Number(e.target.value) })}
          />
          <span className="quo-layout-panel__range-val">{Math.round(layout.fontScale * 100)}%</span>
        </label>
        <label className="quo-layout-panel__field">
          <span>Header style</span>
          <Select value={layout.headerStyle} onChange={(e) => patch({ headerStyle: e.target.value as QuotationPrintLayout['headerStyle'] })}>
            <option value="standard">Standard — logo + company block</option>
            <option value="minimal">Minimal — compact header</option>
            <option value="cover">Cover — large title block</option>
          </Select>
        </label>
        <label className="quo-layout-panel__field">
          <span>Print skin</span>
          <Select
            value={layout.printSkin ?? 'default'}
            onChange={(e) => patch({ printSkin: e.target.value as QuotationPrintLayout['printSkin'] })}
          >
            <option value="default">Default — ERP branded</option>
            <option value="vf_word">VF Word — letter-style (ISO templates)</option>
          </Select>
        </label>
      </div>

      <fieldset className="quo-layout-panel__checks">
        <legend>Document blocks</legend>
        <label><input type="checkbox" checked={layout.showLogo} onChange={(e) => patch({ showLogo: e.target.checked })} /> Show logo</label>
        <label><input type="checkbox" checked={layout.showCompanyHeader} onChange={(e) => patch({ showCompanyHeader: e.target.checked })} /> Company header</label>
        <label><input type="checkbox" checked={layout.showCustomerBlock} onChange={(e) => patch({ showCustomerBlock: e.target.checked })} /> Customer address block</label>
        <label><input type="checkbox" checked={layout.showSignatureBlock} onChange={(e) => patch({ showSignatureBlock: e.target.checked })} /> Signature block</label>
        <label><input type="checkbox" checked={layout.showPageFooter} onChange={(e) => patch({ showPageFooter: e.target.checked })} /> GSTIN footer</label>
      </fieldset>

      <fieldset className="quo-layout-panel__checks">
        <legend>Page breaks before section</legend>
        <div className="quo-layout-panel__breaks">
          {PRINT_LAYOUT_SECTION_OPTIONS.map((opt) => (
            <label key={opt.id} className="quo-layout-panel__break-item">
              <input
                type="checkbox"
                checked={layout.pageBreakBefore.includes(opt.id)}
                onChange={() => togglePageBreak(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
