import type { Row } from "../../types";
export function matchingServices(
  services: Row[],
  panelId: string,
  clientId: string,
  ticket: unknown,
  reference: unknown,
) {
  const number = String(ticket || "").trim();
  const ref = String(reference || "")
    .trim()
    .toUpperCase();
  const scoped = services.filter(
    (s) => s.panel_id === panelId && s.client_id === clientId,
  );
  const byTicket = number
    ? scoped.filter((s) => String(s.ticket_number || "").trim() === number)
    : [];
  if (byTicket.length) return byTicket;
  return ref
    ? scoped.filter(
        (s) =>
          String(s.reference || "")
            .trim()
            .toUpperCase() === ref,
      )
    : [];
}
