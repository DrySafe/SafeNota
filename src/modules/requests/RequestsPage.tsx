import { requestFields } from "./fields";
import { Link } from "react-router-dom";
import { useStore } from "../../app/Store";
import { balance, cents, money } from "../../lib/finance";
import { EntityPage } from "../../components/EntityPage";
export function RequestsPage() {
  const s = useStore();
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
      fields={requestFields()}
    />
  );
}
