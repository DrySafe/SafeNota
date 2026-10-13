import type { Row } from "../types";
export const money = (value: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
export const cents = (value: unknown) => Math.round(Number(value || 0) * 100);
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
export const dateLabel = (value: unknown) =>
  value
    ? String(value).slice(0, 10).split("-").reverse().join("/")
    : "Sem previsão";
export function dueAfter(date: string, days = 20) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function balance(receivable: Row, allocations: Row[], payments: Row[]) {
  const active = new Set(
    payments.filter((p) => p.status !== "reversed").map((p) => p.id),
  );
  return (
    (cents(receivable.amount) -
      allocations
        .filter(
          (a) =>
            a.receivable_id === receivable.id &&
            active.has(String(a.payment_id)),
        )
        .reduce((s, a) => s + cents(a.amount), 0)) /
    100
  );
}
export function paymentState(
  receivable: Row,
  remaining: number,
  now = today(),
) {
  if (cents(remaining) <= 0) return "Pago";
  if (receivable.due_date && String(receivable.due_date) < now)
    return "Vencido";
  return cents(remaining) < cents(receivable.amount) ? "Parcial" : "Pendente";
}
export function validateAllocation(
  amount: number,
  allocations: { amount: number; balance: number }[],
) {
  if (!Number.isFinite(amount) || cents(amount) <= 0)
    throw new Error("Informe um valor recebido maior que zero.");
  for (const a of allocations)
    if (
      !Number.isFinite(a.amount) ||
      cents(a.amount) < 0 ||
      cents(a.amount) > cents(a.balance)
    )
      throw new Error("A distribuição supera o saldo de uma cobrança.");
  if (allocations.reduce((s, a) => s + cents(a.amount), 0) > cents(amount))
    throw new Error("A distribuição supera o valor recebido.");
}
export function installmentDue(competence: string, day: number) {
  const [y, m] = competence.split("-").map(Number);
  return `${competence}-${String(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
}
