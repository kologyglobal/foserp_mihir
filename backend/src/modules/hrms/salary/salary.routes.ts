import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './salary.controller.js'
import {
  assignmentIdParamSchema,
  componentIdParamSchema,
  createAssignmentSchema,
  createComponentSchema,
  createStructureSchema,
  createVersionSchema,
  employeeEffectiveQuerySchema,
  employeeIdParamSchema,
  listAssignmentsQuerySchema,
  listComponentsQuerySchema,
  listStructuresQuerySchema,
  previewSalarySchema,
  reviseAssignmentSchema,
  structureIdParamSchema,
  updateComponentSchema,
  updateStructureSchema,
  updateVersionSchema,
  versionIdParamSchema,
} from './salary.schemas.js'

const router = Router({ mergeParams: true })

// Components
router.get(
  '/components',
  requirePermission('hrms.salary.component.view'),
  validateQuery(listComponentsQuerySchema),
  controller.listComponents,
)
router.post(
  '/components',
  requirePermission('hrms.salary.component.manage'),
  validateBody(createComponentSchema),
  controller.createComponent,
)
router.get(
  '/components/:componentId',
  validateParams(componentIdParamSchema),
  requirePermission('hrms.salary.component.view'),
  controller.getComponent,
)
router.patch(
  '/components/:componentId',
  validateParams(componentIdParamSchema),
  requirePermission('hrms.salary.component.manage'),
  validateBody(updateComponentSchema),
  controller.updateComponent,
)

// Structures
router.get(
  '/structures',
  requirePermission('hrms.salary.structure.view'),
  validateQuery(listStructuresQuerySchema),
  controller.listStructures,
)
router.post(
  '/structures',
  requirePermission('hrms.salary.structure.manage'),
  validateBody(createStructureSchema),
  controller.createStructure,
)
router.get(
  '/structures/:structureId',
  validateParams(structureIdParamSchema),
  requirePermission('hrms.salary.structure.view'),
  controller.getStructure,
)
router.patch(
  '/structures/:structureId',
  validateParams(structureIdParamSchema),
  requirePermission('hrms.salary.structure.manage'),
  validateBody(updateStructureSchema),
  controller.updateStructure,
)

// Versions (nested create under structure; detail/activate by versionId)
router.post(
  '/structures/:structureId/versions',
  validateParams(structureIdParamSchema),
  requirePermission('hrms.salary.structure.manage'),
  validateBody(createVersionSchema),
  controller.createVersion,
)
router.get(
  '/versions/:versionId',
  validateParams(versionIdParamSchema),
  requirePermission('hrms.salary.structure.view'),
  controller.getVersion,
)
router.patch(
  '/versions/:versionId',
  validateParams(versionIdParamSchema),
  requirePermission('hrms.salary.structure.manage'),
  validateBody(updateVersionSchema),
  controller.updateVersion,
)
router.post(
  '/versions/:versionId/activate',
  validateParams(versionIdParamSchema),
  requirePermission('hrms.salary.structure.manage'),
  controller.activateVersion,
)

// Assignments
router.get(
  '/assignments',
  requirePermission('hrms.salary.assignment.view'),
  validateQuery(listAssignmentsQuerySchema),
  controller.listAssignments,
)
router.post(
  '/assignments',
  requirePermission('hrms.salary.assignment.manage'),
  validateBody(createAssignmentSchema),
  controller.createAssignment,
)
router.post(
  '/assignments/:assignmentId/revise',
  validateParams(assignmentIdParamSchema),
  requirePermission('hrms.salary.assignment.manage'),
  validateBody(reviseAssignmentSchema),
  controller.reviseAssignment,
)

// Effective & preview
router.get(
  '/employees/:employeeId/effective',
  validateParams(employeeIdParamSchema),
  validateQuery(employeeEffectiveQuerySchema),
  requirePermission('hrms.salary.assignment.view'),
  controller.getEmployeeEffective,
)
router.post(
  '/preview',
  requirePermission('hrms.salary.structure.view'),
  validateBody(previewSalarySchema),
  controller.previewSalary,
)

export default router
