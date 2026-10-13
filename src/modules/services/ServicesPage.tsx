import { EntityPage } from "../../components/EntityPage";
export function ServicesPage() {
  return (
    <EntityPage
      table="services"
      title="Serviços e chamados"
      subtitle="Do primeiro atendimento à conclusão do serviço."
      fields={[
        { key: "title", label: "Descrição", required: true },
        {
          key: "client_id",
          label: "Cliente",
          relation: "clients",
          required: true,
        },
        { key: "ticket_number", label: "Número completo do chamado" },
        { key: "reference", label: "Referência externa (INC / SUP)" },
        { key: "amount", label: "Valor previsto", type: "number" },
        { key: "service_date", label: "Data do serviço", type: "date" },
        { key: "contract_id", label: "Contrato", relation: "contracts" },
        { key: "project_id", label: "Projeto", relation: "projects" },
        {
          key: "status",
          label: "Situação",
          options: [
            "Aguardando atendimento",
            "Em atendimento",
            "Concluído",
            "Cancelado",
          ],
        },
        { key: "notes", label: "Observações", type: "textarea" },
      ]}
    />
  );
}
