import { useStore } from "../../app/Store";
import { dateLabel } from "../../lib/finance";
export function AuditPage() {
  const s = useStore();
  if (s.role !== "admin")
    return (
      <div className="notice">
        Histórico disponível somente aos administradores.
      </div>
    );
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">RASTREABILIDADE</span>
          <h1>Histórico de alterações</h1>
          <p>Criações, edições, pagamentos e exclusões preservados.</p>
        </div>
      </header>
      <div className="surface">
        {s.current("audit_events").map((r) => (
          <div className="summary-row" key={r.id}>
            <div>
              <strong>
                {String(r.action)} · {String(r.entity)}
              </strong>
              <small>
                {String(r.entity_id)} · Autor: {String(r.actor_id)}
              </small>
            </div>
            <span>{dateLabel(r.created_at)}</span>
          </div>
        ))}
        {!s.current("audit_events").length && (
          <p className="muted">Ainda não há alterações registradas.</p>
        )}
      </div>
    </>
  );
}
