import { notesForService } from "../services/links";
import { useEffect, useState } from "react";
import { monthKey, monthLabel, saleMonth } from "../../lib/periods";
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
  const [month, setMonth] = useState("all");
  useEffect(() => setMonth("all"), [s.panelId]);
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
  const selectedPayments = ps.filter(
    (p) => month === "all" || monthKey(p.paid_date) === month,
  );
  const selectedSales = rs.filter(
    (r) => month === "all" || saleMonth(r, s.data.invoices) === month,
  );
  const sales = selectedSales.reduce((n, r) => n + cents(r.amount), 0) / 100;
  const months = [
    ...new Set(
      [
        today().slice(0, 7),
        ...ps.map((p) => monthKey(p.paid_date)),
        ...rs.map((r) => saleMonth(r, s.data.invoices)),
      ].filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
  const received =
    selectedPayments.reduce((n, p) => n + cents(p.amount), 0) / 100;
  const receivedThisMonth =
    ps
      .filter((p) => String(p.paid_date).startsWith(today().slice(0, 7)))
      .reduce((n, p) => n + cents(p.amount), 0) / 100;
  const undistributed =
    selectedPayments.reduce(
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
      <div className="period-toolbar">
        <label>
          Mês do resumo
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">Todos os meses</option>
            {months.map((key) => (
              <option key={key} value={key}>
                {monthLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Recebido e vendas seguem o período selecionado. A receber e vencido
          incluem todos os meses.
        </p>
      </div>
      <section className="stats">
        <Link to="/receber" className="stat">
          <Wallet />
          <span>A receber</span>
          <strong>
            {money(pending.reduce((n, r) => n + cents(r.balance), 0) / 100)}
          </strong>
          <small>{pending.length} cobranças pendentes · Todos os meses</small>
        </Link>
        <Link to="/receber?filter=overdue" className="stat danger">
          <Clock3 />
          <span>Vencido</span>
          <strong>
            {money(overdue.reduce((n, r) => n + cents(r.balance), 0) / 100)}
          </strong>
          <small>{overdue.length} precisam de atenção · Todos os meses</small>
        </Link>
        <Link
          to={`/receber?tab=paid${month === "all" ? "" : `&mes=${month}`}`}
          className="stat"
        >
          <CheckCircle2 />
          <span>Recebido</span>
          <strong>{money(received)}</strong>
          <small>
            {month === "all"
              ? `${money(receivedThisMonth)} neste mês`
              : monthLabel(month)}{" "}
            · {money(undistributed)} a distribuir
          </small>
        </Link>
        <article className="stat">
          <Wallet />
          <span>Total de vendas</span>
          <strong>{money(sales)}</strong>
          <small>
            {month === "all" ? "Todos os meses" : monthLabel(month)} ·{" "}
            {selectedSales.length} cobranças
          </small>
        </article>
        <Link to="/servicos?situacao=sem-nota" className="stat">
          <FileText />
          <span>Serviços sem nota</span>
          <strong>
            {
              s
                .current("services")
                .filter(
                  (service) =>
                    !notesForService(
                      service.id,
                      s.current("invoice_services"),
                      s.current("invoices"),
                    ).some((note) => note.status === "Gerada"),
                ).length
            }
          </strong>
          <small>Todos os meses · Prepare a requisição de nota</small>
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
