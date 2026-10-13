import type { Row } from "../../types";
export function notesForService(id: string, links: Row[], invoices: Row[]) {
  const ids = new Set(
    links.filter((l) => l.service_id === id).map((l) => l.invoice_id),
  );
  return invoices.filter((i) => ids.has(i.id));
}
export function serviceIdsFor(
  parent: string,
  field: "request_id" | "invoice_id",
  links: Row[],
) {
  return links
    .filter((l) => l[field] === parent)
    .map((l) => String(l.service_id));
}
