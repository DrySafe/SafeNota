import type { Data, Row, Table } from "../../types";
const entities: Record<string, string> = {
  clients: "Cliente",
  services: "Serviço",
  billing_requests: "Requisição de nota",
  contracts: "Contrato",
  projects: "Projeto",
  invoices: "Nota fiscal",
  receivables: "Cobrança",
  payments: "Pagamento",
  payment_allocations: "Distribuição do pagamento",
  email_rules: "Regra de e-mail",
  captured_messages: "E-mail recebido",
  attachments: "Documento",
  memberships: "Integrante da equipe",
  invitations: "Convite",
  request_services: "Vínculo de serviço à requisição",
  invoice_services: "Vínculo de serviço à nota",
};
const actions: Record<string, string> = {
  insert: "Cadastro",
  created: "Cadastro",
  update: "Alteração",
  updated: "Alteração",
  delete: "Exclusão",
  archived: "Arquivamento",
  restored: "Restauração",
  cancelled: "Cancelamento",
  payment_recorded: "Pagamento registrado",
  payment_reversed: "Pagamento revertido",
};
export function auditPresentation(
  event: Row,
  data: Data,
  ownUser?: { id: string; email?: string },
) {
  const entity = String(event.entity);
  const row = (data[entity as Table] || []).find(
    (r) => r.id === event.entity_id && r.panel_id === event.panel_id,
  );
  let label = event.entity_label;
  if (!label && row) {
    if (entity === "captured_messages") {
      const x = row.extracted as Record<string, unknown> | undefined;
      label =
        row.kind === "request" && x?.order_number
          ? `Pedido ${x.order_number}`
          : x?.ticket_number
            ? `Chamado ${x.ticket_number}`
            : row.subject;
    } else
      label = row.order_number
        ? `Pedido ${row.order_number}`
        : row.ticket_number
          ? `Chamado ${row.ticket_number}`
          : entity === "invoices" && row.number
            ? `NF ${row.number}`
            : row.name || row.title;
  }
  const changes = event.changes as
    | {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        status?: string;
      }
    | undefined;
  let action = actions[String(event.action)] || "Atividade";
  if (String(event.action) === "update") {
    if (changes?.after?.deleted_at && !changes.before?.deleted_at)
      action = "Arquivamento";
    if (changes?.before?.deleted_at && !changes.after?.deleted_at)
      action = "Restauração";
  }
  const status = changes?.after?.status || changes?.status;
  const detail =
    entity === "captured_messages"
      ? {
          pending: "Aguardando revisão",
          ignored: "Captura ignorada",
          confirmed: "Cadastro confirmado",
        }[String(status)] || ""
      : "";
  return {
    title: `${action} · ${entities[entity] || "Registro"}`,
    label: String(label || "Registro sem descrição disponível"),
    actor: String(
      event.actor_label ||
        (event.actor_id === ownUser?.id ? ownUser?.email : null) ||
        (!event.actor_id
          ? entity === "captured_messages"
            ? "Automação do Gmail"
            : "Sistema"
          : event.actor_id === "demo"
            ? "Usuário de demonstração"
            : "Usuário não disponível"),
    ),
    detail,
  };
}
