import { matchingServices } from "./duplicates";
import type { Row } from "../../types";
import { cents } from "../../lib/finance";
import { extractEmail } from "./extract";
export interface AutomationContext {
  kind: "request" | "service";
  panelId: string;
  clientId: string;
  services: Row[];
  requests: Row[];
  patterns?: Record<string, string>;
}
// Decision only: no writes, OAuth requests, emission or payment confirmation.
export function assessEmailAutomation(
  text: string,
  context: AutomationContext,
) {
  const extracted = extractEmail(text, context.kind, context.patterns);
  const reasons: string[] = [];
  const serviceIds: string[] = [];
  const services = context.services.filter(
    (r) =>
      r.panel_id === context.panelId &&
      r.client_id === context.clientId &&
      !r.deleted_at,
  );
  const requests = context.requests.filter(
    (r) =>
      r.panel_id === context.panelId &&
      r.client_id === context.clientId &&
      !r.deleted_at,
  );
  if (!context.panelId || !context.clientId)
    reasons.push("Configure o painel e o cliente da regra.");
  let existingId: string | undefined;
  if (context.kind === "service") {
    if (!extracted.ticket_number)
      reasons.push("Não foi encontrado o número completo do chamado.");
    const matches = matchingServices(
      context.services,
      context.panelId,
      context.clientId,
      extracted.ticket_number,
      extracted.reference,
    );
    if (matches.length > 1)
      reasons.push("Chamado e referência apontam para mais de um serviço.");
    if (matches.length === 1) existingId = matches[0].id;
  } else {
    if (!extracted.order_number)
      reasons.push("Não foi encontrado o número da requisição.");
    if (!Number.isFinite(extracted.amount) || cents(extracted.amount) <= 0)
      reasons.push("Revise o valor solicitado.");
    const tickets = extracted.ticket_numbers
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tickets.length)
      reasons.push("Não foram identificados os chamados da requisição.");
    for (const ticket of tickets) {
      const matches = services.filter((r) => r.ticket_number === ticket);
      if (matches.length !== 1)
        reasons.push(
          matches.length
            ? `Chamado ${ticket} ambíguo.`
            : `Chamado ${ticket} ainda não cadastrado.`,
        );
      else serviceIds.push(matches[0].id);
    }
    const matches = requests.filter(
      (r) => r.order_number === extracted.order_number,
    );
    if (matches.length > 1)
      reasons.push("Há mais de uma requisição com esse número.");
    if (matches.length === 1) {
      const previous = String(matches[0].ticket_numbers || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .sort()
        .join(",");
      if (
        cents(matches[0].amount) !== cents(extracted.amount) ||
        previous !== [...tickets].sort().join(",")
      )
        reasons.push("O e-mail diverge da requisição já cadastrada.");
      else existingId = matches[0].id;
    }
  }
  return {
    action: reasons.length ? "review" : existingId ? "existing" : "create",
    extracted,
    reasons,
    serviceIds,
    existingId,
  } as const;
}
