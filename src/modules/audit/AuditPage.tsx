import { useAuth } from "../auth/Auth";
import { auditPresentation } from "./presentation";
import { useStore } from "../../app/Store";
import { dateLabel } from "../../lib/finance";
export function AuditPage() {
  const s = useStore();
  const { user } = useAuth();
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
        {s.current("audit_events").map((r) => {
          const entry = auditPresentation(r, s.data, user || undefined);
          return (
            <div className="summary-row" key={r.id}>
              <div>
                <strong>{entry.title}</strong>
                <small>{entry.label}</small>
                <small>Autor: {entry.actor}</small>
                {entry.detail && <small>{entry.detail}</small>}
                {paymentDateChange(r.changes) && (
                  <small>{paymentDateChange(r.changes)}</small>
                )}
              </div>
              <span>{dateLabel(r.created_at)}</span>
            </div>
          );
        })}
        {!s.current("audit_events").length && (
          <p className="muted">Ainda não há alterações registradas.</p>
        )}
      </div>
    </>
  );
}

function paymentDateChange(changes: unknown) {
  if (!changes || typeof changes !== "object") return null;
  const { before, after } = changes as {
    before?: { paid_date?: string };
    after?: { paid_date?: string };
  };
  return before?.paid_date &&
    after?.paid_date &&
    before.paid_date !== after.paid_date
    ? `Data do recebimento: ${dateLabel(before.paid_date)} → ${dateLabel(after.paid_date)}`
    : null;
}
