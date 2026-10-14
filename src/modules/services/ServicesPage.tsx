import { useEffect, useState } from "react";
import { monthKey, monthLabel } from "../../lib/periods";
import { EntityPage } from "../../components/EntityPage";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/Store";
import { notesForService } from "./links";
export function ServicesPage() {
  const s = useStore();
  const [params] = useSearchParams();
  const requestedKind =
    params.get("situacao") === "sem-nota" ? "unbilled" : "all";
  const [month, setMonth] = useState("all");
  const [kind, setKind] = useState(requestedKind);
  useEffect(() => {
    setMonth("all");
    setKind(requestedKind);
  }, [s.panelId, requestedKind]);
  const services = s.current("services");
  const invoices = s.current("invoices");
  const links = s.current("invoice_services");
  const billed = new Set(
    links
      .filter((link) =>
        invoices.some(
          (note) => note.id === link.invoice_id && note.status === "Gerada",
        ),
      )
      .map((link) => link.service_id),
  );
  const months = [
    ...new Set(
      services.map((service) => monthKey(service.service_date)).filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
  const inMonth = (service: (typeof services)[number]) =>
    month === "all" ||
    monthKey(service.service_date) === (month === "undated" ? "" : month);
  const scoped = services.filter(inMonth);
  return (
    <EntityPage
      table="services"
      title="Serviços e chamados"
      subtitle="Confira quais atendimentos já têm nota e organize-os pelo mês do serviço."
      extra={
        <div className="period-toolbar">
          <label>
            Mês dos serviços
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">Todos os meses</option>
              {months.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
              <option value="undated">Sem data do serviço</option>
            </select>
          </label>
          <div className="tabs" aria-label="Situação da nota">
            {[
              ["all", "Todos"],
              ["billed", "Com nota gerada"],
              ["unbilled", "Sem nota gerada"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={kind === value ? "active" : ""}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {label} (
                {
                  scoped.filter(
                    (service) =>
                      value === "all" ||
                      (value === "billed") === billed.has(service.id),
                  ).length
                }
                )
              </button>
            ))}
          </div>
        </div>
      }
      rowFilter={(service) =>
        inMonth(service) &&
        (kind === "all" || (kind === "billed") === billed.has(service.id))
      }
      groupBy={(service) => monthKey(service.service_date)}
      groupLabel={monthLabel}
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
