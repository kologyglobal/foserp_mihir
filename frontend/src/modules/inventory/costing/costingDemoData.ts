export function methodLabel(method: string): string {
  switch (method) {
    case 'FIFO':
      return 'FIFO'
    case 'MOVING_WEIGHTED_AVERAGE':
      return 'Moving average'
    case 'STANDARD_COST':
      return 'Standard cost'
    case 'SPECIFIC_IDENTIFICATION':
      return 'Specific identification'
    default:
      return method.replace(/_/g, ' ')
  }
}
