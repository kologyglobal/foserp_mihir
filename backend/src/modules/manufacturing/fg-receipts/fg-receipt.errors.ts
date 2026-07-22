import { ValidationError } from '../../../utils/errors.js'

export class FgReceiptValidationError extends ValidationError {
  constructor(message: string) {
    super(message)
    this.name = 'FgReceiptValidationError'
  }
}
