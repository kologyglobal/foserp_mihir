export const ACTIVITY_TYPES = [
  'CALL',
  'EMAIL',
  'MEETING',
  'WHATSAPP',
  'FOLLOW_UP',
  'NOTE',
  'DEMO',
  'TASK',
  'SITE_VISIT',
  'STAGE_CHANGE',
] as const

export const ACTIVITY_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'] as const

export const ACTIVITY_TYPE_TO_FRONTEND: Record<string, string> = {
  CALL: 'call',
  EMAIL: 'email',
  MEETING: 'meeting',
  WHATSAPP: 'whatsapp',
  FOLLOW_UP: 'follow_up_completed',
  NOTE: 'note',
  DEMO: 'demo',
  TASK: 'task',
  SITE_VISIT: 'site_visit',
  STAGE_CHANGE: 'stage_change',
}

export const FRONTEND_TYPE_TO_ACTIVITY: Record<string, string> = {
  call: 'CALL',
  email: 'EMAIL',
  meeting: 'MEETING',
  whatsapp: 'WHATSAPP',
  note: 'NOTE',
  site_visit: 'SITE_VISIT',
  stage_change: 'STAGE_CHANGE',
  follow_up_completed: 'FOLLOW_UP',
  demo: 'DEMO',
  task: 'TASK',
}
