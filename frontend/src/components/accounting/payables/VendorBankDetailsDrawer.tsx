import { AlertTriangle } from 'lucide-react'
import { PayableDrawerShell } from './PayableDrawerShell'
import { BankVerificationStatusBadge, type BankVerificationStatus } from './PayableStatusBadge'
import { formatDate } from '@/utils/dates/format'

export interface VendorBankDetails {
  vendorId: string
  vendorName: string
  accountName: string
  bankName: string
  accountNumberMasked: string
  ifscCode: string
  branch: string
  verificationStatus: BankVerificationStatus
  verifiedAt: string | null
  verifiedBy: string | null
  lastChangedAt: string | null
  lastChangedBy: string | null
}

export function VendorBankDetailsDrawer({
  open,
  onClose,
  details,
}: {
  open: boolean
  onClose: () => void
  details: VendorBankDetails | null
}) {
  const recentlyChanged = details?.verificationStatus === 'Changed Recently'

  return (
    <PayableDrawerShell
      open={open}
      onClose={onClose}
      title="Vendor bank details"
      subtitle={details?.vendorName}
      eyebrow="Payables · Vendor master"
      widthClassName="max-w-md"
    >
      {!details ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">No bank details available.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BankVerificationStatusBadge status={details.verificationStatus} />
            {details.verifiedAt ? (
              <span className="text-[11px] text-erp-muted">
                Verified {formatDate(details.verifiedAt)}
                {details.verifiedBy ? ` · ${details.verifiedBy}` : ''}
              </span>
            ) : null}
          </div>

          {recentlyChanged ? (
            <div className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Bank details were changed recently
                {details.lastChangedAt ? ` on ${formatDate(details.lastChangedAt)}` : ''}
                {details.lastChangedBy ? ` by ${details.lastChangedBy}` : ''}. Verify before processing payments.
              </p>
            </div>
          ) : null}

          <dl className="grid gap-3 text-[13px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Account name</dt>
              <dd className="mt-0.5 text-erp-text">{details.accountName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Bank</dt>
              <dd className="mt-0.5 text-erp-text">{details.bankName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Account number</dt>
              <dd className="mt-0.5 font-mono text-erp-text">{details.accountNumberMasked}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">IFSC</dt>
              <dd className="mt-0.5 font-mono text-erp-text">{details.ifscCode}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Branch</dt>
              <dd className="mt-0.5 text-erp-text">{details.branch}</dd>
            </div>
          </dl>

          <p className="text-[11px] text-erp-muted">
            Masked for security — full account number is not shown in the UI. Demo mode only.
          </p>
        </div>
      )}
    </PayableDrawerShell>
  )
}
