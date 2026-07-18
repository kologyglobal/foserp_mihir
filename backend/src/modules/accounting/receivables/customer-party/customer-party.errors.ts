import { AppError, NotFoundError } from '../../../../utils/errors.js'

export class CustomerPartyNotFoundError extends NotFoundError {
  constructor(customerId?: string) {
    super(customerId ? `Customer party not found: ${customerId}` : 'Customer party not found')
  }
}

export class InactiveCustomerPartyError extends AppError {
  constructor(customerId?: string) {
    super(
      422,
      customerId ? `Customer party is inactive: ${customerId}` : 'Customer party is inactive',
      'INACTIVE_CUSTOMER_PARTY',
    )
  }
}
