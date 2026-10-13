import type { Data } from "../types";
// A request and its invoices share document visibility, while uploads keep their original owner.
export function documentAttachments(
  entity: string,
  id: string,
  panelId: string,
  data: Data,
) {
  const origins = new Set([`${entity}:${id}`]);
  if (entity === "invoices") {
    const invoice = data.invoices.find(
      (row) => row.id === id && row.panel_id === panelId && !row.deleted_at,
    );
    const request = data.billing_requests.find(
      (row) =>
        row.id === invoice?.request_id &&
        row.panel_id === panelId &&
        row.client_id === invoice?.client_id &&
        !row.deleted_at,
    );
    if (request) origins.add(`billing_requests:${request.id}`);
  } else if (entity === "billing_requests") {
    const request = data.billing_requests.find(
      (row) => row.id === id && row.panel_id === panelId && !row.deleted_at,
    );
    if (request)
      data.invoices
        .filter(
          (row) =>
            row.request_id === id &&
            row.panel_id === panelId &&
            row.client_id === request.client_id &&
            !row.deleted_at,
        )
        .forEach((row) => origins.add(`invoices:${row.id}`));
  }
  return data.attachments.filter(
    (row) =>
      row.panel_id === panelId &&
      !row.deleted_at &&
      origins.has(`${row.entity}:${row.entity_id}`),
  );
}
