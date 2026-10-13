import { useState } from "react";
import { useStore, message } from "../../app/Store";
import type { Table } from "../../types";
const allowed: Table[] = [
  "clients",
  "services",
  "billing_requests",
  "contracts",
  "projects",
  "invoices",
  "receivables",
  "email_rules",
];
export function ArchivedPage() {
  const s = useStore();
  const [notice, setNotice] = useState("");
  if (s.role !== "admin")
    return (
      <div className="notice">
        Somente administradores podem restaurar registros.
      </div>
    );
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">EXCLUSÃO RECUPERÁVEL</span>
          <h1>Arquivados</h1>
          <p>O histórico permanece preservado.</p>
        </div>
      </header>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {allowed.flatMap((table) =>
        s.data[table]
          .filter((r) => r.panel_id === s.panelId && r.deleted_at)
          .map((r) => (
            <article className="entity-card" key={r.id}>
              <div>
                <h3>{String(r.name || r.title)}</h3>
                <small>{table}</small>
              </div>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await s.restore(table, r.id);
                    setNotice("Registro restaurado.");
                  } catch (e) {
                    setNotice(message(e));
                  }
                }}
              >
                Restaurar
              </button>
            </article>
          )),
      )}
    </>
  );
}
