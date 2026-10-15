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
