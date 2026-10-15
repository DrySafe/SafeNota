import type { Field } from "../../types";
export type EmailKind = "request" | "service";
export const positivoSenders: Record<EmailKind, string> = {
  service: "donotreply@fieldsmais.smtp-cervelloesm.com.br",
  request: "ajudasmais@positivosmais.com",
};
export function emailRuleFields(
  connections: { id: string; email: string }[],
  preset?: EmailKind,
): Field[] {
  return [
    {
      key: "title",
      label: "Nome da regra",
      required: true,
      ...(preset
        ? {
            defaultValue:
              preset === "service"
                ? "Positivo · Transferências de chamados"
                : "Positivo · Requisições de nota",
          }
        : {}),
    },
    {
      key: "connection_id",
      label: "Conta Gmail conectada",
      required: true,
      choices: connections.map((c) => ({ value: c.id, label: c.email })),
    },
    {
      key: "client_id",
      label: "Cliente de destino",
      relation: "clients",
      required: true,
    },
    {
      key: "sender",
      label: "E-mail exato do remetente",
      type: "email",
      required: true,
      ...(preset ? { defaultValue: positivoSenders[preset] } : {}),
    },
    {
      key: "kind",
      label: "Tipo de mensagem",
      defaultValue: preset || "request",
      choices: [
        { value: "request", label: "Requisição de nota" },
        { value: "service", label: "Transferência de chamado" },
      ],
    },
    {
      key: "keywords",
      label: "Palavras-chave (separadas por vírgula)",
      ...(preset
        ? { defaultValue: preset === "service" ? "transferido" : "Nota Fiscal" }
        : {}),
    },
    {
      key: "patterns",
      label: "Padrões JSON (opcional; grupo 1 captura cada campo)",
      type: "textarea",
    },
    {
      key: "status",
      label: "Situação",
      defaultValue: "paused",
      choices: [
        { value: "paused", label: "Pausada para configurar" },
        { value: "active", label: "Ativa" },
      ],
    },
  ];
}
