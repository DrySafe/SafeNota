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
  return services.filter(
    (s) =>
      s.panel_id === panelId &&
      s.client_id === clientId &&
      ((number && String(s.ticket_number || "").trim() === number) ||
        (ref &&
          String(s.reference || "")
            .trim()
            .toUpperCase() === ref)),
  );
}
