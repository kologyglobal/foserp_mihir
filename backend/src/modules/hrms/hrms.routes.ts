import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireModule } from '../../middleware/require-module.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import designationRoutes from './designations/designation.routes.js'
import employeeRoutes from './employees/employee.routes.js'
import holidayRoutes from './holidays/holiday.routes.js'
import leaveRoutes from './leave/leave.routes.js'
import attendanceRoutes from './attendance/attendance.routes.js'
import overtimeRoutes from './overtime/overtime.routes.js'
import salaryRoutes from './salary/salary.routes.js'
import rosterRoutes from './roster/roster.routes.js'
import shiftRoutes from './shifts/shift.routes.js'
import payrollRoutes from './payroll/payroll.routes.js'
import statutoryRoutes from './statutory/statutory.routes.js'
import loanRoutes from './loans/loan.routes.js'
import exitRoutes from './exit/exit.routes.js'
import fnfRoutes from './exit/fnf.routes.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
  requireModule('hrms'),
)

router.use('/designations', designationRoutes)
router.use('/employees', employeeRoutes)
router.use('/shifts', shiftRoutes)
router.use('/holidays', holidayRoutes)
router.use('/roster', rosterRoutes)
router.use('/leave', leaveRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/overtime', overtimeRoutes)
router.use('/salary', salaryRoutes)
router.use('/payroll', payrollRoutes)
router.use('/statutory', statutoryRoutes)
router.use('/loans', loanRoutes)
router.use('/exits', exitRoutes)
router.use('/fnf', fnfRoutes)

export default router
