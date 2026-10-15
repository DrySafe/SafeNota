import type { Data, Row } from "../../types";
import { balance, cents, today } from "../../lib/finance";
export function requestFinancialState(request: Row, data: Data, now = today()) {
  const notes = data.invoices.filter(
    (i) =>
      i.panel_id === request.panel_id &&
      i.request_id === request.id &&
      !i.deleted_at &&
      i.status === "Gerada",
  );
  const receivables = data.receivables.filter(
    (r) =>
      r.panel_id === request.panel_id &&
      !r.deleted_at &&
      r.status !== "cancelled" &&
      notes.some((i) => i.id === r.invoice_id),
  );
  const payments = data.payments.filter(
    (p) => p.panel_id === request.panel_id && !p.deleted_at,
  );
  const allocations = data.payment_allocations.filter(
    (a) => a.panel_id === request.panel_id && !a.deleted_at,
  );
  const balances = receivables.map((r) => ({
    row: r,
    remaining: balance(r, allocations, payments),
  }));
  const remaining = balances.reduce((n, r) => n + cents(r.remaining), 0) / 100;
  const state = !receivables.length
    ? "pending"
    : balances.every((r) => cents(r.remaining) <= 0)
      ? "paid"
      : balances.some(
            (r) =>
              cents(r.remaining) > 0 &&
              r.row.due_date &&
              String(r.row.due_date) < now,
          )
        ? "overdue"
        : "pending";
  return { state, remaining, receivables };
}
