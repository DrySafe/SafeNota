import { EntityPage } from "../../components/EntityPage";
import { clientFields } from "./fields";
export function ClientsPage() {
  return (
    <EntityPage
      table="clients"
      title="Clientes"
      subtitle="Quem contrata seu serviço, organizado por painel."
      fields={clientFields}
    />
  );
}
