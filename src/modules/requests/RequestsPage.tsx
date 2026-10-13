import { Link } from "react-router-dom";
import { useStore } from "../../app/Store";
import { balance, cents, today, dueAfter, money } from "../../lib/finance";
import { EntityPage } from "../../components/EntityPage";
export function RequestsPage() {
  const s = useStore();
  const needsInvoice = (values: Record<string, unknown>) =>
    values.status === "Faturado" && !values._has_invoice;
  return (
    <EntityPage
      table="billing_requests"
      title="Requisições de nota"
      subtitle="Organize os chamados, registre a nota gerada e acompanhe seu recebimento."
      extra={
        <div className="notice">
          Ao selecionar “Gerada”, informe a nota já emitida: a cobrança
          aparecerá automaticamente em Recebimentos.{" "}
          <Link to="/notas">Importar XML / conferir documentos</Link>
        </div>
      }
      rowExtra={(request) => {
        const notes = s
          .current("invoices")
          .filter((i) => i.request_id === request.id);
        const rs = s
          .current("receivables")
          .filter(
            (r) =>
              notes.some((i) => i.id === r.invoice_id) &&
              r.status !== "cancelled",
          );
        const remaining =
          rs.reduce(
            (n, r) =>
              n +
              cents(
                balance(
                  r,
                  s.current("payment_allocations"),
                  s.current("payments"),
                ),
              ),
            0,
          ) / 100;
        return (
          <>
            <span className="muted">
              Chamados: {String(request.ticket_numbers || "Nenhum informado")}
            </span>
            {notes.map((note) => (
              <Link
                className="invoice-link"
                key={note.id}
                to={`/notas?nota=${note.id}`}
              >
                NF {String(note.number)}
                {note.status === "Cancelada" ? " (cancelada)" : " · Gerada"}
              </Link>
            ))}
            {rs.length > 0 && (
              <Link
                className="invoice-link"
                to={`/receber?requisicao=${request.id}${cents(remaining) <= 0 ? "&tab=paid" : ""}`}
                aria-label={`Recebimentos da requisição ${request.order_number}`}
              >
                {cents(remaining) > 0
                  ? `A receber ${money(remaining)}`
                  : "Pago"}
              </Link>
            )}
          </>
        );
      }}
      fields={[
        { key: "title", label: "Descrição", required: true },
        {
          key: "client_id",
          label: "Cliente",
          relation: "clients",
          required: true,
        },
        {
          key: "order_number",
          label: "Número da requisição / pedido",
          required: true,
        },
        { key: "ticket_numbers", label: "Chamados informados" },
        { key: "_service_ids", label: "Serviços", type: "service-list" },
        {
          key: "amount",
          label: "Valor solicitado",
          type: "number",
          required: true,
        },
        { key: "send_deadline", label: "Prazo de envio da nota", type: "date" },
        {
          key: "status",
          label: "Situação",
          choices: [
            { value: "A gerar", label: "A gerar" },
            { value: "Faturado", label: "Gerada" },
            { value: "Parcialmente faturado", label: "Parcialmente gerada" },
            { value: "Cancelado", label: "Cancelada" },
          ],
        },
        {
          key: "_invoice_number",
          label: "Número da nota já emitida",
          required: true,
          showIf: needsInvoice,
        },
        {
          key: "_invoice_date",
          label: "Data de emissão da nota",
          type: "date",
          required: true,
          defaultValue: today(),
          showIf: needsInvoice,
        },
        {
          key: "_invoice_due_date",
          label: "Vencimento do recebimento",
          type: "date",
          required: true,
          defaultValue: dueAfter(today()),
          showIf: needsInvoice,
        },
        {
          key: "instructions",
          label: "Descrição e orientações fiscais",
          type: "textarea",
        },
      ]}
    />
  );
}
