/** DynamicsStatusChip tone union — kept local so the kit does not import from a non-exported chip type. */
export type DynamicsStatusTone =
  | 'success'
  | 'warning'
  | 'critical'
  | 'info'
  | 'neutral'
  | 'live'
  | 'pending'
