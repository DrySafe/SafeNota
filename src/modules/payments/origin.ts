import type { Data, Row } from "../../types";
export function receiptOrigin(receivable: Row, data: Data) {
  const invoice = data.invoices.find(
    (i) => i.id === receivable.invoice_id && i.panel_id === receivable.panel_id,
  );
  const request = data.billing_requests.find(
    (r) => r.id === invoice?.request_id && r.panel_id === receivable.panel_id,
  );
  const tickets = request
    ? data.services
        .filter(
          (service) =>
            service.panel_id === receivable.panel_id &&
            data.request_services.some(
              (link) =>
                link.panel_id === receivable.panel_id &&
                link.request_id === request.id &&
                link.service_id === service.id,
            ),
        )
        .map((service) => String(service.ticket_number || service.title))
    : [];
  // The invoice snapshot is the source of the billed services, even after request edits.
  const billed = invoice
    ? data.services
        .filter(
          (service) =>
            service.panel_id === receivable.panel_id &&
            data.invoice_services.some(
              (link) =>
                link.panel_id === receivable.panel_id &&
                link.invoice_id === invoice.id &&
                link.service_id === service.id,
            ),
        )
        .map((service) => String(service.ticket_number || service.title))
    : [];
  return {
    invoice,
    request,
    tickets: billed.length
      ? billed.join(", ")
      : tickets.length
        ? tickets.join(", ")
        : String(request?.ticket_numbers || ""),
    label: [
      request && `Requisição ${request.order_number}`,
      invoice && `NF ${invoice.number}`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
