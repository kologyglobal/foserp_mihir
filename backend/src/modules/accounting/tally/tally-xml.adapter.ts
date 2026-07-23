import { createHash } from 'node:crypto'

export type TallyXmlLedgerLine = {
  ledgerName: string
  /** Positive amount in base currency */
  amount: number
  isDebit: boolean
  narration?: string | null
}

export type TallyXmlVoucherInput = {
  companyName: string
  voucherTypeName: string
  voucherNumber: string
  /** YYYYMMDD */
  dateYmd: string
  narration?: string | null
  lines: TallyXmlLedgerLine[]
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount(amount: number, isDebit: boolean): string {
  const abs = Math.abs(amount).toFixed(2)
  // Tally journal convention: debit → negative amount + ISDEEMEDPOSITIVE Yes
  return isDebit ? `-${abs}` : abs
}

/** Build TallyPrime ImportData XML envelope for one accounting voucher (journal). */
export function buildTallyVoucherXml(input: TallyXmlVoucherInput): string {
  const lineXml = input.lines
    .map((line) => {
      const deemed = line.isDebit ? 'Yes' : 'No'
      const narr = line.narration?.trim()
        ? `\n            <NARRATION>${escapeXml(line.narration.trim())}</NARRATION>`
        : ''
      return `          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(line.ledgerName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${deemed}</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatAmount(line.amount, line.isDebit)}</AMOUNT>${narr}
          </ALLLEDGERENTRIES.LIST>`
    })
    .join('\n')

  const narr = input.narration?.trim()
    ? `\n            <NARRATION>${escapeXml(input.narration.trim())}</NARRATION>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(input.companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(input.voucherTypeName)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${input.dateYmd}</DATE>
            <VOUCHERTYPENAME>${escapeXml(input.voucherTypeName)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(input.voucherNumber)}</VOUCHERNUMBER>${narr}
${lineXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`
}

export function hashXml(xml: string): string {
  return createHash('sha256').update(xml, 'utf8').digest('hex').slice(0, 64)
}

export function toTallyDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}
