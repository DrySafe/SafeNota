import type { Field } from "../../types";
import { today, dueAfter } from "../../lib/finance";
export function requestFields(): Field[] {
  const needsInvoice = (values: Record<string, unknown>) =>
    values.status === "Faturado" && !values._has_invoice;
  return [
    { key: "title", label: "Descrição", required: true },
    {
      key: "client_id",
      label: "Cliente",
      relation: "clients",
      required: true,
    },
    {
      key: "order_number",
      label: "Número da requisição / pedido",
      required: true,
    },
    { key: "ticket_numbers", label: "Chamados informados" },
    { key: "_service_ids", label: "Serviços", type: "service-list" },
    {
      key: "amount",
      label: "Valor solicitado",
      type: "number",
      required: true,
    },
    { key: "send_deadline", label: "Prazo de envio da nota", type: "date" },
    {
      key: "status",
      label: "Situação",
      choices: [
        { value: "A gerar", label: "A gerar" },
        { value: "Faturado", label: "Gerada" },
        { value: "Parcialmente faturado", label: "Parcialmente gerada" },
        { value: "Cancelado", label: "Cancelada" },
      ],
    },
    {
      key: "_invoice_number",
      label: "Número da nota já emitida",
      required: true,
      showIf: needsInvoice,
    },
    {
      key: "_invoice_date",
      label: "Data de emissão da nota",
      type: "date",
      required: true,
      defaultValue: today(),
      showIf: needsInvoice,
    },
    {
      key: "_invoice_due_date",
      label: "Vencimento do recebimento",
      type: "date",
      required: true,
      defaultValue: dueAfter(today()),
      showIf: needsInvoice,
    },
    {
      key: "instructions",
      label: "Descrição e orientações fiscais",
      type: "textarea",
    },
  ];
}
