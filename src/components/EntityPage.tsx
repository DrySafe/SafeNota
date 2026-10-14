import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Plus, Search, Pencil, Archive, FileDown } from "lucide-react";
import { useStore, message } from "../app/Store";
import { Modal } from "./Modal";
import { useSearchParams } from "react-router-dom";
import { ServicePicker } from "../modules/services/ServicePicker";
import { serviceIdsFor } from "../modules/services/links";
import { clientFields } from "../modules/clients/fields";
import { dateLabel, money } from "../lib/finance";
import { documentAttachments } from "../lib/documents";
import { exportCsv } from "../lib/csv";
import { supabase } from "../lib/supabase";
import type { Field, Row, Table } from "../types";
export function EntityPage({
  table,
  title,
  subtitle,
  fields,
  extra,
  rowExtra,
  rowFilter,
  groupBy,
  groupLabel,
}: {
  table: Table;
  title: string;
  subtitle: string;
  fields: Field[];
  extra?: ReactNode;
  rowExtra?: (row: Row) => ReactNode;
  rowFilter?: (row: Row) => boolean;
  groupBy?: (row: Row) => string;
  groupLabel?: (group: string) => string;
}) {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const noteId = params.get(
    table === "billing_requests" ? "requisicao" : "nota",
  );
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | true | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setEditing(null);
    setSelected(null);
    setSearch("");
    setError("");
  }, [s.panelId, table]);
  useEffect(() => {
    if (!["invoices", "billing_requests"].includes(table) || !noteId) return;
    const invoice = s.data[table].find(
      (r) => r.id === noteId && r.panel_id === s.panelId && !r.deleted_at,
    );
    if (invoice) {
      setSelected(invoice);
      setError("");
    } else if (!s.loading) setError("Registro não encontrado neste painel.");
  }, [noteId, s.panelId, s.data[table], s.loading, table]);
  function closeDetails() {
    setSelected(null);
    if (noteId) {
      const next = new URLSearchParams(params);
      next.delete(table === "billing_requests" ? "requisicao" : "nota");
      setParams(next, { replace: true });
    }
  }
  const rows = s
    .current(table)
    .filter((r) => !rowFilter || rowFilter(r))
    .sort((a, b) => (groupBy ? groupBy(b).localeCompare(groupBy(a)) : 0))
    .filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">{s.panel?.name}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {(table === "email_rules"
          ? s.role === "admin"
          : s.role !== "viewer") && (
          <button className="primary" onClick={() => setEditing(true)}>
            <Plus size={18} />
            Adicionar
          </button>
        )}
      </header>
      {extra}
      <div className="list-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label={`Pesquisar ${title}`}
            placeholder="Buscar nome, número ou referência…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          disabled={!rows.length}
          onClick={() =>
            exportCsv(
              title,
              rows.map((r) =>
                Object.fromEntries(
                  fields
                    .filter((f) => !f.showIf)
                    .map((f) => [
                      f.label,
                      f.relation
                        ? s.current(f.relation).find((v) => v.id === r[f.key])
                            ?.name ||
                          s.current(f.relation).find((v) => v.id === r[f.key])
                            ?.title
                        : r[f.key],
                    ]),
                ),
              ),
            )
          }
        >
          Exportar CSV
        </button>
        <span className="muted">{rows.length} registros</span>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="entity-list">
        {rows.map((r, index) => (
          <Fragment key={r.id}>
            {groupBy &&
              (index === 0 || groupBy(rows[index - 1]) !== groupBy(r)) && (
                <h2 className="month-heading">
                  {groupLabel ? groupLabel(groupBy(r)) : groupBy(r)}
                </h2>
              )}
            <article className="entity-card" key={r.id}>
              <button className="entity-main" onClick={() => setSelected(r)}>
                <span className="entity-icon">
                  {String(r.title || r.name || "#")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <div>
                  <h3>{String(r.title || r.name || r.number || "Registro")}</h3>
                  <p>
                    {[
                      r.order_number,
                      r.ticket_number,
                      r.reference,
                      s.current("clients").find((c) => c.id === r.client_id)
                        ?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Detalhes do registro"}
                  </p>
                </div>
              </button>
              {rowExtra && (
                <div className="entity-associations">{rowExtra(r)}</div>
              )}
              <div className="entity-end">
                {r.amount !== undefined && <strong>{money(r.amount)}</strong>}
                {r.status !== undefined && (
                  <span className="badge">
                    {fields
                      .find((f) => f.key === "status")
                      ?.choices?.find((c) => c.value === r.status)?.label ||
                      String(r.status)}
                  </span>
                )}
                {(table === "email_rules"
                  ? s.role === "admin"
                  : s.role !== "viewer") && (
                  <button
                    aria-label="Editar"
                    className="icon-button"
                    onClick={() => setEditing(r)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {s.role === "admin" && (
                  <button
                    aria-label="Arquivar"
                    className="icon-button"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Arquivar este registro? O histórico será preservado.",
                        )
                      )
                        return;
                      try {
                        await s.remove(table, r.id);
                      } catch (e) {
                        setError(message(e));
                      }
                    }}
                  >
                    <Archive size={16} />
                  </button>
                )}
              </div>
            </article>
          </Fragment>
        ))}
      </div>
      {!rows.length && (
        <div className="empty">
          <h3>Nenhum registro encontrado</h3>
          <p>Adicione o primeiro registro ou ajuste a busca.</p>
        </div>
      )}
      {editing && (
        <EntityForm
          table={table}
          title={
            typeof editing === "object"
              ? "Editar registro"
              : "Adicionar registro"
          }
          fields={fields}
          row={typeof editing === "object" ? editing : undefined}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {selected && (
        <Modal
          title={String(selected.title || selected.name || "Detalhes")}
          onClose={closeDetails}
        >
          <EntityDetails table={table} row={selected} fields={fields} />
        </Modal>
      )}
    </>
  );
}
export function EntityDetails({
  table,
  row,
  fields,
}: {
  table: Table;
  row: Row;
  fields: Field[];
}) {
  const s = useStore();
  return (
    <>
      {" "}
      <dl className="details">
        {fields
          .filter((f) => !f.showIf)
          .map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>
                {f.type === "service-list"
                  ? s
                      .current("services")
                      .filter((service) =>
                        serviceIdsFor(
                          row.id,
                          table === "invoices" ? "invoice_id" : "request_id",
                          s.current(
                            table === "invoices"
                              ? "invoice_services"
                              : "request_services",
                          ),
                        ).includes(service.id),
                      )
                      .map((service) =>
                        String(service.ticket_number || service.title),
                      )
                      .join(", ") || "Nenhum serviço vinculado"
                  : f.relation
                    ? String(
                        s.current(f.relation).find((r) => r.id === row[f.key])
                          ?.name ||
                          s.current(f.relation).find((r) => r.id === row[f.key])
                            ?.title ||
                          "—",
                      )
                    : f.type === "date"
                      ? dateLabel(row[f.key])
                      : f.type === "number" && f.key.includes("amount")
                        ? money(row[f.key])
                        : f.choices?.find(
                            (choice) => choice.value === row[f.key],
                          )?.label || String(row[f.key] || "—")}
              </dd>
            </div>
          ))}
      </dl>
      <Attachments entity={table} id={row.id} />
    </>
  );
}
export function EntityForm({
  table,
  title,
  fields,
  row,
  onClose,
  onSaved,
  embedded = false,
}: {
  table: Table;
  title: string;
  fields: Field[];
  row?: Row;
  onClose: () => void;
  onSaved?: (id: string) => void;
  embedded?: boolean;
}) {
  const s = useStore();
  const defaults = Object.fromEntries(
    fields
      .filter((f) => f.defaultValue !== undefined || f.options || f.choices)
      .map((f) => [
        f.key,
        f.defaultValue ?? f.options?.[0] ?? f.choices?.[0]?.value,
      ]),
  );
  const [values, setValues] = useState<Record<string, unknown>>(
    row
      ? {
          ...defaults,
          ...row,
          _has_invoice:
            table === "billing_requests" &&
            s
              .current("invoices")
              .some((i) => i.request_id === row.id && i.status === "Gerada"),
          ...(fields.some((f) => f.type === "service-list")
            ? {
                _service_ids: serviceIdsFor(
                  row.id,
                  table === "invoices" ? "invoice_id" : "request_id",
                  s.current(
                    table === "invoices"
                      ? "invoice_services"
                      : "request_services",
                  ),
                ),
              }
            : {}),
        }
      : defaults,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  if (creatingClient) {
    // Switch content within the existing dialog; the parent draft stays in state.
    return (
      <Modal title="Novo cliente" onClose={() => setCreatingClient(false)}>
        <EntityForm
          table="clients"
          title="Novo cliente"
          fields={clientFields}
          embedded
          onClose={() => setCreatingClient(false)}
          onSaved={(id) =>
            setValues((v) => ({ ...v, client_id: id, _service_ids: [] }))
          }
        />
      </Modal>
    );
  }
  const form = (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const payload = Object.fromEntries(
            fields
              .filter((f) => !f.showIf || f.showIf(values))
              .map((f) => [
                f.key,
                values[f.key] === "" || values[f.key] === undefined
                  ? null
                  : f.type === "number"
                    ? Number(values[f.key])
                    : values[f.key],
              ]),
          );
          const id = await s.save(table, payload, row?.id);
          onSaved?.(id);
          onClose();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {fields
          .filter((f) => !f.showIf || f.showIf(values))
          .map((f) =>
            f.type === "service-list" ? (
              <ServicePicker
                key={f.key}
                clientId={String(values.client_id || "")}
                selected={
                  Array.isArray(values[f.key])
                    ? (values[f.key] as string[])
                    : []
                }
                disabled={busy}
                onChange={(ids) =>
                  setValues((v) => ({
                    ...v,
                    [f.key]: ids,
                    ...(table === "billing_requests"
                      ? {
                          ticket_numbers: s
                            .current("services")
                            .filter((service) => ids.includes(service.id))
                            .map((service) => service.ticket_number)
                            .filter(Boolean)
                            .join(", "),
                        }
                      : {}),
                  }))
                }
              />
            ) : (
              <div key={f.key} className={f.type === "textarea" ? "full" : ""}>
                <label>
                  {f.label}
                  {f.required ? " *" : ""}
                  {f.relation || f.options || f.choices ? (
                    <select
                      required={f.required}
                      value={String(values[f.key] || "")}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [f.key]: e.target.value,
                          ...(f.key === "client_id"
                            ? {
                                _service_ids: [],
                                ...(table === "invoices"
                                  ? { request_id: null }
                                  : {}),
                              }
                            : {}),
                          ...(f.key === "request_id"
                            ? {
                                _service_ids: serviceIdsFor(
                                  e.target.value,
                                  "request_id",
                                  s.current("request_services"),
                                ),
                              }
                            : {}),
                        }))
                      }
                    >
                      <option value="">Selecione</option>
                      {f.relation
                        ? s
                            .current(f.relation)
                            .filter(
                              (r) =>
                                f.key !== "request_id" ||
                                r.client_id === values.client_id,
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {String(r.name || r.title || r.number)}
                              </option>
                            ))
                        : f.choices
                          ? f.choices.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))
                          : f.options!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      rows={4}
                      required={f.required}
                      value={String(values[f.key] || "")}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      required={f.required}
                      type={f.type || "text"}
                      min={f.type === "number" ? 0 : undefined}
                      max={f.key === "due_day" ? 31 : undefined}
                      step={f.type === "number" ? "0.01" : undefined}
                      value={String(values[f.key] ?? "")}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                    />
                  )}
                </label>
                {f.relation === "clients" &&
                  (s.role === "admin" || s.role === "operator") && (
                    <div className="inline-client-action">
                      {!s.current("clients").length && (
                        <small>Nenhum cliente neste painel.</small>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setCreatingClient(true)}
                        disabled={busy}
                      >
                        <Plus size={16} />
                        Novo cliente
                      </button>
                    </div>
                  )}
              </div>
            ),
          )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button
          type="button"
          className="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
  return embedded ? (
    form
  ) : (
    <Modal title={title} onClose={onClose}>
      {form}
    </Modal>
  );
}
export function Attachments({ entity, id }: { entity: string; id: string }) {
  const s = useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attachments = documentAttachments(entity, id, s.panelId, s.data);
  return (
    <section className="attachments">
      <h3>Documentos e comprovantes</h3>
      {attachments.map((a) => (
        <button
          className="secondary"
          key={a.id}
          onClick={async () => {
            try {
              const r = await supabase!.storage
                .from("documents")
                .createSignedUrl(String(a.path), 60);
              if (r.error) throw r.error;
              window.open(r.data.signedUrl, "_blank", "noopener,noreferrer");
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          <FileDown size={16} />
          {String(a.name)}
          {a.entity !== entity || a.entity_id !== id ? (
            <small>
              {" "}
              ·{" "}
              {a.entity === "billing_requests"
                ? "Anexo da requisição"
                : `Anexo da NF ${String(s.current("invoices").find((note) => note.id === a.entity_id)?.number || "")}`}
            </small>
          ) : null}
        </button>
      ))}
      {s.role !== "viewer" && (
        <label className="upload">
          {busy ? "Enviando…" : "Anexar PDF, XML ou imagem (até 10 MB)"}
          <input
            type="file"
            disabled={busy}
            accept=".pdf,.xml,.png,.jpg,.jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                await s.attach(file, entity, id);
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
