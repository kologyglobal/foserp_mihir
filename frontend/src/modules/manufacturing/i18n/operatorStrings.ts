/**
 * Operator / shop-floor strings — keys only (English default).
 * Swap implementation later for Hindi/Gujarati locale packs.
 */

const STRINGS = {
  'myWork.title': 'My Work',
  'myWork.empty': 'No assignments for you right now.',
  'myWork.apiRequired': 'My Work requires API mode. Set VITE_USE_API=true and sign in.',
  'myWork.refresh': 'Refresh',

  'task.workOrder': 'Work Order',
  'task.product': 'Item',
  'task.stage': 'Stage',
  'task.operation': 'Operation',
  'task.target': 'Target',
  'task.completed': 'Completed',
  'task.balance': 'Balance',
  'task.machine': 'Machine',
  'task.workInstructions': 'Work Instructions',
  'task.noInstructions': 'No special instructions.',

  'action.start': 'Start',
  'action.pause': 'Pause',
  'action.resume': 'Resume',
  'action.complete': 'Complete',
  'action.reportProblem': 'Report Problem',
  'action.accept': 'Accept',

  'completion.title': 'Record Completion',
  'completion.good': 'Good',
  'completion.rework': 'Rework',
  'completion.rejected': 'Rejected',
  'completion.scrap': 'Scrap',
  'completion.remarks': 'Remarks (optional)',
  'completion.submit': 'Submit Completion',
  'completion.cancel': 'Cancel',

  'issue.quickTitle': 'Report Problem',
  'issue.type': 'Issue Type',
  'issue.severity': 'Severity',
  'issue.title': 'Title',
  'issue.description': 'Description',
  'issue.blockProduction': 'Block production',
  'issue.submit': 'Report Issue',

  'dailyUpdate.title': 'Daily Production Update',
  'dailyUpdate.apiRequired': 'Daily Production Update requires API mode.',
  'dailyUpdate.createBatch': 'New Batch',
  'dailyUpdate.submit': 'Submit Batch',
  'dailyUpdate.validate': 'Validate',
  'dailyUpdate.addLine': 'Add Line',

  'issues.title': 'Production Issues',
  'issues.empty': 'No open issues in the queue.',
  'issues.acknowledge': 'Acknowledge',
  'issues.inProgress': 'Mark In Progress',
  'issues.resolve': 'Resolve',
  'issues.cancel': 'Cancel',

  'assignment.assignWork': 'Assign Work',
  'assignment.history': 'Assignment History',
  'assignment.noAssignments': 'No assignments yet for this work order.',
} as const

export type OperatorStringKey = keyof typeof STRINGS

/** Translate operator UI key to display string (English default). */
export function t(key: OperatorStringKey): string {
  return STRINGS[key]
}
