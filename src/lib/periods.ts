import type { Row } from "../types";
export function monthKey(value: unknown) {
  const match = String(value || "").match(/^(\d{4})-(0[1-9]|1[0-2])/);
  return match ? `${match[1]}-${match[2]}` : "";
}
export function monthLabel(month: string) {
  return monthKey(month)
    ? new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${month}-15T12:00:00Z`))
    : "Sem data do serviço";
}
export function saleMonth(receivable: Row, invoices: Row[]) {
  const invoice = invoices.find(
    (i) => i.id === receivable.invoice_id && i.panel_id === receivable.panel_id,
  );
  if (invoice) return monthKey(invoice.issue_date);
  if (receivable.competence) return monthKey(receivable.competence);
  const date = new Date(String(receivable.created_at || ""));
  return Number.isNaN(date.getTime())
    ? ""
    : monthKey(
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Sao_Paulo",
        }).format(date),
      );
}
