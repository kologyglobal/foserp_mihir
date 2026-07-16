import type {
  BatchQualityStatus,
  InventorySerialStatus,
  ItemLedgerTransactionType,
  ReservationSource,
  ReservationStatus,
} from '../types/inventoryDomain'

export const BATCH_STATUS_LABELS: Record<BatchQualityStatus, string> = {
  available: 'Available',
  quality_hold: 'Quality Hold',
  quarantine: 'Quarantine',
  blocked: 'Blocked',
  expired: 'Expired',
  rejected: 'Rejected',
  consumed: 'Consumed',
  closed: 'Closed',
}

export const SERIAL_STATUS_LABELS: Record<InventorySerialStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  issued: 'Issued',
  in_production: 'In Production',
  sold: 'Sold',
  under_repair: 'Under Repair',
  returned: 'Returned',
  scrapped: 'Scrapped',
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  reserved: 'Reserved',
  partially_reserved: 'Partially Reserved',
  released: 'Released',
  consumed: 'Consumed',
  cancelled: 'Cancelled',
}

export const RESERVATION_SOURCE_LABELS: Record<ReservationSource, string> = {
  SO: 'Sales Order',
  PO: 'Purchase Order',
  TRANSFER: 'Transfer',
  MAINTENANCE: 'Maintenance',
  PROJECT: 'Project',
}

export const LEDGER_TXN_TYPE_LABELS: Record<ItemLedgerTransactionType, string> = {
  opening_balance: 'Opening Balance',
  receipt: 'Receipt',
  issue: 'Issue',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment_in: 'Adjustment In',
  adjustment_out: 'Adjustment Out',
  return_in: 'Return In',
  return_out: 'Return Out',
  production_consume: 'Production Consume',
  production_output: 'Production Output',
  reservation: 'Reservation',
  reservation_release: 'Reservation Release',
}
