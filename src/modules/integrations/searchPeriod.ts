export function gmailSearchDays(value: unknown): number {
  if (value === undefined) return 30;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 365
  ) {
    throw new Error("Informe um período entre 1 e 365 dias.");
  }
  return value;
}

// Freeze the window once per run so every rule scans the same exact 24 hours.
export function gmailDailyWindow(now = Date.now()) {
  const before = Math.floor(now / 1000);
  return { after: before - 24 * 60 * 60, before };
}
export function gmailSearchQuery(
  sender: string,
  days: number,
  window?: { after: number; before: number },
) {
  return window
    ? `from:${sender} after:${window.after} before:${window.before}`
    : `from:${sender} newer_than:${gmailSearchDays(days)}d`;
}
