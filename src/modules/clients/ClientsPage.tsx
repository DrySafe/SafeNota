import { EntityPage } from "../../components/EntityPage";
export function ClientsPage() {
  return (
    <EntityPage
      table="clients"
      title="Clientes"
      subtitle="Quem contrata seu serviço, organizado por painel."
      fields={[
        { key: "name", label: "Nome / razão social", required: true },
        { key: "document", label: "CPF ou CNPJ" },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone" },
        { key: "description", label: "Observações", type: "textarea" },
      ]}
    />
  );
}
