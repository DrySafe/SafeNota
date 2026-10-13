import { EntityPage } from "../../components/EntityPage";
import { Link } from "react-router-dom";
import { useStore } from "../../app/Store";
import { notesForService } from "./links";
export function ServicesPage() {
  const s = useStore();
  return (
    <EntityPage
      table="services"
      title="Serviços e chamados"
      subtitle="Do primeiro atendimento à conclusão do serviço."
      rowExtra={(service) => {
        const notes = notesForService(
          service.id,
          s.current("invoice_services"),
          s.current("invoices"),
        );
        return (
          <>
            <span
              className={`badge ${notes.some((n) => n.status === "Gerada") ? "" : "neutral"}`}
            >
              {notes.some((n) => n.status === "Gerada")
                ? "Nota gerada"
                : "Sem nota gerada"}
            </span>
            {notes.map((note) => (
              <Link
                className="invoice-link"
                key={note.id}
                to={`/notas?nota=${encodeURIComponent(note.id)}`}
              >
                NF {String(note.number)}
                {note.status === "Cancelada" ? " (cancelada)" : ""}
              </Link>
            ))}
          </>
        );
      }}
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
