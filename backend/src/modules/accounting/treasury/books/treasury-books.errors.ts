import { AppError, NotFoundError } from '../../../../utils/errors.js'

export class TreasuryBookAccountTypeMismatchError extends AppError {
  constructor(expected: string) {
    super(400, `Selected treasury account is not a ${expected} account`, 'TREASURY_BOOK_ACCOUNT_TYPE_MISMATCH')
  }
}

export class TreasuryBookAccountNotFoundError extends NotFoundError {
  constructor() {
    super('Treasury account not found')
  }
}
