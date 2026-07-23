/**
 * Gate & Security demo seed data (demo mode only).
 * Realistic Indian discrete-manufacturing gate operations for a trailer factory.
 * All timestamps are generated relative to "now" so the register always looks live.
 */

import type {
  ContractorEntry,
  CourierEntry,
  ExpectedVisitor,
  GateActivity,
  GateApproval,
  GateLocation,
  GatePass,
  GateSettings,
  GateVehicle,
  MaterialInwardEntry,
  MaterialOutwardEntry,
  Visitor,
  VisitorVisit,
} from '../types/gate.types'

const TENANT = 'demo-tenant'

function todayAt(hours: number, minutes = 0): string {
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

function daysAgoAt(days: number, hours: number, minutes = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

function daysFromNowDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString()
}

const today = daysFromNowDate(0)

function audit(createdAt: string, by = 'Ramesh Yadav (Security)') {
  return {
    tenantId: TENANT,
    createdAt,
    createdBy: by,
    updatedAt: createdAt,
    updatedBy: by,
  }
}

// ─── Gate locations ──────────────────────────────────────────────────────────

export function seedGateLocations(): GateLocation[] {
  return [
    {
      id: 'gate-main',
      name: 'Main Gate',
      plant: 'Plant 1 — Chennai',
      entryTypesAllowed: ['visitor', 'vehicle', 'material_inward', 'material_outward', 'contractor', 'courier'],
      isActive: true,
    },
    {
      id: 'gate-material',
      name: 'Material Gate',
      plant: 'Plant 1 — Chennai',
      entryTypesAllowed: ['vehicle', 'material_inward', 'material_outward'],
      isActive: true,
    },
    {
      id: 'gate-2',
      name: 'Gate 2 (Fabrication)',
      plant: 'Plant 2 — Sriperumbudur',
      entryTypesAllowed: ['visitor', 'vehicle', 'contractor'],
      isActive: true,
    },
  ]
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function seedGateSettings(): GateSettings {
  return {
    visitor: {
      hostApprovalRequired: true,
      photoCaptureRequired: false,
      maskedIdEnabled: true,
      qrEnabled: true,
      defaultVisitDurationMinutes: 120,
      overstayThresholdMinutes: 240,
    },
    material: {
      allowInwardWithoutPo: true,
      vehicleNumberRequired: true,
      documentPhotoRequired: false,
      outwardApprovalRequired: true,
      releaseChecklistRequired: true,
    },
    pass: {
      numberFormat: 'GP-{YYYY}-{seq5}',
      returnReminderDays: 3,
      approvalRequired: true,
      partialReturnAllowed: true,
    },
    masters: {
      visitorTypes: [
        'customer', 'vendor', 'consultant', 'service_engineer', 'interview_candidate',
        'auditor', 'government_official', 'contractor', 'delivery_person', 'personal_visitor', 'other',
      ],
      visitPurposes: [
        'Business Meeting', 'Machine Service', 'Quality Audit', 'Interview', 'Material Delivery',
        'Statutory Inspection', 'Vendor Development', 'Project Discussion', 'Training', 'Personal',
      ],
      vehicleTypes: ['Truck', 'Trailer', 'LCV', 'Tempo', 'Container', 'Car', 'Two Wheeler', 'Tanker'],
      materialMovementTypes: [
        'Purchase Order', 'Job Work', 'Subcontract', 'Repair', 'Sample', 'Asset', 'Scrap', 'Stock Transfer',
      ],
      passTypes: ['Returnable', 'Non-Returnable'],
      courierCompanies: ['Blue Dart', 'DTDC', 'Delhivery', 'Professional Couriers', 'India Post', 'FedEx'],
      rejectionReasons: [
        'Document mismatch', 'Vehicle condition unsafe', 'No prior approval', 'Blacklisted party',
        'Wrong gate', 'Outside permitted hours',
      ],
      blacklistReasons: ['Security incident', 'Theft attempt', 'Repeated violations', 'Management instruction'],
    },
  }
}

// ─── Visitor profiles (repeat-visitor lookup by mobile) ─────────────────────

export function seedVisitorProfiles(): Visitor[] {
  return [
    {
      id: 'vp-1', tenantId: TENANT, name: 'Suresh Krishnan', mobile: '9840012345',
      company: 'Ashok Leyland Ltd', email: 'suresh.k@ashokleyland.com',
      lastHost: 'Vikram Mehta', lastVehicleNumber: 'TN 01 AQ 7788', lastVisitAt: daysAgoAt(12, 11, 30),
      totalVisits: 8, isBlacklisted: false, idType: 'Company ID', idReferenceMasked: 'AL-**-4471',
    },
    {
      id: 'vp-2', tenantId: TENANT, name: 'Farhan Sheikh', mobile: '9822098220',
      company: 'JSW Steel Ltd', lastHost: 'Anita Desai', lastVisitAt: daysAgoAt(30, 10, 0),
      totalVisits: 3, isBlacklisted: false,
    },
    {
      id: 'vp-3', tenantId: TENANT, name: 'Deepak Nair', mobile: '9633445566',
      company: 'Hydraulics & Pneumatics Services', lastHost: 'Karthik Subramani',
      lastVehicleNumber: 'KL 07 CD 9911', lastVisitAt: daysAgoAt(5, 14, 15),
      totalVisits: 14, isBlacklisted: false, idType: 'DL', idReferenceMasked: 'KL07 ****3321',
    },
    {
      id: 'vp-4', tenantId: TENANT, name: 'Ravi Verma', mobile: '9911223344',
      company: 'Scrap Traders (Unregistered)', lastVisitAt: daysAgoAt(60, 16, 0),
      totalVisits: 2, isBlacklisted: true, blacklistReason: 'Attempted removal of material without gate pass',
    },
  ]
}

// ─── Visitor visits ──────────────────────────────────────────────────────────

export function seedVisitorVisits(): VisitorVisit[] {
  const visits: VisitorVisit[] = []

  const baseVisit = {
    visitorCount: 1,
    laptopCarried: false,
    equipmentCarried: false,
    bagCount: 0,
    safetyDeclarationAccepted: true,
    ppeRequired: false,
    ndaRequired: false,
    hostApprovalRequired: true,
    gate: 'Main Gate',
    visitDate: today,
    approvalHistory: [] as VisitorVisit['approvalHistory'],
  }

  // 8 visitors currently inside
  const inside: Array<Partial<VisitorVisit> & { visitorName: string; mobile: string; hostName: string; department: string; purpose: string }> = [
    { visitorName: 'Suresh Krishnan', mobile: '9840012345', company: 'Ashok Leyland Ltd', visitorType: 'customer', hostName: 'Vikram Mehta', department: 'Sales', purpose: 'Trailer inspection before dispatch', entryTime: todayAt(9, 40), laptopCarried: true, vehicleNumber: 'TN 01 AQ 7788', vehicleType: 'Car' },
    { visitorName: 'Deepak Nair', mobile: '9633445566', company: 'Hydraulics & Pneumatics Services', visitorType: 'service_engineer', hostName: 'Karthik Subramani', department: 'Maintenance', purpose: 'Press brake hydraulic service', entryTime: todayAt(8, 55), equipmentCarried: true, belongingsDescription: 'Tool kit, pressure gauge set', ppeRequired: true },
    { visitorName: 'Meena Iyer', mobile: '9445067890', company: 'TUV SUD South Asia', visitorType: 'auditor', hostName: 'Priya Raghavan', department: 'Quality', purpose: 'ISO 9001 surveillance audit', entryTime: todayAt(10, 5), laptopCarried: true, ndaRequired: true },
    { visitorName: 'Arjun Reddy', mobile: '9700112233', company: 'Sundaram Fasteners Ltd', visitorType: 'vendor', hostName: 'Mohammed Ismail', department: 'Purchase', purpose: 'Vendor development discussion', entryTime: todayAt(11, 10) },
    { visitorName: 'Kavitha Srinivasan', mobile: '9884556677', visitorType: 'interview_candidate', hostName: 'Lakshmi Narayan', department: 'Administration', purpose: 'Interview — Design Engineer', entryTime: todayAt(10, 45), bagCount: 1 },
    { visitorName: 'Rajesh Gupta', mobile: '9810445566', company: 'Jost India Auto Component', visitorType: 'vendor', hostName: 'Mohammed Ismail', department: 'Purchase', purpose: 'Fifth wheel coupling samples', entryTime: todayAt(12, 20), belongingsDescription: 'Sample box (2 nos)' },
    { visitorName: 'Inspector Manoharan', mobile: '9500990011', company: 'TN Pollution Control Board', visitorType: 'government_official', hostName: 'Ganesh Kumar', department: 'Management', purpose: 'Statutory environment inspection', entryTime: todayAt(13, 5) },
    { visitorName: 'Stephen Dsouza', mobile: '9922334455', company: 'Siemens Ltd', visitorType: 'service_engineer', hostName: 'Karthik Subramani', department: 'Maintenance', purpose: 'CNC controller diagnostics', entryTime: todayAt(9, 15), laptopCarried: true, equipmentCarried: true, ppeRequired: true },
  ]
  inside.forEach((v, i) => {
    visits.push({
      ...baseVisit,
      id: `vis-in-${i + 1}`,
      entryNumber: `VIS-${today.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      status: 'inside',
      visitorType: 'other',
      approvalStatus: 'approved',
      approvedBy: v.hostName,
      approvedAt: v.entryTime,
      approvalHistory: [
        { at: v.entryTime!, by: v.hostName!, action: 'approved', remarks: 'Host confirmed' },
      ],
      ...audit(v.entryTime ?? todayAt(9, 0)),
      ...v,
    } as VisitorVisit)
  })

  // 2 walk-ins waiting approval / arrived
  visits.push({
    ...baseVisit,
    id: 'vis-wait-1',
    entryNumber: `VIS-${today.replace(/-/g, '')}-021`,
    status: 'waiting_approval',
    visitorName: 'Prakash Jain',
    mobile: '9866778899',
    company: 'Mahindra Logistics',
    visitorType: 'consultant',
    hostName: 'Ganesh Kumar',
    department: 'Dispatch',
    purpose: 'Freight rate negotiation',
    approvalStatus: 'pending',
    approvalHistory: [{ at: minutesAgo(18), by: 'Gate Operator', action: 'approval_requested' }],
    ...audit(minutesAgo(18)),
  } as VisitorVisit)
  visits.push({
    ...baseVisit,
    id: 'vis-arr-1',
    entryNumber: `VIS-${today.replace(/-/g, '')}-022`,
    status: 'arrived',
    visitorName: 'Farhan Sheikh',
    mobile: '9822098220',
    company: 'JSW Steel Ltd',
    visitorType: 'vendor',
    hostName: 'Anita Desai',
    department: 'Purchase',
    purpose: 'Steel coil pricing review',
    approvalStatus: 'pending',
    ...audit(minutesAgo(6)),
  } as VisitorVisit)

  // 15 completed visits over the last 3 days
  const completed: Array<[string, string, string, string, string, string, number, number]> = [
    ['Anand Pillai', '9447001122', 'Wheels India Ltd', 'Mohammed Ismail', 'Purchase', 'Axle supply schedule', 1, 10],
    ['Girish Rao', '9880556677', 'Bharat Forge Ltd', 'Anita Desai', 'Purchase', 'Forged component samples', 1, 11],
    ['Nithya Menon', '9840998877', 'Apollo Tyres Ltd', 'Vikram Mehta', 'Sales', 'Tyre fitment discussion', 1, 14],
    ['Sanjay Patil', '9922114455', 'VRL Logistics', 'Ganesh Kumar', 'Dispatch', 'Transporter agreement', 2, 9],
    ['Dr. Ramya Bhat', '9448012345', 'Factory Medical Services', 'Lakshmi Narayan', 'Administration', 'First-aid room inspection', 2, 11],
    ['Vinod Khanna', '9810778899', 'SKF India', 'Karthik Subramani', 'Maintenance', 'Bearing failure analysis', 2, 15],
    ['Joseph Antony', '9895443322', 'York Transport Equipment', 'Priya Raghavan', 'Quality', 'Landing leg quality complaint', 3, 10],
    ['Shalini Krishnan', '9884001122', 'ICICI Bank', 'Ravi Shankar', 'Finance', 'Working capital review', 3, 12],
    ['Mukesh Ambani Jr', '9833445566', 'Reliance Polymers', 'Anita Desai', 'Purchase', 'HDPE sheet quotation', 1, 15],
    ['Gopal Swamy', '9440990088', 'Ucal Fuel Systems', 'Mohammed Ismail', 'Purchase', 'New vendor registration', 1, 16],
    ['Peter Fernandes', '9822556644', 'Schmersal India', 'Karthik Subramani', 'Maintenance', 'Safety interlock demo', 2, 10],
    ['Divya Prakash', '9600112244', 'Manpower Staffing', 'Lakshmi Narayan', 'Administration', 'Contract staffing review', 2, 14],
    ['Harish Chandra', '9911002233', 'Tata Steel BSL', 'Anita Desai', 'Purchase', 'Steel plate delivery schedule', 3, 11],
    ['Selvam Murugan', '9994455667', 'Local Transport Union', 'Ganesh Kumar', 'Dispatch', 'Driver facility discussion', 3, 15],
    ['Amit Trivedi', '9820445577', 'Axalta Coating Systems', 'Priya Raghavan', 'Quality', 'Paint booth audit', 3, 9],
  ]
  completed.forEach(([name, mobile, company, host, dept, purpose, dayOffset, hour], i) => {
    const entry = daysAgoAt(dayOffset, hour, 10)
    const exit = daysAgoAt(dayOffset, hour + 2, 0)
    visits.push({
      ...baseVisit,
      id: `vis-done-${i + 1}`,
      entryNumber: `VIS-${daysFromNowDate(-dayOffset).replace(/-/g, '')}-${String(30 + i).padStart(3, '0')}`,
      status: 'exited',
      visitorName: name,
      mobile,
      company,
      visitorType: 'vendor',
      hostName: host,
      department: dept,
      purpose,
      visitDate: daysFromNowDate(-dayOffset),
      entryTime: entry,
      exitTime: exit,
      badgeReturned: true,
      approvalStatus: 'approved',
      approvedBy: host,
      approvedAt: entry,
      approvalHistory: [{ at: entry, by: host, action: 'approved' }],
      ...audit(entry),
    } as VisitorVisit)
  })

  // 1 rejected, 1 cancelled
  visits.push({
    ...baseVisit,
    id: 'vis-rej-1',
    entryNumber: `VIS-${today.replace(/-/g, '')}-023`,
    status: 'rejected',
    visitorName: 'Ravi Verma',
    mobile: '9911223344',
    company: 'Scrap Traders (Unregistered)',
    visitorType: 'other',
    hostName: 'Ganesh Kumar',
    department: 'Dispatch',
    purpose: 'Scrap purchase enquiry',
    approvalStatus: 'rejected',
    approvalRemarks: 'Blacklisted visitor — prior security incident',
    approvalHistory: [{ at: todayAt(8, 30), by: 'Ganesh Kumar', action: 'rejected', remarks: 'Blacklisted visitor' }],
    ...audit(todayAt(8, 25)),
  } as VisitorVisit)

  return visits
}

// ─── Expected visitors ──────────────────────────────────────────────────────

export function seedExpectedVisitors(): ExpectedVisitor[] {
  const rows: Array<[string, string, string, string, string, string, string, string?]> = [
    ['Balaji Venkatesh', '9884990011', 'Daimler India CV', '10:30', 'Vikram Mehta', 'Sales', 'Fleet trailer requirement', 'TN 12 BB 4455'],
    ['Cynthia Thomas', '9995551122', 'DNV Business Assurance', '11:00', 'Priya Raghavan', 'Quality', 'Welding process audit'],
    ['Mohan Das', '9440221133', 'Sundaram Brake Linings', '11:30', 'Mohammed Ismail', 'Purchase', 'Brake lining samples'],
    ['Kiran Bedi', '9810333444', 'Labour Department', '12:00', 'Lakshmi Narayan', 'Administration', 'Statutory records inspection'],
    ['Naveen Chandra', '9866443322', 'Hyva India', '14:00', 'Karthik Subramani', 'Maintenance', 'Tipping cylinder service contract'],
    ['Fatima Begum', '9633998877', 'SIDBI', '14:30', 'Ravi Shankar', 'Finance', 'MSME loan documentation'],
    ['George Mathew', '9847113355', 'BPW Trailer Axles', '15:00', 'Anita Desai', 'Purchase', 'Axle technical discussion', 'KL 07 QT 2211'],
    ['Sneha Kulkarni', '9922887766', 'Randstad India', '15:30', 'Lakshmi Narayan', 'Administration', 'Interview — Welder trade test'],
    ['Pradeep Menon', '9995004433', 'WABCO India', '16:00', 'Priya Raghavan', 'Quality', 'ABS kit inspection'],
    ['Tarun Khanna', '9810667788', 'EXIM Consultants', '16:30', 'Ravi Shankar', 'Finance', 'Export incentive discussion'],
  ]
  return rows.map(([name, mobile, company, time, host, dept, purpose, vehicle], i) => ({
    id: `exp-${i + 1}`,
    tenantId: TENANT,
    reference: `EXP-${today.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
    visitorName: name,
    mobile,
    company,
    visitDate: today,
    expectedArrival: time,
    hostName: host,
    department: dept,
    purpose,
    gate: 'Main Gate',
    vehicleNumber: vehicle,
    instructions: i === 3 ? 'Escort to admin block. Keep statutory registers ready.' : undefined,
    status: 'expected',
  }))
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export function seedVehicles(): GateVehicle[] {
  const mk = (
    i: number,
    v: Partial<GateVehicle> & Pick<GateVehicle, 'vehicleNumber' | 'purpose' | 'driverName' | 'status'>,
  ): GateVehicle => {
    const createdAt = v.entryTime ?? todayAt(8, 0)
    return {
      id: `veh-${i}`,
      entryNumber: `VEH-${today.replace(/-/g, '')}-${String(i).padStart(3, '0')}`,
      vehicleType: 'Truck',
      licenceVerified: 'verified',
      gate: 'Material Gate',
      timeline: [],
      ...audit(createdAt),
      ...v,
    } as GateVehicle
  }

  return [
    // 6 inside (various stages)
    mk(1, { vehicleNumber: 'TN 39 BX 4521', purpose: 'Steel plate delivery', companyName: 'Tata Steel BSL', transporter: 'TCI Freight', driverName: 'Munusamy R', driverMobile: '9994411223', status: 'unloading', relatedDocument: 'PO-2026-0412', entryTime: todayAt(8, 35), currentLocation: 'Unloading Bay 1', sealNumber: 'SL-88121', vehicleType: 'Trailer' }),
    mk(2, { vehicleNumber: 'MH 12 AB 3344', purpose: 'FG trailer dispatch', companyName: 'Daimler India CV', transporter: 'VRL Logistics', driverName: 'Shivaji Pawar', driverMobile: '9822007766', status: 'loading', relatedDocument: 'DC-2026-0188', entryTime: todayAt(9, 10), currentLocation: 'FG Yard', vehicleType: 'Trailer' }),
    mk(3, { vehicleNumber: 'TN 22 CD 9087', purpose: 'Fastener delivery', companyName: 'Sundaram Fasteners', driverName: 'Elango P', driverMobile: '9884433221', status: 'allowed_inside', relatedDocument: 'PO-2026-0455', entryTime: todayAt(10, 20), currentLocation: 'Stores Dock', vehicleType: 'LCV' }),
    mk(4, { vehicleNumber: 'KA 01 EF 6543', purpose: 'Paint drums delivery', companyName: 'Axalta Coating', transporter: 'Safexpress', driverName: 'Basavaraj K', status: 'waiting', entryTime: todayAt(10, 55), currentLocation: 'Gate parking', relatedDocument: 'PO-2026-0461' }),
    mk(5, { vehicleNumber: 'TN 09 GH 1290', purpose: 'Job work return — laser cut parts', companyName: 'Precision Lasers', driverName: 'Syed Ali', driverMobile: '9600334455', status: 'unloading', relatedDocument: 'JW-2026-0071', entryTime: todayAt(11, 25), currentLocation: 'Unloading Bay 2', vehicleType: 'Tempo' }),
    mk(6, { vehicleNumber: 'AP 16 JK 7788', purpose: 'Scrap disposal pickup', companyName: 'Sri Balaji Scrap Traders', driverName: 'Venkat Rao', status: 'ready_exit', relatedDocument: 'SCR-2026-0009', entryTime: todayAt(7, 50), currentLocation: 'Scrap Yard', sealNumber: 'SL-88144' }),
    // At gate / expected / exited
    mk(7, { vehicleNumber: 'TN 45 LM 2233', purpose: 'Tyre delivery', companyName: 'Apollo Tyres', driverName: 'Selvam K', status: 'arrived', entryTime: null, relatedDocument: 'PO-2026-0468', createdAt: minutesAgo(40) }),
    mk(8, { vehicleNumber: 'TN 02 NP 5566', purpose: 'FG trailer dispatch', companyName: 'Ashok Leyland', driverName: 'Raju M', status: 'expected', relatedDocument: 'DC-2026-0191' }),
    mk(9, { vehicleNumber: 'TN 39 QR 8899', purpose: 'Welding consumables delivery', companyName: 'Ador Welding', driverName: 'Prabhu S', status: 'exited', entryTime: daysAgoAt(0, 7, 15), exitTime: daysAgoAt(0, 9, 5), relatedDocument: 'PO-2026-0449', vehicleType: 'LCV' }),
    mk(10, { vehicleNumber: 'MH 04 ST 1122', purpose: 'FG trailer dispatch', companyName: 'Tata Motors', transporter: 'TCI Freight', driverName: 'Ganpat Shinde', status: 'exited', entryTime: daysAgoAt(1, 10, 0), exitTime: daysAgoAt(1, 14, 30), relatedDocument: 'DC-2026-0185', vehicleType: 'Trailer' }),
  ]
}

// ─── Material inward ─────────────────────────────────────────────────────────

export function seedMaterialInward(): MaterialInwardEntry[] {
  const mk = (
    i: number,
    v: Partial<MaterialInwardEntry> &
      Pick<MaterialInwardEntry, 'status' | 'inwardType' | 'materialSummary' | 'packages'>,
  ): MaterialInwardEntry => {
    const createdAt = v.arrivalTime ?? todayAt(8, 0)
    return {
      id: `min-${i}`,
      entryNumber: `MIN-${today.replace(/-/g, '')}-${String(i).padStart(3, '0')}`,
      gate: 'Material Gate',
      lines: [],
      timeline: [],
      linkedGrnNumber: null,
      linkedQcNumber: null,
      ...audit(createdAt),
      ...v,
    } as MaterialInwardEntry
  }

  return [
    mk(1, { status: 'waiting_unloading', inwardType: 'purchase_order', vendorName: 'Tata Steel BSL', poNumber: 'PO-2026-0412', challanNumber: 'CH-99812', invoiceNumber: 'INV-TS-77120', lrNumber: 'LR-40098', vehicleNumber: 'TN 39 BX 4521', transporter: 'TCI Freight', driverName: 'Munusamy R', materialSummary: 'E250 steel plates 8mm × 40 nos', packages: 4, approxQty: 12.5, uom: 'MT', grossWeight: '13.2 MT', warehouse: 'RM Store', unloadingLocation: 'Unloading Bay 1', arrivalTime: todayAt(8, 35), sealNumber: 'SL-88121' }),
    mk(2, { status: 'waiting_store', inwardType: 'purchase_order', vendorName: 'Sundaram Fasteners', poNumber: 'PO-2026-0455', challanNumber: 'CH-11230', vehicleNumber: 'TN 22 CD 9087', driverName: 'Elango P', materialSummary: 'HT bolts M16/M20 assortment', packages: 18, approxQty: 18, uom: 'Boxes', warehouse: 'Fastener Store', arrivalTime: todayAt(10, 20) }),
    mk(3, { status: 'waiting_qc', inwardType: 'job_work_return', vendorName: 'Precision Lasers', challanNumber: 'JW-2026-0071', vehicleNumber: 'TN 09 GH 1290', driverName: 'Syed Ali', materialSummary: 'Laser-cut gusset plates — WO-2026-118', packages: 6, warehouse: 'WIP Store', arrivalTime: todayAt(11, 25) }),
    mk(4, { status: 'waiting_grn', inwardType: 'purchase_order', vendorName: 'Ador Welding', poNumber: 'PO-2026-0449', invoiceNumber: 'INV-AW-3312', vehicleNumber: 'TN 39 QR 8899', materialSummary: 'MIG wire 1.2mm — 50 spools', packages: 10, warehouse: 'Consumable Store', arrivalTime: todayAt(7, 15) }),
    mk(5, { status: 'accepted', inwardType: 'purchase_order', vendorName: 'Wheels India', poNumber: 'PO-2026-0431', challanNumber: 'CH-56110', vehicleNumber: 'TN 45 WX 3001', materialSummary: 'Trailer wheel rims 22.5" — 64 nos', packages: 16, warehouse: 'RM Store', arrivalTime: daysAgoAt(1, 9, 40), linkedGrnNumber: 'GRN-2026-0388' }),
    mk(6, { status: 'vehicle_arrived', inwardType: 'without_po', vendorName: 'Chennai Hardware Mart', materialSummary: 'Urgent maintenance spares — bearings & seals', packages: 2, vehicleNumber: 'TN 05 AZ 6620', warehouse: 'Maintenance Store', arrivalTime: minutesAgo(25), remarks: 'No PO — maintenance emergency purchase. Approval requested.' }),
    mk(7, { status: 'rejected', inwardType: 'purchase_order', vendorName: 'Kwality Rubber Works', poNumber: 'PO-2026-0402', vehicleNumber: 'TN 10 KL 8090', materialSummary: 'Mudflap rubber sheets', packages: 8, arrivalTime: daysAgoAt(1, 15, 20), remarks: 'Rejected at gate — vendor sent wrong grade, returned without unloading' }),
    mk(8, { status: 'closed', inwardType: 'sample_received', vendorName: 'BPW Trailer Axles', materialSummary: 'Axle sample — 1 unit for evaluation', packages: 1, vehicleNumber: 'KL 07 QT 2211', warehouse: 'Engineering Store', arrivalTime: daysAgoAt(2, 11, 0), linkedGrnNumber: 'GRN-2026-0371' }),
  ]
}

// ─── Material outward ────────────────────────────────────────────────────────

const CHECKLIST_ALL_FALSE = {
  sourceApproved: false,
  vehicleMatches: false,
  driverVerified: false,
  packageCountMatches: false,
  materialMatches: false,
  documentAvailable: false,
  sealRecorded: false,
  securityCheckDone: false,
}

export function seedMaterialOutward(): MaterialOutwardEntry[] {
  const mk = (
    i: number,
    v: Partial<MaterialOutwardEntry> &
      Pick<MaterialOutwardEntry, 'status' | 'outwardType' | 'documentType' | 'documentNumber' | 'materialSummary' | 'packagesExpected'>,
  ): MaterialOutwardEntry => {
    const createdAt = v.plannedTime ?? todayAt(9, 0)
    return {
      id: `mout-${i}`,
      entryNumber: `MOUT-${today.replace(/-/g, '')}-${String(i).padStart(3, '0')}`,
      documentApproved: true,
      approvalStatus: 'approved',
      gate: 'Material Gate',
      checklist: { ...CHECKLIST_ALL_FALSE },
      lines: [],
      timeline: [],
      ...audit(createdAt),
      ...v,
    } as MaterialOutwardEntry
  }

  return [
    mk(1, { status: 'vehicle_inside', outwardType: 'finished_goods_dispatch', documentType: 'Delivery Challan', documentNumber: 'DC-2026-0188', partyName: 'Daimler India CV', vehicleNumber: 'MH 12 AB 3344', driverName: 'Shivaji Pawar', transporter: 'VRL Logistics', materialSummary: '40ft flatbed trailer — 1 unit', packagesExpected: 1, plannedTime: todayAt(9, 0), checklist: { ...CHECKLIST_ALL_FALSE, sourceApproved: true, vehicleMatches: true } }),
    mk(2, { status: 'ready_for_gate', outwardType: 'job_work_send', documentType: 'Job Work Challan', documentNumber: 'JWC-2026-0075', partyName: 'Precision Lasers', materialSummary: 'MS sheets for laser cutting — 22 nos', packagesExpected: 3, plannedTime: todayAt(14, 0) }),
    mk(3, { status: 'pending_approval', outwardType: 'scrap_disposal', documentType: 'Scrap Note', documentNumber: 'SCR-2026-0009', partyName: 'Sri Balaji Scrap Traders', vehicleNumber: 'AP 16 JK 7788', driverName: 'Venkat Rao', materialSummary: 'MS offcuts & turning scrap ~3.8 MT', packagesExpected: 1, documentApproved: false, approvalStatus: 'pending', plannedTime: todayAt(12, 0) }),
    mk(4, { status: 'awaiting_vehicle', outwardType: 'vendor_return', documentType: 'Purchase Return', documentNumber: 'PR-2026-0031', partyName: 'Kwality Rubber Works', materialSummary: 'Rejected mudflap sheets — 8 packs', packagesExpected: 8, plannedTime: todayAt(16, 0) }),
    mk(5, { status: 'released', outwardType: 'finished_goods_dispatch', documentType: 'Delivery Challan', documentNumber: 'DC-2026-0185', partyName: 'Tata Motors', vehicleNumber: 'MH 04 ST 1122', driverName: 'Ganpat Shinde', materialSummary: 'Skeletal container trailer — 1 unit', packagesExpected: 1, packagesVerified: 1, releasedAt: daysAgoAt(1, 14, 30), releasedBy: 'Ramesh Yadav (Security)', plannedTime: daysAgoAt(1, 13, 0), checklist: { sourceApproved: true, vehicleMatches: true, driverVerified: true, packageCountMatches: true, materialMatches: true, documentAvailable: true, sealRecorded: true, securityCheckDone: true } }),
    mk(6, { status: 'held', outwardType: 'asset_movement', documentType: 'Asset Movement Note', documentNumber: 'AMN-2026-0004', partyName: 'Plant 2 — Sriperumbudur', materialSummary: 'Welding rectifier — 2 units to Plant 2', packagesExpected: 2, holdRemarks: 'Asset tags do not match movement note — awaiting maintenance confirmation', plannedTime: todayAt(11, 0), checklist: { ...CHECKLIST_ALL_FALSE, sourceApproved: true, documentAvailable: true } }),
    mk(7, { status: 'released', outwardType: 'repair_send', documentType: 'Returnable Gate Pass', documentNumber: 'GP-2026-00041', partyName: 'Siemens Ltd Service Centre', materialSummary: 'CNC servo drive for repair — 1 unit', packagesExpected: 1, packagesVerified: 1, releasedAt: daysAgoAt(2, 12, 15), releasedBy: 'Ramesh Yadav (Security)', plannedTime: daysAgoAt(2, 11, 0), checklist: { sourceApproved: true, vehicleMatches: true, driverVerified: true, packageCountMatches: true, materialMatches: true, documentAvailable: true, sealRecorded: true, securityCheckDone: true } }),
    mk(8, { status: 'mismatch', outwardType: 'delivery_challan', documentType: 'Delivery Challan', documentNumber: 'DC-2026-0190', partyName: 'Ashok Leyland', vehicleNumber: 'TN 02 NP 5566', materialSummary: 'Spare parts kit — 4 boxes', packagesExpected: 4, packagesVerified: 3, mismatchRemarks: 'Only 3 of 4 boxes presented at gate — dispatch team informed', plannedTime: todayAt(10, 30), checklist: { ...CHECKLIST_ALL_FALSE, sourceApproved: true, vehicleMatches: true, driverVerified: true, documentAvailable: true } }),
  ]
}

// ─── Gate passes ─────────────────────────────────────────────────────────────

export function seedGatePasses(): GatePass[] {
  const mk = (
    i: number,
    v: Partial<GatePass> &
      Pick<GatePass, 'status' | 'passKind' | 'movementType' | 'department' | 'responsibleEmployee' | 'purpose' | 'outwardDate' | 'items'>,
  ): GatePass => ({
    id: `gp-${i}`,
    entryNumber: `GP-2026-${String(40 + i).padStart(5, '0')}`,
    carriedBy: v.responsibleEmployee,
    approvalStatus: 'approved',
    returns: [],
    gate: 'Main Gate',
    ...audit(v.outwardDate),
    ...v,
  } as GatePass)

  return [
    mk(1, {
      status: 'sent_out', passKind: 'returnable', movementType: 'Repair', department: 'Maintenance',
      responsibleEmployee: 'Karthik Subramani', carriedBy: 'Syed Ali (Driver)', partyName: 'Siemens Ltd Service Centre',
      purpose: 'CNC servo drive repair', outwardDate: daysAgoAt(2, 12, 0), expectedReturnDate: daysFromNowDate(5),
      approverName: 'Ganesh Kumar',
      items: [{ id: 'gp1-i1', itemDescription: 'Siemens servo drive 6SL3210', serialNumber: 'SRV-88213', quantity: 1, uom: 'No', conditionOut: 'Faulty — no output', returnedQuantity: 0 }],
    }),
    mk(2, {
      status: 'overdue', passKind: 'returnable', movementType: 'Job Work', department: 'Production',
      responsibleEmployee: 'Ganesh Kumar', partyName: 'Precision Lasers',
      purpose: 'Cutting fixtures for laser job work', outwardDate: daysAgoAt(20, 10, 0), expectedReturnDate: daysFromNowDate(-6),
      approverName: 'Production Head',
      items: [
        { id: 'gp2-i1', itemDescription: 'Gusset cutting fixture', quantity: 2, uom: 'No', conditionOut: 'Good', returnedQuantity: 0 },
        { id: 'gp2-i2', itemDescription: 'Template plates set', quantity: 1, uom: 'Set', conditionOut: 'Good', returnedQuantity: 0 },
      ],
    }),
    mk(3, {
      status: 'overdue', passKind: 'returnable', movementType: 'Testing', department: 'Quality',
      responsibleEmployee: 'Priya Raghavan', partyName: 'SGS India Lab',
      purpose: 'Weld coupon lab testing', outwardDate: daysAgoAt(15, 9, 30), expectedReturnDate: daysFromNowDate(-2),
      approverName: 'Quality Head',
      items: [{ id: 'gp3-i1', itemDescription: 'Weld test coupons — batch WLD-118', quantity: 12, uom: 'No', returnedQuantity: 6 }],
      returns: [{ id: 'gp3-r1', returnDate: daysAgoAt(4, 11, 0), itemId: 'gp3-i1', returnedQuantity: 6, conditionReturned: 'Tested — reports received', recordedBy: 'Ramesh Yadav (Security)' }],
    }),
    mk(4, {
      status: 'partially_returned', passKind: 'returnable', movementType: 'Exhibition', department: 'Sales',
      responsibleEmployee: 'Vikram Mehta', partyName: 'Auto Expo — Chennai Trade Centre',
      purpose: 'Marketing display material', outwardDate: daysAgoAt(8, 8, 0), expectedReturnDate: daysFromNowDate(2),
      approverName: 'Director',
      items: [
        { id: 'gp4-i1', itemDescription: 'Display banners & standees', quantity: 6, uom: 'No', returnedQuantity: 6 },
        { id: 'gp4-i2', itemDescription: 'Scale model trailer 1:18', serialNumber: 'MODEL-04', quantity: 2, uom: 'No', returnedQuantity: 0 },
      ],
      returns: [{ id: 'gp4-r1', returnDate: daysAgoAt(1, 17, 30), itemId: 'gp4-i1', returnedQuantity: 6, conditionReturned: 'Good', recordedBy: 'Ramesh Yadav (Security)' }],
    }),
    mk(5, {
      status: 'pending_approval', passKind: 'returnable', movementType: 'Calibration', department: 'Quality',
      responsibleEmployee: 'Priya Raghavan', partyName: 'Precision Calibration Services',
      purpose: 'Annual calibration — measuring instruments', outwardDate: todayAt(15, 0), expectedReturnDate: daysFromNowDate(7),
      approvalStatus: 'pending', approverName: 'Quality Head',
      items: [
        { id: 'gp5-i1', itemDescription: 'Digital vernier calipers', quantity: 8, uom: 'No', returnedQuantity: 0 },
        { id: 'gp5-i2', itemDescription: 'Micrometer set 0-100mm', quantity: 3, uom: 'Set', returnedQuantity: 0 },
      ],
    }),
    mk(6, {
      status: 'returned', passKind: 'returnable', movementType: 'Repair', department: 'Administration',
      responsibleEmployee: 'Lakshmi Narayan', partyName: 'Blue Star Service',
      purpose: 'AC outdoor unit repair', outwardDate: daysAgoAt(12, 10, 0), expectedReturnDate: daysAgoAt(3, 0, 0).slice(0, 10),
      approverName: 'Admin Head',
      items: [{ id: 'gp6-i1', itemDescription: 'Blue Star AC outdoor unit 2TR', serialNumber: 'BS-2TR-1101', quantity: 1, uom: 'No', returnedQuantity: 1 }],
      returns: [{ id: 'gp6-r1', returnDate: daysAgoAt(3, 15, 0), itemId: 'gp6-i1', returnedQuantity: 1, conditionReturned: 'Repaired & working', recordedBy: 'Ramesh Yadav (Security)' }],
    }),
    mk(7, {
      status: 'sent_out', passKind: 'non_returnable', movementType: 'Sample', department: 'Sales',
      responsibleEmployee: 'Vikram Mehta', partyName: 'Daimler India CV',
      purpose: 'Paint finish sample panels for customer approval', outwardDate: daysAgoAt(1, 12, 0), expectedReturnDate: null,
      approverName: 'Sales Head',
      items: [{ id: 'gp7-i1', itemDescription: 'Painted sample panels RAL5010', quantity: 3, uom: 'No', returnedQuantity: 0 }],
    }),
  ]
}

// ─── Contractors ─────────────────────────────────────────────────────────────

export function seedContractors(): ContractorEntry[] {
  const mk = (
    i: number,
    v: Partial<ContractorEntry> &
      Pick<ContractorEntry, 'status' | 'workerName' | 'mobile' | 'contractorCompany' | 'department' | 'supervisor' | 'workLocation' | 'validFrom' | 'validUntil' | 'purpose'>,
  ): ContractorEntry => ({
    id: `con-${i}`,
    entryNumber: `CON-${today.replace(/-/g, '')}-${String(i).padStart(3, '0')}`,
    safetyInductionDone: true,
    ppeIssued: true,
    gate: 'Main Gate',
    ...audit(v.entryTime ?? todayAt(8, 0)),
    ...v,
  } as ContractorEntry)

  return [
    mk(1, { status: 'inside', workerName: 'Murugan S', mobile: '9994412345', contractorCompany: 'Sri Amman Electricals', workReference: 'WO-ELEC-2026-08', department: 'Maintenance', supervisor: 'Karthik Subramani', workLocation: 'Paint shop MCC panel', validFrom: daysFromNowDate(-10), validUntil: daysFromNowDate(20), purpose: 'Panel rewiring work', entryTime: todayAt(8, 10), toolsCarried: 'Crimping tools, multimeter, cable rolls' }),
    mk(2, { status: 'inside', workerName: 'Abdul Rahim', mobile: '9840556677', contractorCompany: 'Chennai Scaffolding Works', department: 'Production', supervisor: 'Ganesh Kumar', workLocation: 'Chassis bay crane runway', validFrom: daysFromNowDate(-2), validUntil: daysFromNowDate(0), purpose: 'Scaffolding erection for crane maintenance', entryTime: todayAt(8, 25), toolsCarried: 'Scaffolding clamps, spanners' }),
    mk(3, { status: 'inside', workerName: 'Suman Biswas', mobile: '9007889900', contractorCompany: 'Facility Care Services', department: 'Administration', supervisor: 'Lakshmi Narayan', workLocation: 'Canteen & office block', validFrom: daysFromNowDate(-30), validUntil: daysFromNowDate(60), purpose: 'Housekeeping contract staff', entryTime: todayAt(7, 45), safetyInductionDone: true, ppeIssued: false }),
    mk(4, { status: 'exited', workerName: 'Ilango V', mobile: '9884990022', contractorCompany: 'Sri Amman Electricals', department: 'Maintenance', supervisor: 'Karthik Subramani', workLocation: 'Compressor room', validFrom: daysFromNowDate(-10), validUntil: daysFromNowDate(-1), purpose: 'Compressor motor overhaul', entryTime: daysAgoAt(1, 8, 30), exitTime: daysAgoAt(1, 17, 45) }),
    mk(5, { status: 'inside', workerName: 'Ram Bahadur', mobile: '9633221100', contractorCompany: 'Everest Civil Works', department: 'Administration', supervisor: 'Lakshmi Narayan', workLocation: 'Boundary wall — east side', validFrom: daysFromNowDate(-5), validUntil: daysFromNowDate(10), purpose: 'Boundary wall repair', entryTime: todayAt(9, 0), safetyInductionDone: false, ppeIssued: true }),
  ]
}

// ─── Couriers ────────────────────────────────────────────────────────────────

export function seedCouriers(): CourierEntry[] {
  const mk = (
    i: number,
    v: Partial<CourierEntry> & Pick<CourierEntry, 'status' | 'direction' | 'courierCompany'>,
  ): CourierEntry => ({
    id: `cour-${i}`,
    entryNumber: `COUR-${today.replace(/-/g, '')}-${String(i).padStart(3, '0')}`,
    gate: 'Main Gate',
    ...audit(v.receivedTime ?? v.dispatchTime ?? todayAt(9, 0)),
    ...v,
  } as CourierEntry)

  return [
    mk(1, { status: 'pending_handover', direction: 'incoming', courierCompany: 'Blue Dart', trackingNumber: 'BD44521098', senderName: 'WABCO India', recipientEmployee: 'Priya Raghavan', department: 'Quality', parcelType: 'Document + sample', receivedTime: todayAt(10, 15), receivedBy: 'Ramesh Yadav (Security)' }),
    mk(2, { status: 'pending_handover', direction: 'incoming', courierCompany: 'DTDC', trackingNumber: 'D77812345', senderName: 'ICICI Bank', recipientEmployee: 'Ravi Shankar', department: 'Finance', parcelType: 'Documents', receivedTime: todayAt(11, 40), receivedBy: 'Ramesh Yadav (Security)' }),
    mk(3, { status: 'handed_over', direction: 'incoming', courierCompany: 'Delhivery', trackingNumber: 'DL99001122', senderName: 'BPW Trailer Axles', recipientEmployee: 'Anita Desai', department: 'Purchase', parcelType: 'Catalogue + drawings', receivedTime: daysAgoAt(0, 9, 20), receivedBy: 'Ramesh Yadav (Security)', handoverTime: todayAt(10, 0), handedOverTo: 'Anita Desai' }),
    mk(4, { status: 'dispatched', direction: 'outgoing', courierCompany: 'Blue Dart', trackingNumber: 'BD44529977', senderName: 'Priya Raghavan', department: 'Quality', parcelDescription: 'Weld test reports to SGS Lab', dispatchTime: daysAgoAt(0, 12, 30), charges: 240, recipientEmployee: undefined }),
    mk(5, { status: 'dispatched', direction: 'outgoing', courierCompany: 'Professional Couriers', trackingNumber: 'PC11223344', senderName: 'Ravi Shankar', department: 'Finance', parcelDescription: 'Signed agreements to HO Mumbai', dispatchTime: daysAgoAt(1, 16, 0), charges: 180 }),
    mk(6, { status: 'handed_over', direction: 'incoming', courierCompany: 'FedEx', trackingNumber: 'FX55667788', senderName: 'Jost Werke Germany', recipientEmployee: 'Mohammed Ismail', department: 'Purchase', parcelType: 'Import documents', receivedTime: daysAgoAt(1, 11, 10), receivedBy: 'Night Shift Security', handoverTime: daysAgoAt(1, 14, 0), handedOverTo: 'Mohammed Ismail' }),
  ]
}

// ─── Approvals ───────────────────────────────────────────────────────────────

export function seedGateApprovals(): GateApproval[] {
  const mk = (i: number, v: Omit<GateApproval, 'id' | 'tenantId' | 'requestNumber'>): GateApproval => ({
    id: `apr-${i}`,
    tenantId: TENANT,
    requestNumber: `GAR-${today.replace(/-/g, '')}-${String(i).padStart(3, '0')}`,
    ...v,
  })

  return [
    mk(1, { requestType: 'walk_in_visitor', requestedBy: 'Gate Operator (Main Gate)', subject: 'Prakash Jain — Mahindra Logistics', reason: 'Walk-in consultant, host approval required', requestedAt: minutesAgo(18), priority: 'normal', status: 'pending', sourceType: 'visitor', sourceId: 'vis-wait-1' }),
    mk(2, { requestType: 'inward_without_po', requestedBy: 'Gate Operator (Material Gate)', subject: 'Chennai Hardware Mart — maintenance spares', reason: 'Emergency maintenance purchase without PO', requestedAt: minutesAgo(25), priority: 'high', status: 'pending', sourceType: 'material_inward', sourceId: 'min-6' }),
    mk(3, { requestType: 'scrap_outward', requestedBy: 'Ganesh Kumar (Dispatch)', subject: 'SCR-2026-0009 — MS scrap ~3.8 MT', reason: 'Monthly scrap disposal to authorised trader', requestedAt: todayAt(10, 30), priority: 'normal', status: 'pending', sourceType: 'material_outward', sourceId: 'mout-3' }),
    mk(4, { requestType: 'returnable_gate_pass', requestedBy: 'Priya Raghavan (Quality)', subject: 'GP-2026-00045 — instruments for calibration', reason: 'Annual calibration of measuring instruments', requestedAt: todayAt(9, 45), priority: 'normal', status: 'pending', sourceType: 'gate_pass', sourceId: 'gp-5' }),
    mk(5, { requestType: 'asset_movement', requestedBy: 'Karthik Subramani (Maintenance)', subject: 'AMN-2026-0004 — welding rectifiers to Plant 2', reason: 'Capacity balancing between plants', requestedAt: todayAt(10, 50), priority: 'high', status: 'pending', sourceType: 'material_outward', sourceId: 'mout-6' }),
    mk(6, { requestType: 'contractor_after_hours', requestedBy: 'Lakshmi Narayan (Admin)', subject: 'Everest Civil Works — night concreting', reason: 'Boundary wall concreting must finish in one pour', requestedAt: todayAt(11, 15), priority: 'urgent', status: 'pending', sourceType: 'contractor', sourceId: 'con-5' }),
    mk(7, { requestType: 'blacklist_override', requestedBy: 'Ganesh Kumar (Dispatch)', subject: 'Ravi Verma — Scrap Traders', reason: 'Requests one-time entry for pending payment settlement', requestedAt: todayAt(8, 40), priority: 'low', status: 'pending', sourceType: 'visitor', sourceId: 'vis-rej-1' }),
  ]
}

// ─── Activities ──────────────────────────────────────────────────────────────

export function seedGateActivities(): GateActivity[] {
  const rows: Array<[number, GateActivity['event'], GateActivity['recordType'], string, string | undefined, string]> = [
    [5, 'visitor_arrived', 'visitor', 'Farhan Sheikh', 'JSW Steel Ltd', 'arrived'],
    [12, 'courier_received', 'courier', 'DTDC D77812345', 'ICICI Bank', 'pending_handover'],
    [18, 'visitor_approved', 'visitor', 'Prakash Jain — approval requested', 'Mahindra Logistics', 'waiting_approval'],
    [25, 'material_inward_registered', 'material_inward', 'MIN — maintenance spares (no PO)', 'Chennai Hardware Mart', 'vehicle_arrived'],
    [32, 'vehicle_arrived', 'vehicle', 'TN 45 LM 2233', 'Apollo Tyres', 'arrived'],
    [45, 'visitor_entered', 'visitor', 'Inspector Manoharan', 'TN Pollution Control Board', 'inside'],
    [58, 'visitor_entered', 'visitor', 'Rajesh Gupta', 'Jost India', 'inside'],
    [70, 'material_inward_registered', 'material_inward', 'JW-2026-0071 — laser cut parts', 'Precision Lasers', 'waiting_qc'],
    [85, 'vehicle_arrived', 'vehicle', 'TN 09 GH 1290', 'Precision Lasers', 'unloading'],
    [95, 'visitor_entered', 'visitor', 'Kavitha Srinivasan (interview)', undefined, 'inside'],
    [110, 'vehicle_arrived', 'vehicle', 'KA 01 EF 6543', 'Axalta Coating', 'waiting'],
    [125, 'visitor_entered', 'visitor', 'Arjun Reddy', 'Sundaram Fasteners', 'inside'],
    [140, 'courier_handed_over', 'courier', 'Delhivery DL99001122', 'BPW Trailer Axles', 'handed_over'],
    [155, 'visitor_entered', 'visitor', 'Meena Iyer', 'TUV SUD', 'inside'],
    [170, 'vehicle_arrived', 'vehicle', 'TN 22 CD 9087', 'Sundaram Fasteners', 'allowed_inside'],
    [190, 'material_inward_registered', 'material_inward', 'PO-2026-0412 — steel plates', 'Tata Steel BSL', 'waiting_unloading'],
    [210, 'vehicle_arrived', 'vehicle', 'TN 39 BX 4521', 'Tata Steel BSL', 'unloading'],
    [240, 'visitor_entered', 'visitor', 'Suresh Krishnan', 'Ashok Leyland', 'inside'],
    [300, 'outward_released', 'material_outward', 'PO-2026-0449 MIG wire vehicle exit', 'Ador Welding', 'released'],
    [330, 'gate_pass_returned', 'gate_pass', 'GP-2026-00046 — AC unit returned', 'Blue Star Service', 'returned'],
  ]
  return rows.map(([mins, event, recordType, label, company, status], i) => ({
    id: `act-${i + 1}`,
    time: minutesAgo(mins),
    event,
    recordType,
    recordId: '',
    recordLabel: label,
    company,
    gate: recordType === 'material_inward' || recordType === 'material_outward' ? 'Material Gate' : 'Main Gate',
    operator: 'Ramesh Yadav (Security)',
    status,
  }))
}
