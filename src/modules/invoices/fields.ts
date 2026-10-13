import type { Field } from "../../types";
export const invoiceFields: Field[] = [
  { key: "title", label: "Descrição", required: true },
  { key: "number", label: "Número da nota", required: true },
  {
    key: "client_id",
    label: "Cliente",
    relation: "clients",
    required: true,
  },
  {
    key: "request_id",
    label: "Requisição de nota",
    relation: "billing_requests",
  },
  { key: "_service_ids", label: "Serviços", type: "service-list" },
  { key: "fiscal_key", label: "Chave fiscal" },
  {
    key: "amount",
    label: "Valor bruto",
    type: "number",
    required: true,
  },
  {
    key: "net_amount",
    label: "Valor líquido",
    type: "number",
    required: true,
  },
  { key: "issue_date", label: "Emissão", type: "date", required: true },
  { key: "status", label: "Situação fiscal", options: ["Gerada"] },
  {
    key: "description",
    label: "Descrição dos serviços",
    type: "textarea",
  },
];
