import { Link } from "react-router-dom";
import { useStore } from "../../app/Store";
import type { Row } from "../../types";
import { receiptOrigin } from "./origin";
export function ReceiptReference({
  receivable,
  links = true,
}: {
  receivable: Row;
  links?: boolean;
}) {
  const s = useStore();
  const { invoice, request, tickets } = receiptOrigin(receivable, s.data);
  return (
    <span className="receipt-reference">
      {request &&
        (links && !request.deleted_at ? (
          <Link
            to={`/requisicoes?requisicao=${encodeURIComponent(request.id)}`}
          >
            Requisição {String(request.order_number)}
          </Link>
        ) : (
          <span>Requisição {String(request.order_number)}</span>
        ))}
      {invoice &&
        (links && !invoice.deleted_at ? (
          <Link to={`/notas?nota=${encodeURIComponent(invoice.id)}`}>
            NF {String(invoice.number)}
            {invoice.status === "Cancelada" ? " (cancelada)" : ""}
          </Link>
        ) : (
          <span>NF {String(invoice.number)}</span>
        ))}
      {tickets && <small>Chamados: {tickets}</small>}
      {!invoice && !request && (
        <small>
          {receivable.contract_id
            ? "Contrato mensal"
            : "Cobrança sem requisição / nota vinculada"}
        </small>
      )}
    </span>
  );
}
