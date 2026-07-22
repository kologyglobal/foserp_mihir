/**
 * Receivables data-access boundary (Phase 8C Wave 1 — 8B-R-011).
 *
 * Strict gateway for the register / overview read surface of the canonical AR
 * workspace. The factory selects exactly one implementation by mode:
 *   - `VITE_USE_API=true`  → {@link ApiReceivablesGateway} (live APIs only, no demo fallback)
 *   - `VITE_USE_API=false` → {@link DemoReceivablesGateway} (seed store)
 *
 * API mode never instantiates the demo gateway. On API failure the API gateway
 * surfaces a controlled, mapped error — it must not silently return seed data.
 *
 * Document CRUD (invoice/receipt/credit-note create/edit/post/allocate) continues
 * to flow through `receivablesApiBridge` until pages are consolidated in later waves;
 * this gateway wraps the read/register/overview surfaces that Wave 2 consumes.
 */
import type {
  AgeingReportDto,
  CustomerReceivableDetailDto,
  ListSalesInvoicesQuery,
  OutstandingOpenItemDto,
  PaginatedResult,
  ReceivableOverviewDto,
  ReceivableReconciliationDto,
  SalesInvoiceDto,
} from '../../types/moneyIn'
import { isApiMode } from '../../config/apiConfig'
import * as api from '../api/receivablesApi'
import { formatApiError } from '../api/apiErrors'
import { ensureLegalEntityId, resolveLegalEntityId } from '../bridges/financeApiBridge'
import { mapMoneyInError } from '../../modules/accounting/money-in/moneyInUi'
import { getReceivablesDemoState, seedReceivablesDemoIfEmpty } from '../../store/receivablesDemoStore'

export type ReceivablesQuery = Record<string, string | number | boolean | undefined>

export interface ReceivablesGateway {
  getOverview(legalEntityId?: string): Promise<ReceivableOverviewDto>
  listInvoices(filters?: Partial<ListSalesInvoicesQuery>): Promise<SalesInvoiceDto[]>
  listOutstanding(params?: ReceivablesQuery): Promise<PaginatedResult<OutstandingOpenItemDto>>
  getAgeing(params?: ReceivablesQuery): Promise<AgeingReportDto>
  listCustomers(params?: ReceivablesQuery): Promise<PaginatedResult<CustomerReceivableDetailDto>>
  getCustomer(customerId: string, legalEntityId?: string): Promise<CustomerReceivableDetailDto>
  listCustomerOpenItems(
    customerId: string,
    params?: ReceivablesQuery,
  ): Promise<PaginatedResult<OutstandingOpenItemDto>>
  getReconciliation(legalEntityId?: string): Promise<ReceivableReconciliationDto>
}

function unwrap<T>(res: { data: T }): T {
  return res.data
}

function rethrowMapped(err: unknown): never {
  const msg = formatApiError(err)
  const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code) : undefined
  throw new Error(mapMoneyInError(code, msg))
}

/** Live implementation — talks to `/accounting/receivables/*`; never falls back to seed data. */
export class ApiReceivablesGateway implements ReceivablesGateway {
  async getOverview(legalEntityId?: string): Promise<ReceivableOverviewDto> {
    try {
      const leId = await ensureLegalEntityId(legalEntityId)
      return unwrap(await api.getReceivableOverview({ legalEntityId: leId }))
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async listInvoices(filters?: Partial<ListSalesInvoicesQuery>): Promise<SalesInvoiceDto[]> {
    try {
      const leId = await ensureLegalEntityId(filters?.legalEntityId)
      return unwrap(
        await api.listSalesInvoices({
          legalEntityId: leId,
          ...filters,
        } as ListSalesInvoicesQuery),
      )
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async listOutstanding(params?: ReceivablesQuery): Promise<PaginatedResult<OutstandingOpenItemDto>> {
    try {
      const leId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
      return unwrap(
        await api.listOutstanding({
          legalEntityId: leId,
          ...params,
        }),
      )
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async getAgeing(params?: ReceivablesQuery): Promise<AgeingReportDto> {
    try {
      const leId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
      return unwrap(
        await api.getAgeingReport({
          legalEntityId: leId,
          ...params,
        }),
      )
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async listCustomers(params?: ReceivablesQuery): Promise<PaginatedResult<CustomerReceivableDetailDto>> {
    try {
      const leId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
      return unwrap(
        await api.listCustomerSummaries({
          legalEntityId: leId,
          ...params,
        }),
      )
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async getCustomer(customerId: string, legalEntityId?: string): Promise<CustomerReceivableDetailDto> {
    try {
      const leId = await ensureLegalEntityId(legalEntityId)
      return unwrap(await api.getCustomerSummary(customerId, { legalEntityId: leId }))
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async listCustomerOpenItems(
    customerId: string,
    params?: ReceivablesQuery,
  ): Promise<PaginatedResult<OutstandingOpenItemDto>> {
    try {
      const leId = await ensureLegalEntityId(params?.legalEntityId as string | undefined)
      return unwrap(
        await api.listCustomerOpenItems(customerId, {
          legalEntityId: leId,
          ...params,
        }),
      )
    } catch (e) {
      rethrowMapped(e)
    }
  }

  async getReconciliation(legalEntityId?: string): Promise<ReceivableReconciliationDto> {
    try {
      const leId = await ensureLegalEntityId(legalEntityId)
      return unwrap(await api.getReconciliation({ legalEntityId: leId }))
    } catch (e) {
      rethrowMapped(e)
    }
  }
}

/** Demo implementation — seed-backed store; only constructed when `VITE_USE_API=false`. */
export class DemoReceivablesGateway implements ReceivablesGateway {
  async getOverview(legalEntityId?: string): Promise<ReceivableOverviewDto> {
    const leId = resolveLegalEntityId(legalEntityId)
    seedReceivablesDemoIfEmpty(leId)
    return getReceivablesDemoState().getOverview(leId)
  }

  async listInvoices(filters?: Partial<ListSalesInvoicesQuery>): Promise<SalesInvoiceDto[]> {
    const legalEntityId = resolveLegalEntityId(filters?.legalEntityId)
    seedReceivablesDemoIfEmpty(legalEntityId)
    return getReceivablesDemoState().listInvoices({ legalEntityId, ...filters } as ListSalesInvoicesQuery)
  }

  async listOutstanding(params?: ReceivablesQuery): Promise<PaginatedResult<OutstandingOpenItemDto>> {
    const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
    seedReceivablesDemoIfEmpty(legalEntityId)
    return getReceivablesDemoState().listOutstanding({ legalEntityId, ...params })
  }

  async getAgeing(params?: ReceivablesQuery): Promise<AgeingReportDto> {
    const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
    seedReceivablesDemoIfEmpty(legalEntityId)
    return getReceivablesDemoState().getAgeing({ legalEntityId, ...params })
  }

  async listCustomers(params?: ReceivablesQuery): Promise<PaginatedResult<CustomerReceivableDetailDto>> {
    const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
    seedReceivablesDemoIfEmpty(legalEntityId)
    return getReceivablesDemoState().listCustomers({ legalEntityId, ...params })
  }

  async getCustomer(customerId: string, legalEntityId?: string): Promise<CustomerReceivableDetailDto> {
    const leId = resolveLegalEntityId(legalEntityId)
    seedReceivablesDemoIfEmpty(leId)
    const row = getReceivablesDemoState().getCustomer(customerId, leId)
    if (!row) throw new Error('Customer not found')
    return row
  }

  async listCustomerOpenItems(
    customerId: string,
    params?: ReceivablesQuery,
  ): Promise<PaginatedResult<OutstandingOpenItemDto>> {
    const legalEntityId = resolveLegalEntityId(params?.legalEntityId as string | undefined)
    seedReceivablesDemoIfEmpty(legalEntityId)
    return getReceivablesDemoState().listCustomerOpenItems(customerId, { legalEntityId, ...params })
  }

  async getReconciliation(legalEntityId?: string): Promise<ReceivableReconciliationDto> {
    const leId = resolveLegalEntityId(legalEntityId)
    seedReceivablesDemoIfEmpty(leId)
    return getReceivablesDemoState().getReconciliation(leId)
  }
}

let apiGatewaySingleton: ApiReceivablesGateway | null = null
let demoGatewaySingleton: DemoReceivablesGateway | null = null

/**
 * Returns the gateway for the current mode. API mode never constructs the demo
 * gateway, guaranteeing no seed data leaks into a live workspace.
 */
export function getReceivablesGateway(): ReceivablesGateway {
  if (isApiMode()) {
    apiGatewaySingleton ??= new ApiReceivablesGateway()
    return apiGatewaySingleton
  }
  demoGatewaySingleton ??= new DemoReceivablesGateway()
  return demoGatewaySingleton
}
