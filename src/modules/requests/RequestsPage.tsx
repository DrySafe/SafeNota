import { EntityPage } from "../../components/EntityPage";
export function RequestsPage() {
  return (
    <EntityPage
      table="billing_requests"
      title="Pedidos de emissão"
      subtitle="Confira os chamados e prepare a nota sem perder o prazo."
      fields={[
        { key: "title", label: "Descrição", required: true },
        {
          key: "client_id",
          label: "Cliente",
          relation: "clients",
          required: true,
        },
        { key: "order_number", label: "Número do pedido", required: true },
        { key: "ticket_numbers", label: "Chamados (separados por vírgula)" },
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
          options: [
            "A gerar",
            "Parcialmente faturado",
            "Faturado",
            "Cancelado",
          ],
        },
        {
          key: "instructions",
          label: "Descrição e orientações fiscais",
          type: "textarea",
        },
      ]}
    />
  );
}
