import type { Data, Table, Row } from "../types";
export const tables: Table[] = [
  "clients",
  "services",
  "billing_requests",
  "contracts",
  "projects",
  "invoices",
  "receivables",
  "payments",
  "payment_allocations",
  "email_rules",
  "captured_messages",
  "audit_events",
  "attachments",
  "request_services",
  "invoice_services",
];
export const emptyData = () =>
  Object.fromEntries(tables.map((t) => [t, []])) as unknown as Data;
export function demoData(): Data {
  const data = emptyData();
  const row = (
    id: string,
    props: Record<string, unknown>,
    panel = "demo-positivo",
  ): Row => ({
    id,
    panel_id: panel,
    created_at: new Date().toISOString(),
    ...props,
  });
  data.clients = [
    row("client-1", {
      name: "Positivo · Exemplo",
      document: "",
      email: "",
      description: "Dados fictícios para demonstração",
    }),
    row("client-2", { name: "Cliente de software · Exemplo" }, "demo-safe"),
  ];
  data.services = [
    row("service-1", {
      title: "Configuração e suporte técnico",
      client_id: "client-1",
      ticket_number: "23628-1",
      reference: "INC0654023",
      amount: 80,
      status: "Concluído",
    }),
    row("service-2", {
      title: "Manutenção de estação",
      client_id: "client-1",
      ticket_number: "24543-1",
      amount: 150,
      status: "Aguardando atendimento",
    }),
  ];
  data.billing_requests = [
    row("request-1", {
      title: "Requisição de nota",
      client_id: "client-1",
      order_number: "4500010497",
      ticket_numbers: "23628-1",
      amount: 80,
      status: "Faturado",
      instructions: "Incluir pedido e chamados na descrição.",
    }),
  ];
  data.invoices = [
    row("invoice-1", {
      title: "Nota de suporte",
      number: "12",
      client_id: "client-1",
      request_id: "request-1",
      amount: 80,
      net_amount: 80,
      issue_date: "2026-09-15",
      status: "Gerada",
    }),
  ];
  data.request_services = [
    row("request-link-1", { request_id: "request-1", service_id: "service-1" }),
  ];
  data.invoice_services = [
    row("invoice-link-1", { invoice_id: "invoice-1", service_id: "service-1" }),
  ];
  data.receivables = [
    row("receivable-1", {
      title: "NF 12 · Pedido 4500010497",
      client_id: "client-1",
      invoice_id: "invoice-1",
      amount: 80,
      due_date: "2026-10-05",
      status: "active",
    }),
  ];
  data.contracts = [
    row(
      "contract-1",
      {
        title: "Licença mensal de software",
        client_id: "client-2",
        amount: 250,
        due_day: 10,
        start_date: "2026-10-01",
        status: "Ativo",
      },
      "demo-safe",
    ),
  ];
  data.projects = [
    row(
      "project-1",
      {
        title: "Novo site institucional",
        client_id: "client-2",
        description: "Projeto demonstrativo",
        due_date: "2026-11-20",
        stages: "Planejamento\nDesenvolvimento\nEntrega",
        status: "Em andamento",
      },
      "demo-safe",
    ),
  ];
  return data;
}
