import { useState } from "react";
import { useStore } from "../../app/Store";
import { money } from "../../lib/finance";
import { notesForService } from "./links";
export function ServicePicker({
  clientId,
  selected,
  onChange,
  disabled = false,
}: {
  clientId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const s = useStore();
  const [search, setSearch] = useState("");
  const services = s.data.services.filter(
    (r) =>
      r.panel_id === s.panelId && (!r.deleted_at || selected.includes(r.id)),
  );
  const visible = services.filter((r) =>
    `${r.title} ${r.ticket_number || ""} ${r.reference || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <fieldset className="service-picker full">
      <legend>Serviços da requisição / nota</legend>
      <p className="muted">
        Selecione os atendimentos deste cliente. {selected.length} selecionados.
      </p>
      <input
        aria-label="Pesquisar serviços disponíveis"
        placeholder="Buscar chamado, referência ou descrição"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {!clientId && (
        <p className="muted">Selecione o cliente para adicionar serviços.</p>
      )}
      <div className="service-picker-list">
        {visible.map((service) => {
          const checked = selected.includes(service.id);
          const notes = notesForService(
            service.id,
            s.current("invoice_services"),
            s.current("invoices"),
          ).filter((n) => n.status === "Gerada");
          const incompatible = service.client_id !== clientId;
          return (
            <label className="service-choice" key={service.id}>
              <input
                type="checkbox"
                aria-label={`Adicionar serviço ${service.ticket_number || service.title}`}
                disabled={
                  disabled ||
                  incompatible ||
                  Boolean(service.deleted_at && !checked)
                }
                checked={checked}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, service.id]
                      : selected.filter((id) => id !== service.id),
                  )
                }
              />
              <span>
                <strong>
                  {String(service.ticket_number || service.title)}
                </strong>
                <small>
                  {String(service.title)}
                  {service.reference ? ` · ${service.reference}` : ""}
                </small>
                <small>
                  {money(service.amount)}
                  {incompatible ? " · Outro cliente" : ""}
                  {service.deleted_at ? " · Arquivado" : ""}
                  {notes.length
                    ? ` · Já vinculado: ${notes.map((n) => `NF ${n.number}`).join(", ")}`
                    : " · Sem nota gerada"}
                </small>
              </span>
            </label>
          );
        })}
      </div>
      {!visible.length && (
        <p className="muted">Nenhum serviço encontrado neste painel.</p>
      )}
    </fieldset>
  );
}
