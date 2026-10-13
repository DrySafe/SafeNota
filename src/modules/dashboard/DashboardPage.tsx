import {
  ArrowUpRight,
  Wallet,
  Clock3,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ReceiptReference } from "../payments/ReceiptReference";
import type { Row } from "../../types";
import { useStore } from "../../app/Store";
import {
  balance,
  cents,
  dateLabel,
  money,
  paymentState,
  today,
} from "../../lib/finance";
export function DashboardPage() {
  const s = useStore();
  const rs = s.current("receivables").filter((r) => r.status !== "cancelled");
  const ps = s.current("payments").filter((p) => p.status !== "reversed");
  const as = s.current("payment_allocations");
  const pending = rs
    .map(
      (r) =>
        ({ ...r, balance: balance(r, as, ps) }) as Row & { balance: number },
    )
    .filter((r) => cents(r.balance) > 0);
  const overdue = pending.filter(
    (r) => paymentState(r, r.balance) === "Vencido",
  );
  const received =
    ps
      .filter((p) => String(p.paid_date).startsWith(today().slice(0, 7)))
      .reduce((n, p) => n + cents(p.amount), 0) / 100;
  const undistributed =
    ps.reduce(
      (n, p) =>
        n +
        cents(p.amount) -
        as
          .filter((a) => a.payment_id === p.id)
          .reduce((v, a) => v + cents(a.amount), 0),
      0,
    ) / 100;
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">VISÃO GERAL · {s.panel?.name}</span>
          <h1>Seu trabalho, em dia.</h1>
          <p>Acompanhe o que falta faturar e o que você tem a receber.</p>
        </div>
        <Link className="primary" to="/receber">
          Registrar pagamento <ArrowUpRight size={18} />
        </Link>
      </header>
      <section className="stats">
        <Link to="/receber" className="stat">
          <Wallet />
          <span>A receber</span>
          <strong>
            {money(pending.reduce((n, r) => n + cents(r.balance), 0) / 100)}
          </strong>
          <small>{pending.length} cobranças pendentes</small>
        </Link>
        <Link to="/receber?filter=overdue" className="stat danger">
          <Clock3 />
          <span>Vencido</span>
          <strong>
            {money(overdue.reduce((n, r) => n + cents(r.balance), 0) / 100)}
          </strong>
          <small>{overdue.length} precisam de atenção</small>
        </Link>
        <Link to="/receber?tab=paid" className="stat">
          <CheckCircle2 />
          <span>Recebido neste mês</span>
          <strong>{money(received)}</strong>
          <small>{money(undistributed)} a distribuir</small>
        </Link>
        <Link to="/requisicoes" className="stat">
          <FileText />
          <span>Requisições a gerar</span>
          <strong>
            {
              s
                .current("billing_requests")
                .filter((r) => r.status === "A gerar").length
            }
          </strong>
          <small>Confira antes de emitir</small>
        </Link>
      </section>
      <div className="dashboard-grid">
        <section className="surface">
          <div className="section-heading">
            <h2>Próximos recebimentos</h2>
            <Link to="/receber">
              Ver todos <ArrowUpRight size={16} />
            </Link>
          </div>
          {pending.length ? (
            pending.slice(0, 6).map((r) => (
              <Link to="/receber" className="summary-row" key={r.id}>
                <div>
                  <strong>{String(r.title)}</strong>
                  <small>
                    {String(
                      s.current("clients").find((c) => c.id === r.client_id)
                        ?.name || "Cliente",
                    )}{" "}
                    · {dateLabel(r.due_date)}
                  </small>
                  <ReceiptReference receivable={r} links={false} />
                </div>
                <div>
                  <strong>{money(r.balance)}</strong>
                  <span
                    className={`badge ${paymentState(r, r.balance) === "Vencido" ? "red" : ""}`}
                  >
                    {paymentState(r, r.balance)}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty">Nenhuma cobrança pendente neste painel.</div>
          )}
        </section>
        <section className="surface">
          <h2>Seu próximo passo</h2>
          <Link className="task-link" to="/integracoes">
            <span>Revisar e-mails capturados</span>
            <strong>
              {
                s
                  .current("captured_messages")
                  .filter((r) => r.status === "pending").length
              }
            </strong>
          </Link>
          <Link className="task-link" to="/requisicoes">
            <span>Preparar notas das requisições</span>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="task-link" to="/requisicoes">
            <span>Conferir notas das requisições</span>
            <ArrowUpRight size={18} />
          </Link>
          <Link className="task-link" to="/contratos">
            <span>Conferir contratos mensais</span>
            <ArrowUpRight size={18} />
          </Link>
          <p className="muted">
            Cada recebimento fica ligado à sua origem. Assim, nenhum serviço se
            perde no caminho.
          </p>
        </section>
      </div>
    </>
  );
}
