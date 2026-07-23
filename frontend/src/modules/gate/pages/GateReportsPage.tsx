import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Download,
  FileText,
  Printer,
  ShieldOff,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpButton } from '@/components/erp/ErpButton'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useGatePermissions } from '@/utils/permissions/gate'
import { gateService } from '../api/gateService'
import type { GateLocation, GateReportDefinition } from '../types/gate.types'
import {
  gatePassPendingQty,
  isGatePassOverdue,
  minutesBetween,
  todayIsoDate,
  VISITOR_TYPE_LABELS,
} from '../utils/gateStatus'
import { exportGateCsv } from '../utils/gateExport'
import { GateDataStates } from '../components'
import type { GateLoadState } from '../components'
import { GATE_BREADCRUMB } from '../gateUi'

const REPORTS: GateReportDefinition[] = [
  { id: 'daily-visitor-register', category: 'visitor', title: 'Daily visitor register', description: 'All visitor entries in the selected date range.' },
  { id: 'visitors-inside', category: 'visitor', title: 'Visitors currently inside', description: 'Open visits with no exit recorded.' },
  { id: 'host-wise-visits', category: 'visitor', title: 'Host-wise visits', description: 'Visit counts grouped by host employee.' },
  { id: 'department-wise-visits', category: 'visitor', title: 'Department-wise visits', description: 'Visit counts grouped by department.' },
  { id: 'overstayed-visitors', category: 'visitor', title: 'Overstayed visitors', description: 'Visitors inside longer than the configured overstay threshold.' },
  { id: 'rejected-visitors', category: 'visitor', title: 'Rejected visitors', description: 'Walk-ins and visits rejected at the gate.' },
  { id: 'repeat-visitors', category: 'visitor', title: 'Repeat visitors', description: 'Mobile numbers with more than one visit in the period.' },
  { id: 'daily-material-inward', category: 'material', title: 'Daily material inward', description: 'Physical inward arrivals registered at gate.' },
  { id: 'inward-pending-grn', category: 'material', title: 'Inward pending GRN', description: 'Inward entries waiting for store GRN completion.' },
  { id: 'inward-without-po', category: 'material', title: 'Inward without PO', description: 'Non-PO inward arrivals requiring approval.' },
  { id: 'daily-material-outward', category: 'material', title: 'Daily material outward', description: 'Outward verification and release log.' },
  { id: 'job-work-material', category: 'material', title: 'Job-work material movement', description: 'Job-work send and return gate movements.' },
  { id: 'scrap-outward', category: 'material', title: 'Scrap outward', description: 'Scrap disposal outward releases.' },
  { id: 'vehicles-inside', category: 'vehicle', title: 'Vehicles currently inside', description: 'Vehicles on plant without exit.' },
  { id: 'vehicle-turnaround', category: 'vehicle', title: 'Vehicle turnaround time', description: 'Entry-to-exit duration for completed vehicle visits.' },
  { id: 'transporter-movement', category: 'vehicle', title: 'Transporter-wise movement', description: 'Vehicle movements grouped by transporter.' },
  { id: 'missing-exits', category: 'vehicle', title: 'Missing exits', description: 'Register rows marked inside with no exit time.' },
  { id: 'pending-returnables', category: 'gate_pass', title: 'Pending returnables', description: 'Returnable passes with quantity still out.' },
  { id: 'overdue-returnables', category: 'gate_pass', title: 'Overdue returnables', description: 'Returnable passes past expected return date.' },
  { id: 'partial-returns', category: 'gate_pass', title: 'Partial returns', description: 'Passes with some quantity returned but still pending.' },
  { id: 'asset-movement-register', category: 'gate_pass', title: 'Asset movement register', description: 'Asset movement outward gate passes and releases.' },
]

const CATEGORY_LABELS: Record<GateReportDefinition['category'], string> = {
  visitor: 'Visitor',
  material: 'Material',
  vehicle: 'Vehicle',
  gate_pass: 'Gate-pass',
}

type ReportRow = Record<string, string | number>

interface ReportResult {
  headers: string[]
  rows: ReportRow[]
}

function inDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false
  const day = iso.slice(0, 10)
  return day >= from && day <= to
}

function matchesCompany(value: string | undefined, company: string): boolean {
  if (!company) return true
  return (value ?? '').toLowerCase().includes(company.toLowerCase())
}

function matchesSearch(row: ReportRow, search: string): boolean {
  if (!search.trim()) return true
  const q = search.toLowerCase()
  return Object.values(row).some((v) => String(v).toLowerCase().includes(q))
}

async function runReport(
  reportId: string,
  filters: {
    dateFrom: string
    dateTo: string
    gate: string
    company: string
    status: string
    search: string
  },
): Promise<ReportResult> {
  const { dateFrom, dateTo, gate, company, status, search } = filters

  switch (reportId) {
    case 'daily-visitor-register': {
      const visits = await gateService.getVisitors({ gate: gate || undefined, status: status || undefined, search: search || undefined })
      const rows = visits
        .filter((v) => inDateRange(v.entryTime ?? v.createdAt, dateFrom, dateTo))
        .filter((v) => matchesCompany(v.company, company))
        .map((v) => ({
          'Pass No.': v.entryNumber,
          Visitor: v.visitorName,
          Mobile: v.mobile,
          Company: v.company ?? '',
          Host: v.hostName,
          Department: v.department,
          'Entry Time': v.entryTime ? formatDateTime(v.entryTime) : '',
          'Exit Time': v.exitTime ? formatDateTime(v.exitTime) : '',
          Status: v.status,
          Gate: v.gate,
        }))
      return { headers: ['Pass No.', 'Visitor', 'Mobile', 'Company', 'Host', 'Department', 'Entry Time', 'Exit Time', 'Status', 'Gate'], rows }
    }
    case 'visitors-inside': {
      const visits = await gateService.getVisitors({ status: 'inside', gate: gate || undefined })
      const rows = visits
        .filter((v) => matchesCompany(v.company, company))
        .filter((v) => matchesSearch({ Visitor: v.visitorName, Company: v.company ?? '' }, search))
        .map((v) => ({
          'Pass No.': v.entryNumber,
          Visitor: v.visitorName,
          Company: v.company ?? '',
          Host: v.hostName,
          'Entry Time': v.entryTime ? formatDateTime(v.entryTime) : '',
          Gate: v.gate,
        }))
      return { headers: ['Pass No.', 'Visitor', 'Company', 'Host', 'Entry Time', 'Gate'], rows }
    }
    case 'host-wise-visits': {
      const visits = await gateService.getVisitors({ gate: gate || undefined })
      const counts = new Map<string, number>()
      visits
        .filter((v) => inDateRange(v.entryTime ?? v.createdAt, dateFrom, dateTo))
        .forEach((v) => counts.set(v.hostName, (counts.get(v.hostName) ?? 0) + 1))
      const rows = [...counts.entries()]
        .map(([host, count]) => ({ Host: host, Visits: count }))
        .filter((r) => matchesSearch(r, search))
        .sort((a, b) => b.Visits - a.Visits)
      return { headers: ['Host', 'Visits'], rows }
    }
    case 'department-wise-visits': {
      const visits = await gateService.getVisitors({ gate: gate || undefined })
      const counts = new Map<string, number>()
      visits
        .filter((v) => inDateRange(v.entryTime ?? v.createdAt, dateFrom, dateTo))
        .forEach((v) => counts.set(v.department, (counts.get(v.department) ?? 0) + 1))
      const rows = [...counts.entries()]
        .map(([dept, count]) => ({ Department: dept, Visits: count }))
        .filter((r) => matchesSearch(r, search))
        .sort((a, b) => b.Visits - a.Visits)
      return { headers: ['Department', 'Visits'], rows }
    }
    case 'overstayed-visitors': {
      const settings = await gateService.getGateSettings()
      const threshold = settings.visitor.overstayThresholdMinutes
      const visits = await gateService.getVisitors({ status: 'inside', gate: gate || undefined })
      const rows = visits
        .filter((v) => v.entryTime && minutesBetween(v.entryTime) > threshold)
        .map((v) => ({
          'Pass No.': v.entryNumber,
          Visitor: v.visitorName,
          Host: v.hostName,
          'Minutes Inside': minutesBetween(v.entryTime!),
          Gate: v.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Pass No.', 'Visitor', 'Host', 'Minutes Inside', 'Gate'], rows }
    }
    case 'rejected-visitors': {
      const visits = await gateService.getVisitors({ status: 'rejected', gate: gate || undefined })
      const rows = visits
        .filter((v) => inDateRange(v.createdAt, dateFrom, dateTo))
        .filter((v) => matchesCompany(v.company, company))
        .map((v) => ({
          'Pass No.': v.entryNumber,
          Visitor: v.visitorName,
          Type: VISITOR_TYPE_LABELS[v.visitorType],
          Company: v.company ?? '',
          Remarks: v.approvalRemarks ?? '',
          Gate: v.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Pass No.', 'Visitor', 'Type', 'Company', 'Remarks', 'Gate'], rows }
    }
    case 'repeat-visitors': {
      const visits = await gateService.getVisitors({ gate: gate || undefined })
      const byMobile = new Map<string, { name: string; company: string; count: number }>()
      visits
        .filter((v) => inDateRange(v.entryTime ?? v.createdAt, dateFrom, dateTo))
        .forEach((v) => {
          const prev = byMobile.get(v.mobile)
          if (prev) prev.count += 1
          else byMobile.set(v.mobile, { name: v.visitorName, company: v.company ?? '', count: 1 })
        })
      const rows = [...byMobile.entries()]
        .filter(([, v]) => v.count > 1)
        .map(([mobile, v]) => ({ Mobile: mobile, Visitor: v.name, Company: v.company, Visits: v.count }))
        .filter((r) => matchesSearch(r, search))
        .sort((a, b) => b.Visits - a.Visits)
      return { headers: ['Mobile', 'Visitor', 'Company', 'Visits'], rows }
    }
    case 'daily-material-inward': {
      const entries = await gateService.getMaterialInwardEntries({ gate: gate || undefined, status: status || undefined, search: search || undefined })
      const rows = entries
        .filter((e) => inDateRange(e.arrivalTime ?? e.createdAt, dateFrom, dateTo))
        .filter((e) => matchesCompany(e.vendorName, company))
        .map((e) => ({
          'Entry No.': e.entryNumber,
          Vendor: e.vendorName ?? '',
          'PO / Challan': e.poNumber ?? e.challanNumber ?? '',
          Vehicle: e.vehicleNumber ?? '',
          Material: e.materialSummary,
          Packages: e.packages,
          Status: e.status,
          Gate: e.gate,
        }))
      return { headers: ['Entry No.', 'Vendor', 'PO / Challan', 'Vehicle', 'Material', 'Packages', 'Status', 'Gate'], rows }
    }
    case 'inward-pending-grn': {
      const entries = await gateService.getMaterialInwardEntries({ gate: gate || undefined })
      const rows = entries
        .filter((e) => ['waiting_grn', 'waiting_store', 'waiting_qc'].includes(e.status))
        .filter((e) => matchesCompany(e.vendorName, company))
        .map((e) => ({
          'Entry No.': e.entryNumber,
          Vendor: e.vendorName ?? '',
          Material: e.materialSummary,
          Status: e.status,
          'Arrival Time': e.arrivalTime ? formatDateTime(e.arrivalTime) : '',
          Gate: e.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Entry No.', 'Vendor', 'Material', 'Status', 'Arrival Time', 'Gate'], rows }
    }
    case 'inward-without-po': {
      const entries = await gateService.getMaterialInwardEntries({ gate: gate || undefined })
      const rows = entries
        .filter((e) => e.inwardType === 'without_po' || !e.poNumber)
        .filter((e) => inDateRange(e.arrivalTime ?? e.createdAt, dateFrom, dateTo))
        .map((e) => ({
          'Entry No.': e.entryNumber,
          Vendor: e.vendorName ?? '',
          Material: e.materialSummary,
          Status: e.status,
          Gate: e.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Entry No.', 'Vendor', 'Material', 'Status', 'Gate'], rows }
    }
    case 'daily-material-outward': {
      const entries = await gateService.getMaterialOutwardEntries({ gate: gate || undefined, status: status || undefined, search: search || undefined })
      const rows = entries
        .filter((e) => inDateRange(e.releasedAt ?? e.createdAt, dateFrom, dateTo))
        .filter((e) => matchesCompany(e.partyName, company))
        .map((e) => ({
          'Outward No.': e.entryNumber,
          Document: `${e.documentType} ${e.documentNumber}`,
          Party: e.partyName ?? '',
          Vehicle: e.vehicleNumber ?? '',
          Material: e.materialSummary,
          Status: e.status,
          'Released At': e.releasedAt ? formatDateTime(e.releasedAt) : '',
          Gate: e.gate,
        }))
      return { headers: ['Outward No.', 'Document', 'Party', 'Vehicle', 'Material', 'Status', 'Released At', 'Gate'], rows }
    }
    case 'job-work-material': {
      const inward = await gateService.getMaterialInwardEntries({ gate: gate || undefined })
      const outward = await gateService.getMaterialOutwardEntries({ gate: gate || undefined })
      const rows = [
        ...inward.filter((e) => ['job_work_return', 'subcontract_return'].includes(e.inwardType)),
        ...outward.filter((e) => ['job_work_send', 'subcontract_send'].includes(e.outwardType)).map((e) => ({
          entryNumber: e.entryNumber,
          vendorName: e.partyName,
          materialSummary: e.materialSummary,
          status: e.status,
          gate: e.gate,
          time: e.releasedAt ?? e.createdAt,
          direction: 'Outward',
        })),
      ]
        .filter((e) => inDateRange('time' in e ? e.time : (e.arrivalTime ?? e.createdAt), dateFrom, dateTo))
        .map((e) => {
          if ('direction' in e) {
            return {
              'Entry No.': e.entryNumber,
              Direction: e.direction,
              Party: e.vendorName ?? '',
              Material: e.materialSummary,
              Status: e.status,
              Gate: e.gate,
            }
          }
          return {
            'Entry No.': e.entryNumber,
            Direction: 'Inward',
            Party: e.vendorName ?? '',
            Material: e.materialSummary,
            Status: e.status,
            Gate: e.gate,
          }
        })
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Entry No.', 'Direction', 'Party', 'Material', 'Status', 'Gate'], rows }
    }
    case 'scrap-outward': {
      const entries = await gateService.getMaterialOutwardEntries({ gate: gate || undefined })
      const rows = entries
        .filter((e) => e.outwardType === 'scrap_disposal')
        .filter((e) => inDateRange(e.releasedAt ?? e.createdAt, dateFrom, dateTo))
        .map((e) => ({
          'Outward No.': e.entryNumber,
          Document: e.documentNumber,
          Party: e.partyName ?? '',
          Material: e.materialSummary,
          Status: e.status,
          Gate: e.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Outward No.', 'Document', 'Party', 'Material', 'Status', 'Gate'], rows }
    }
    case 'vehicles-inside': {
      const vehicles = await gateService.getVehicles({ gate: gate || undefined })
      const rows = vehicles
        .filter((v) => ['allowed_inside', 'loading', 'unloading', 'ready_exit', 'arrived', 'waiting'].includes(v.status))
        .filter((v) => matchesCompany(v.companyName, company))
        .map((v) => ({
          Vehicle: v.vehicleNumber,
          Purpose: v.purpose,
          Company: v.companyName ?? '',
          Driver: v.driverName,
          'Entry Time': v.entryTime ? formatDateTime(v.entryTime) : '',
          Status: v.status,
          Gate: v.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Vehicle', 'Purpose', 'Company', 'Driver', 'Entry Time', 'Status', 'Gate'], rows }
    }
    case 'vehicle-turnaround': {
      const vehicles = await gateService.getVehicles({ gate: gate || undefined, status: 'exited' })
      const rows = vehicles
        .filter((v) => v.entryTime && v.exitTime && inDateRange(v.exitTime, dateFrom, dateTo))
        .map((v) => ({
          Vehicle: v.vehicleNumber,
          Purpose: v.purpose,
          Company: v.companyName ?? '',
          'Entry Time': formatDateTime(v.entryTime!),
          'Exit Time': formatDateTime(v.exitTime!),
          'Turnaround (min)': minutesBetween(v.entryTime!, v.exitTime),
          Gate: v.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Vehicle', 'Purpose', 'Company', 'Entry Time', 'Exit Time', 'Turnaround (min)', 'Gate'], rows }
    }
    case 'transporter-movement': {
      const vehicles = await gateService.getVehicles({ gate: gate || undefined })
      const counts = new Map<string, number>()
      vehicles
        .filter((v) => inDateRange(v.entryTime ?? v.createdAt, dateFrom, dateTo))
        .forEach((v) => {
          const key = v.transporter ?? '—'
          counts.set(key, (counts.get(key) ?? 0) + 1)
        })
      const rows = [...counts.entries()]
        .map(([transporter, count]) => ({ Transporter: transporter, Movements: count }))
        .filter((r) => matchesSearch(r, search))
        .sort((a, b) => b.Movements - a.Movements)
      return { headers: ['Transporter', 'Movements'], rows }
    }
    case 'missing-exits': {
      const register = await gateService.getGateRegister({
        dateFrom,
        dateTo,
        gate: gate || undefined,
        company: company || undefined,
        missingExitOnly: true,
        insideOnly: true,
      })
      const rows = register
        .map((e) => ({
          'Entry No.': e.entryNumber,
          Type: e.entryType,
          Subject: e.subject,
          Company: e.company ?? '',
          'Entry Time': e.entryTime ? formatDateTime(e.entryTime) : '',
          Gate: e.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Entry No.', 'Type', 'Subject', 'Company', 'Entry Time', 'Gate'], rows }
    }
    case 'pending-returnables': {
      const passes = await gateService.getGatePasses({ gate: gate || undefined })
      const rows = passes
        .filter((p) => p.passKind === 'returnable' && gatePassPendingQty(p) > 0)
        .filter((p) => !status || p.status === status)
        .map((p) => ({
          'Pass No.': p.entryNumber,
          Item: p.items.map((i) => i.itemDescription).join('; '),
          'Pending Qty': gatePassPendingQty(p),
          'Expected Return': p.expectedReturnDate ? formatDate(p.expectedReturnDate) : '',
          Status: p.status,
          Gate: p.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Pass No.', 'Item', 'Pending Qty', 'Expected Return', 'Status', 'Gate'], rows }
    }
    case 'overdue-returnables': {
      const passes = await gateService.getGatePasses({ gate: gate || undefined })
      const rows = passes
        .filter((p) => isGatePassOverdue(p) || p.status === 'overdue')
        .map((p) => ({
          'Pass No.': p.entryNumber,
          Item: p.items.map((i) => i.itemDescription).join('; '),
          'Pending Qty': gatePassPendingQty(p),
          'Expected Return': p.expectedReturnDate ? formatDate(p.expectedReturnDate) : '',
          Department: p.department,
          Gate: p.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Pass No.', 'Item', 'Pending Qty', 'Expected Return', 'Department', 'Gate'], rows }
    }
    case 'partial-returns': {
      const passes = await gateService.getGatePasses({ gate: gate || undefined })
      const rows = passes
        .filter((p) => p.status === 'partially_returned' || (p.passKind === 'returnable' && p.returns.length > 0 && gatePassPendingQty(p) > 0))
        .map((p) => ({
          'Pass No.': p.entryNumber,
          'Returned Qty': p.items.reduce((s, i) => s + i.returnedQuantity, 0),
          'Pending Qty': gatePassPendingQty(p),
          Status: p.status,
          Gate: p.gate,
        }))
        .filter((r) => matchesSearch(r, search))
      return { headers: ['Pass No.', 'Returned Qty', 'Pending Qty', 'Status', 'Gate'], rows }
    }
    case 'asset-movement-register': {
      const outward = await gateService.getMaterialOutwardEntries({ gate: gate || undefined })
      const passes = await gateService.getGatePasses({ gate: gate || undefined })
      const rows = [
        ...outward
          .filter((e) => e.outwardType === 'asset_movement')
          .filter((e) => inDateRange(e.releasedAt ?? e.createdAt, dateFrom, dateTo))
          .map((e) => ({
            Reference: e.entryNumber,
            Type: 'Outward',
            Party: e.partyName ?? '',
            Material: e.materialSummary,
            Status: e.status,
            Gate: e.gate,
          })),
        ...passes
          .filter((p) => p.movementType.toLowerCase().includes('asset'))
          .map((p) => ({
            Reference: p.entryNumber,
            Type: 'Gate Pass',
            Party: p.partyName ?? p.carriedBy,
            Material: p.items.map((i) => i.itemDescription).join('; '),
            Status: p.status,
            Gate: p.gate,
          })),
      ].filter((r) => matchesSearch(r, search))
      return { headers: ['Reference', 'Type', 'Party', 'Material', 'Status', 'Gate'], rows }
    }
    default:
      return { headers: [], rows: [] }
  }
}

export function GateReportsPage() {
  const perms = useGatePermissions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locations, setLocations] = useState<GateLocation[]>([])
  const [dateFrom, setDateFrom] = useState(todayIsoDate())
  const [dateTo, setDateTo] = useState(todayIsoDate())
  const [gate, setGate] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<ReportResult | null>(null)
  const [state, setState] = useState<GateLoadState>('ready')
  const [error, setError] = useState('')

  const selected = useMemo(() => REPORTS.find((r) => r.id === selectedId) ?? null, [selectedId])

  useEffect(() => {
    void gateService.getGateLocations().then(setLocations).catch(() => undefined)
  }, [])

  const loadReport = useCallback(async () => {
    if (!selectedId) return
    setState('loading')
    setError('')
    try {
      const data = await runReport(selectedId, { dateFrom, dateTo, gate, company, status, search })
      setResult(data)
      setState(data.rows.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run report')
      setState('error')
    }
  }, [selectedId, dateFrom, dateTo, gate, company, status, search])

  useEffect(() => {
    if (selectedId) void loadReport()
  }, [selectedId, loadReport])

  const exportCsv = () => {
    if (!result || !selected) return
    exportGateCsv(
      `${selected.id}-${dateFrom}-to-${dateTo}.csv`,
      result.headers,
      result.rows.map((row) => result.headers.map((h) => row[h] ?? '')),
    )
    notify.success('Report exported.')
  }

  const printReport = () => {
    if (!result || !selected) return
    const html = `
      <html><head><title>${selected.title}</title>
      <style>body{font-family:system-ui,sans-serif;padding:16px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left} th{background:#f5f5f5}</style>
      </head><body>
      <h1>${selected.title}</h1>
      <p>${formatDate(dateFrom)} – ${formatDate(dateTo)}${gate ? ` · ${gate}` : ''}</p>
      <table><thead><tr>${result.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${result.rows.map((row) => `<tr>${result.headers.map((h) => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) {
      notify.warning('Allow pop-ups to print this report.')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  const grouped = useMemo(() => {
    const map = new Map<GateReportDefinition['category'], GateReportDefinition[]>()
    for (const r of REPORTS) {
      const list = map.get(r.category) ?? []
      list.push(r)
      map.set(r.category, list)
    }
    return map
  }, [])

  if (!perms.canViewReports) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Gate & Security" title="Reports" autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="You do not have permission to view gate reports." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Gate & Security"
      title="Gate Reports"
      description="Operational reports from gate register data — client-side filters, export and print."
      showDescription
      autoBreadcrumbs={false}
      breadcrumbs={[...GATE_BREADCRUMB, { label: 'Reports' }]}
      favoritePath="/gate/reports"
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <aside className="space-y-4">
          {(['visitor', 'material', 'vehicle', 'gate_pass'] as const).map((cat) => (
            <section key={cat} className="rounded-lg border border-erp-border bg-white p-3">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                {CATEGORY_LABELS[cat]} reports
              </h3>
              <ul className="space-y-1">
                {(grouped.get(cat) ?? []).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-erp-primary-soft/40 ${selectedId === r.id ? 'bg-erp-primary-soft font-semibold text-erp-primary' : 'text-erp-text'}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-erp-muted" aria-hidden />
                      <span>
                        {r.title}
                        <span className="mt-0.5 block text-[11px] font-normal text-erp-muted">{r.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>

        <div className="min-w-0">
          {!selected ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-erp-border bg-white p-8 text-center">
              <BarChart3 className="mb-3 h-10 w-10 text-erp-muted" aria-hidden />
              <p className="text-[14px] font-medium text-erp-text">Select a report</p>
              <p className="mt-1 max-w-md text-[13px] text-erp-muted">Choose a report card on the left to view filtered gate data.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h2 className="text-[15px] font-semibold text-erp-text">{selected.title}</h2>
                <p className="mt-0.5 text-[12px] text-erp-muted">{selected.description}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Date from">
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </FormField>
                  <FormField label="Date to">
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </FormField>
                  <FormField label="Gate">
                    <Select value={gate} onChange={(e) => setGate(e.target.value)}>
                      <option value="">All</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Company / vendor">
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Filter by company…" />
                  </FormField>
                  <FormField label="Status">
                    <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Optional status filter" />
                  </FormField>
                  <FormField label="Search">
                    <SearchInput value={search} onChange={setSearch} placeholder="Search within results…" aria-label="Search report" />
                  </FormField>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ErpButton size="sm" onClick={() => void loadReport()}>Apply Filters</ErpButton>
                  <ErpButton size="sm" variant="outline" icon={Download} onClick={exportCsv} disabled={!result?.rows.length}>
                    Export CSV
                  </ErpButton>
                  <ErpButton size="sm" variant="outline" icon={Printer} onClick={printReport} disabled={!result?.rows.length}>
                    Print
                  </ErpButton>
                </div>
              </section>

              <GateDataStates
                state={state}
                error={error}
                onRetry={() => void loadReport()}
                emptyTitle="No rows for this report"
                emptyDescription="Adjust the date range or filters and try again."
              >
                {result && result.rows.length > 0 ? (
                  <EnterpriseRegisterTableShell>
                    <table className="erp-table w-full text-[12.5px]">
                      <thead>
                        <tr>
                          {result.headers.map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i}>
                            {result.headers.map((h) => (
                              <td key={h} className="max-w-[200px] truncate">{row[h] ?? '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </EnterpriseRegisterTableShell>
                ) : null}
              </GateDataStates>
            </div>
          )}
        </div>
      </div>
    </OperationalPageShell>
  )
}
