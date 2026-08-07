import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

export type WorkOrderPrintStage = {
  seq: number
  code: string
  name: string
  status: string
  planned: string
  good: string
  qcRequired?: boolean
}

export type WorkOrderPrintMaterial = {
  code: string
  name: string
  required: string
  issued: string
  uom: string
  status: string
}

export type WorkOrderPrintModel = {
  workOrderNo: string
  status: string
  healthStatus?: string | null
  productCode: string
  productName: string
  plannedQty: string
  completedQty: string
  reworkQty?: string
  rejectedQty?: string
  scrapQty?: string
  uom: string
  dueDate: string | null
  plannedStart: string | null
  actualStart: string | null
  priority: string
  plant: string | null
  jobNumber: string | null
  salesOrderNo: string | null
  customerName: string | null
  supervisor: string | null
  materialStatus?: string | null
  qualityStatus?: string | null
  notes: string | null
  stages: WorkOrderPrintStage[]
  materials: WorkOrderPrintMaterial[]
  printedAt?: string
}

interface WorkOrderPrintDocumentProps {
  model: WorkOrderPrintModel
  className?: string
}

export function WorkOrderPrintDocument({ model, className }: WorkOrderPrintDocumentProps) {
  const company = QUOTATION_COMPANY
  const printedAt = model.printedAt ?? new Date().toISOString()

  return (
    <article className={cn('wo-print-doc', className)}>
      <div className="wo-print-doc__accent" aria-hidden />

      <header className="wo-print-header">
        <div className="wo-print-header__brand">
          <div className="wo-print-header__logo-wrap">
            <img className="wo-print-header__logo" src={company.logoUrl} alt={company.brandName} />
          </div>
          <div>
            <h1 className="wo-print-header__company">{company.legalName}</h1>
            <p className="wo-print-header__tagline">Manufacturing · Work Order / Traveler</p>
            <p className="wo-print-header__address">{company.address}</p>
          </div>
        </div>
        <div className="wo-print-header__badge">
          <p className="wo-print-header__doc-type">Work Order</p>
          <p className="wo-print-header__doc-no">{model.workOrderNo}</p>
          <p className="wo-print-header__status">{model.status.replace(/_/g, ' ')}</p>
        </div>
      </header>

      <section className="wo-print-product">
        <div>
          <p className="wo-print-kicker">Finished item</p>
          <p className="wo-print-product__code">{model.productCode || '-'}</p>
          <p className="wo-print-product__name">{model.productName || '-'}</p>
        </div>
        <dl className="wo-print-qty">
          <div>
            <dt>Planned</dt>
            <dd>{model.plannedQty} {model.uom}</dd>
          </div>
          <div>
            <dt>Good</dt>
            <dd>{model.completedQty} {model.uom}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{model.priority || '-'}</dd>
          </div>
        </dl>
      </section>

      <div className="wo-print-meta-grid">
        <section className="wo-print-card">
          <p className="wo-print-kicker">Schedule</p>
          <p><span>Plant</span> {model.plant || '-'}</p>
          <p><span>Job</span> {model.jobNumber || '-'}</p>
          <p><span>Planned start</span> {formatDate(model.plannedStart)}</p>
          <p><span>Due</span> {formatDate(model.dueDate)}</p>
          <p><span>Actual start</span> {formatDate(model.actualStart)}</p>
        </section>
        <section className="wo-print-card">
          <p className="wo-print-kicker">Commercial link</p>
          <p><span>Sales order</span> {model.salesOrderNo || '-'}</p>
          <p><span>Customer</span> {model.customerName || '-'}</p>
          <p><span>Supervisor</span> {model.supervisor || '-'}</p>
          <p><span>Material</span> {(model.materialStatus || '-').replace(/_/g, ' ')}</p>
          <p><span>Quality</span> {(model.qualityStatus || '-').replace(/_/g, ' ')}</p>
        </section>
        <section className="wo-print-card">
          <p className="wo-print-kicker">Output</p>
          <p><span>Rework</span> {model.reworkQty ?? '0'} {model.uom}</p>
          <p><span>Rejected</span> {model.rejectedQty ?? '0'} {model.uom}</p>
          <p><span>Scrap</span> {model.scrapQty ?? '0'} {model.uom}</p>
          {model.healthStatus ? <p><span>Health</span> {model.healthStatus.replace(/_/g, ' ')}</p> : null}
        </section>
      </div>

      <section className="wo-print-section">
        <h2 className="wo-print-section__title">Routing / stages</h2>
        {model.stages.length === 0 ? (
          <p className="wo-print-empty">No stages on this work order.</p>
        ) : (
          <table className="wo-print-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Code</th>
                <th>Stage</th>
                <th>Status</th>
                <th className="num">Planned</th>
                <th className="num">Good</th>
                <th>QC</th>
              </tr>
            </thead>
            <tbody>
              {model.stages.map((s) => (
                <tr key={`${s.seq}-${s.code}`}>
                  <td className="num">{s.seq}</td>
                  <td>{s.code}</td>
                  <td>{s.name}</td>
                  <td>{s.status.replace(/_/g, ' ')}</td>
                  <td className="num">{s.planned}</td>
                  <td className="num">{s.good}</td>
                  <td>{s.qcRequired ? 'Required' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="wo-print-section">
        <h2 className="wo-print-section__title">Materials</h2>
        {model.materials.length === 0 ? (
          <p className="wo-print-empty">No material requirements listed.</p>
        ) : (
          <table className="wo-print-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th className="num">Required</th>
                <th className="num">Issued</th>
                <th>UOM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {model.materials.map((m, idx) => (
                <tr key={`${m.code}-${idx}`}>
                  <td>{m.code}</td>
                  <td>{m.name}</td>
                  <td className="num">{m.required}</td>
                  <td className="num">{m.issued}</td>
                  <td>{m.uom}</td>
                  <td>{m.status.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {model.notes ? (
        <section className="wo-print-section">
          <h2 className="wo-print-section__title">Notes</h2>
          <p className="wo-print-notes">{model.notes}</p>
        </section>
      ) : null}

      <div className="wo-print-signatures">
        <div>
          <div className="wo-print-signatures__line" />
          <p>Supervisor</p>
        </div>
        <div>
          <div className="wo-print-signatures__line" />
          <p>Operator</p>
        </div>
        <div>
          <div className="wo-print-signatures__line" />
          <p>Quality</p>
        </div>
      </div>

      <footer className="wo-print-footer">
        <span>{company.legalName}</span>
        <span>Printed {formatDate(printedAt)} · Shop-floor copy</span>
      </footer>
    </article>
  )
}
