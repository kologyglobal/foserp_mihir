import type { ReportExecutor } from '../types.js'
import { executeCollectionDueToday } from './collection-due-today.js'
import { executeDispatchPerformance } from './dispatch-performance.js'
import { executeDispatchReadiness } from './dispatch-readiness.js'
import { executeInvoiceReadiness } from './invoice-readiness.js'
import { executeIssuesDowntime } from './issues-downtime.js'
import { executeJobWorkAgeing } from './job-work-ageing.js'
import { executeJobWorkReconciliation } from './job-work-reconciliation.js'
import { executeMaterialReadiness } from './material-readiness.js'
import { executeMaterialReconciliation } from './material-reconciliation.js'
import { executeNcrRegister } from './ncr-register.js'
import { executeOee } from './oee.js'
import { executePlanVsActual } from './plan-vs-actual.js'
import { executeProductionControl } from './production-control.js'
import { executeProductionQuality } from './production-quality.js'
import { executeQualityDashboard } from './quality-dashboard.js'
import { executeQualityInspections } from './quality-inspections.js'
import { executeReworkRejection } from './rework-rejection.js'
import { executeRevenueBridge } from './revenue-bridge.js'
import { executeSalesOrderFulfilment } from './sales-order-fulfilment.js'
import { executeShiftDashboard } from './shift-dashboard.js'
import { executeShopfloorLive } from './shopfloor-live.js'
import { executeStagePerformance } from './stage-performance.js'
import { executeWipAgeing } from './wip-ageing.js'
import { executeWipPosition } from './wip-position.js'
import { executeWorkCentrePerformance } from './work-centre-performance.js'
import { executeWorkOrderProgress } from './work-order-progress.js'

/** Report keys with availability UNAVAILABLE (delivery-challans, supplier-quality) have no executor here — query.service short-circuits before reaching this map. */
export const REPORT_EXECUTORS: Record<string, ReportExecutor> = {
  'production-control': executeProductionControl,
  'shopfloor-live': executeShopfloorLive,
  'shift-dashboard': executeShiftDashboard,
  'work-order-progress': executeWorkOrderProgress,
  'plan-vs-actual': executePlanVsActual,
  'stage-performance': executeStagePerformance,
  'work-centre-performance': executeWorkCentrePerformance,
  'work-centre-oee': executeOee,
  'issues-downtime': executeIssuesDowntime,
  'material-readiness': executeMaterialReadiness,
  'material-reconciliation': executeMaterialReconciliation,
  'wip-position': executeWipPosition,
  'wip-ageing': executeWipAgeing,
  'job-work-ageing': executeJobWorkAgeing,
  'job-work-reconciliation': executeJobWorkReconciliation,
  'quality-dashboard': executeQualityDashboard,
  'quality-inspections': executeQualityInspections,
  'production-quality': executeProductionQuality,
  'ncr-register': executeNcrRegister,
  'rework-rejection': executeReworkRejection,
  'dispatch-readiness': executeDispatchReadiness,
  'sales-order-fulfilment': executeSalesOrderFulfilment,
  'dispatch-performance': executeDispatchPerformance,
  'invoice-readiness': executeInvoiceReadiness,
  'revenue-bridge': executeRevenueBridge,
  'collection-due-today': executeCollectionDueToday,
}
