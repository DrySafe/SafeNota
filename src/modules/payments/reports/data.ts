import type { Data, Row } from "../../../types";
import {
  balance,
  cents,
  dateLabel,
  money,
  paymentState,
} from "../../../lib/finance";
import { receiptOrigin } from "../origin";
export interface ReceiptReport {
  type: "paid" | "pending";
  title: string;
  headers: string[];
  rows: string[][];
  overdueRows: number[];
  summaries: { label: string; value: string }[];
}
export function receiptReport(
  type: "paid" | "pending",
  panelId: string,
  records: Row[],
  data: Data,
): ReceiptReport {
  const current = (rows: Row[]) =>
    rows.filter((r) => r.panel_id === panelId && !r.deleted_at);
  const payments = current(data.payments);
  const allocations = current(data.payment_allocations);
  const client = (id: unknown) =>
    current(data.clients).find((c) => c.id === id)?.name || "Cliente";
  if (type === "pending") {
    const rows = current(records)
      .filter((r) => r.status !== "cancelled")
      .map((r) => ({ row: r, remaining: balance(r, allocations, payments) }))
      .filter((r) => cents(r.remaining) > 0)
      .sort((a, b) =>
        String(a.row.due_date || "9999").localeCompare(
          String(b.row.due_date || "9999"),
        ),
      );
    return {
      type,
      title: "Recebimentos pendentes",
      headers: [
        "Cliente / origem",
        "Chamados",
        "Vencimento",
        "Situação",
        "Valor previsto",
        "Recebido",
        "Saldo a receber",
      ],
      overdueRows: rows.flatMap((r, index) =>
        paymentState(r.row, r.remaining) === "Vencido" ? [index] : [],
      ),
      rows: rows.map(({ row: r, remaining }) => {
        const origin = receiptOrigin(r, data);
        return [
          String(client(r.client_id)) +
            "\n" +
            (origin.label || String(r.title)),
          origin.tickets || "—",
          dateLabel(r.due_date),
          paymentState(r, remaining),
          money(r.amount),
          money((cents(r.amount) - cents(remaining)) / 100),
          money(remaining),
        ];
      }),
      summaries: [
        {
          label: "Saldo a receber",
          value: money(rows.reduce((n, r) => n + cents(r.remaining), 0) / 100),
        },
        { label: "Cobranças", value: String(rows.length) },
        {
          label: "Saldo vencido",
          value: money(
            rows
              .filter((r) => paymentState(r.row, r.remaining) === "Vencido")
              .reduce((n, r) => n + cents(r.remaining), 0) / 100,
          ),
        },
      ],
    };
  }
  const rows = current(records)
    .filter((p) => p.status === "active")
    .sort((a, b) => String(b.paid_date).localeCompare(String(a.paid_date)));
  let unallocated = 0;
  const body = rows.map((p) => {
    const links = allocations.filter((a) => a.payment_id === p.id);
    const references: string[] = [];
    const tickets = new Set<string>();
    for (const link of links) {
      const r = data.receivables.find(
        (r) => r.id === link.receivable_id && r.panel_id === panelId,
      );
      if (!r) {
        references.push(`Cobrança arquivada: ${money(link.amount)}`);
        continue;
      }
      const origin = receiptOrigin(r, data);
      references.push(`${origin.label || r.title}: ${money(link.amount)}`);
      if (origin.tickets) tickets.add(origin.tickets);
    }
    const remaining =
      (cents(p.amount) - links.reduce((n, a) => n + cents(a.amount), 0)) / 100;
    unallocated += cents(remaining);
    if (remaining > 0) references.push(`Sem distribuição: ${money(remaining)}`);
    return [
      dateLabel(p.paid_date),
      String(client(p.client_id)),
      references.join("\n") || "Sem cobrança vinculada",
      [...tickets].join("\n") || "—",
      String(p.method),
      money(p.amount),
    ];
  });
  return {
    type,
    title: "Recebimentos pagos",
    headers: [
      "Data recebida",
      "Cliente",
      "Requisição / nota e distribuição",
      "Chamados",
      "Forma",
      "Valor recebido",
    ],
    rows: body,
    overdueRows: [],
    summaries: [
      {
        label: "Total recebido",
        value: money(rows.reduce((n, p) => n + cents(p.amount), 0) / 100),
      },
      { label: "Pagamentos confirmados", value: String(rows.length) },
      { label: "Sem distribuição", value: money(unallocated / 100) },
    ],
  };
}
