export type FormActionSingleFlightGate = { locked: boolean }

/** Execute one save at a time; repeated clicks share no side effects. */
export async function runFormActionSingleFlight(
  gate: FormActionSingleFlightGate,
  action: () => void | Promise<unknown>,
): Promise<void> {
  if (gate.locked) return
  gate.locked = true
  try {
    await action()
  } finally {
    gate.locked = false
  }
}
