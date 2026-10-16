import { requestFinancialState } from "./financialState";
import { requestFields } from "./fields";
import { Link } from "react-router-dom";
import { useStore } from "../../app/Store";
import { cents, money } from "../../lib/finance";
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
      rowTitle={(request) =>
        String(request.order_number || "Pedido sem número")
      }
      rowSubtitle={(request) =>
        [
          request.title,
          s.current("clients").find((c) => c.id === request.client_id)?.name,
        ]
          .filter(Boolean)
          .join(" · ")
      }
      rowClassName={(request) =>
        `request-${requestFinancialState(request, s.data).state}`
      }
      rowExtra={(request) => {
        const notes = s
          .current("invoices")
          .filter((i) => i.request_id === request.id);
        const {
          receivables: rs,
          remaining,
          state,
        } = requestFinancialState(request, s.data);
        return (
          <>
            {state === "overdue" && <span className="badge red">Atrasado</span>}
            <span className="muted">
              {String(request.ticket_numbers || "")
                .split(",")
                .filter((ticket) => ticket.trim())
                .map((ticket, index) => {
                  const reference = String(request.ticket_references || "")
                    .split(",")
                    [index]?.trim();
                  return (
                    <span className="request-ticket" key={index}>
                      {ticket.trim()}
                      {reference ? ` · ${reference}` : ""}
                    </span>
                  );
                })}
              {!request.ticket_numbers && "Nenhum chamado informado"}
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
