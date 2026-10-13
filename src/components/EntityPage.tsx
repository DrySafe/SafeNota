import { useEffect, useState, type ReactNode } from "react";
import { Plus, Search, Pencil, Archive, FileDown } from "lucide-react";
import { useStore, message } from "../app/Store";
import { Modal } from "./Modal";
import { dateLabel, money } from "../lib/finance";
import { exportCsv } from "../lib/csv";
import { supabase } from "../lib/supabase";
import type { Field, Row, Table } from "../types";
export function EntityPage({
  table,
  title,
  subtitle,
  fields,
  extra,
}: {
  table: Table;
  title: string;
  subtitle: string;
  fields: Field[];
  extra?: ReactNode;
}) {
  const s = useStore();
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
  const rows = s
    .current(table)
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
                  fields.map((f) => [
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
        {rows.map((r) => (
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
            <div className="entity-end">
              {r.amount !== undefined && <strong>{money(r.amount)}</strong>}
              {r.status !== undefined && (
                <span className="badge">{String(r.status)}</span>
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
          onClose={() => setSelected(null)}
        >
          <dl className="details">
            {fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {f.relation
                    ? String(
                        s
                          .current(f.relation)
                          .find((r) => r.id === selected[f.key])?.name ||
                          s
                            .current(f.relation)
                            .find((r) => r.id === selected[f.key])?.title ||
                          "—",
                      )
                    : f.type === "date"
                      ? dateLabel(selected[f.key])
                      : f.type === "number" && f.key.includes("amount")
                        ? money(selected[f.key])
                        : String(selected[f.key] || "—")}
                </dd>
              </div>
            ))}
          </dl>
          <Attachments entity={table} id={selected.id} />
        </Modal>
      )}
    </>
  );
}
export function EntityForm({
  table,
  title,
  fields,
  row,
  onClose,
}: {
  table: Table;
  title: string;
  fields: Field[];
  row?: Row;
  onClose: () => void;
}) {
  const s = useStore();
  const [values, setValues] = useState<Record<string, unknown>>(
    row
      ? { ...row }
      : Object.fromEntries(
          fields
            .filter((f) => f.options || f.choices)
            .map((f) => [f.key, f.options?.[0] || f.choices?.[0]?.value]),
        ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const payload = Object.fromEntries(
              fields.map((f) => [
                f.key,
                values[f.key] === "" || values[f.key] === undefined
                  ? null
                  : f.type === "number"
                    ? Number(values[f.key])
                    : values[f.key],
              ]),
            );
            await s.save(table, payload, row?.id);
            onClose();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {fields.map((f) => (
            <label key={f.key} className={f.type === "textarea" ? "full" : ""}>
              {f.label}
              {f.required ? " *" : ""}
              {f.relation || f.options || f.choices ? (
                <select
                  required={f.required}
                  value={String(values[f.key] || "")}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                >
                  <option value="">Selecione</option>
                  {f.relation
                    ? s.current(f.relation).map((r) => (
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
          ))}
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
    </Modal>
  );
}
export function Attachments({ entity, id }: { entity: string; id: string }) {
  const s = useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attachments = s
    .current("attachments")
    .filter((a) => a.entity === entity && a.entity_id === id);
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
