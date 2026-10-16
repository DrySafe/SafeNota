import type { Row } from "../../types";
export function requestTicketMatches(
  services: Row[],
  panelId: string,
  clientId: string,
  tickets: unknown,
) {
  return [
    ...new Set(
      String(tickets || "")
        .split(/[,;\n]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ].map((ticket) => ({
    ticket,
    matches: services.filter(
      (s) =>
        s.panel_id === panelId &&
        s.client_id === clientId &&
        !s.deleted_at &&
        String(s.ticket_number || "").trim() === ticket,
    ),
  }));
}
