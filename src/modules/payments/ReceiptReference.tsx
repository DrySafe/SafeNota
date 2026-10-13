import { useState } from "react";
import { Modal } from "../../components/Modal";
import { EntityDetails } from "../../components/EntityPage";
import { requestFields } from "../requests/fields";
import { invoiceFields } from "../invoices/fields";
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
  const [selected, setSelected] = useState<{
    table: "invoices" | "billing_requests";
    id: string;
  } | null>(null);
  const row = selected
    ? s.data[selected.table].find(
        (row) =>
          row.id === selected.id &&
          row.panel_id === s.panelId &&
          !row.deleted_at,
      )
    : undefined;
  const { invoice, request, tickets } = receiptOrigin(receivable, s.data);
  return (
    <>
      <span className="receipt-reference">
        {request &&
          (links && !request.deleted_at ? (
            <button
              type="button"
              className="reference-button"
              onClick={() =>
                setSelected({ table: "billing_requests", id: request.id })
              }
            >
              Requisição {String(request.order_number)}
            </button>
          ) : (
            <span>Requisição {String(request.order_number)}</span>
          ))}
        {invoice &&
          (links && !invoice.deleted_at ? (
            <button
              type="button"
              className="reference-button"
              onClick={() => setSelected({ table: "invoices", id: invoice.id })}
            >
              NF {String(invoice.number)}
              {invoice.status === "Cancelada" ? " (cancelada)" : ""}
            </button>
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
      {row && selected && (
        <Modal
          title={String(row.title || row.name || "Detalhes")}
          onClose={() => setSelected(null)}
        >
          <EntityDetails
            table={selected.table}
            row={row}
            fields={
              selected.table === "invoices" ? invoiceFields : requestFields()
            }
          />
        </Modal>
      )}
    </>
  );
}
