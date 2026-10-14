import { monthKey, monthLabel } from "../../lib/periods";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useStore, message } from "../../app/Store";
import { Modal } from "../../components/Modal";
import { Attachments, EntityForm } from "../../components/EntityPage";
import {
  balance,
  cents,
  dateLabel,
  money,
  paymentState,
  today,
} from "../../lib/finance";
import { ReceiptReference } from "./ReceiptReference";
import { receiptOrigin } from "./origin";
import type { Row } from "../../types";
export function PaymentsPage() {
  const s = useStore();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "paid" ? "paid" : "pending",
  );
  const requestFilter = params.get("requisicao");
  const requestedTab = params.get("tab");
  const paymentMonth = monthKey(params.get("mes"));
  useEffect(() => {
    setTab(requestedTab === "paid" ? "paid" : "pending");
  }, [requestedTab, s.panelId]);
  const [search, setSearch] = useState("");
  const [pay, setPay] = useState<Row | true | null>(null);
  const [add, setAdd] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [editingDate, setEditingDate] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setPay(null);
    setAdd(false);
    setDetail(null);
    setEditingDate(null);
  }, [s.panelId]);
  const rows = s
    .current("receivables")
    .filter((r) => r.status !== "cancelled")
    .map(
      (r) =>
        ({
          ...r,
          remaining: balance(
            r,
            s.current("payment_allocations"),
            s.current("payments"),
          ),
        }) as Row & { remaining: number },
    )
    .filter(
      (r) =>
        cents(r.remaining) > 0 &&
        (!params.get("filter") || paymentState(r, r.remaining) === "Vencido"),
    )
    .filter(
      (r) =>
        !requestFilter ||
        receiptOrigin(r, s.data).request?.id === requestFilter,
    )
    .filter((r) =>
      `${r.title} ${receiptOrigin(r, s.data).label} ${receiptOrigin(r, s.data).tickets} ${s.current("clients").find((c) => c.id === r.client_id)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const visiblePayments = s
    .current("payments")
    .filter(
      (p) =>
        !requestFilter ||
        s
          .current("payment_allocations")
          .some(
            (a) =>
              a.payment_id === p.id &&
              s
                .current("receivables")
                .some(
                  (r) =>
                    r.id === a.receivable_id &&
                    receiptOrigin(r, s.data).request?.id === requestFilter,
                ),
          ),
    )
    .filter((p) => !paymentMonth || monthKey(p.paid_date) === paymentMonth);
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">CONTROLE FINANCEIRO</span>
          <h1>Recebimentos</h1>
          <p>Confira cada depósito e acompanhe o saldo dos serviços.</p>
        </div>
        {s.role !== "viewer" && (
          <button className="primary" onClick={() => setPay(true)}>
            <Plus size={18} />
            Registrar pagamento
          </button>
        )}
      </header>
      <div className="list-toolbar">
        <div className="tabs">
          <button
            className={tab === "pending" ? "active" : ""}
            onClick={() => setTab("pending")}
          >
            Pendentes
          </button>
          <button
            className={tab === "paid" ? "active" : ""}
            onClick={() => setTab("paid")}
          >
            Pagamentos
          </button>
        </div>
        {s.role !== "viewer" && (
          <button className="secondary" onClick={() => setAdd(true)}>
            Nova cobrança
          </button>
        )}
      </div>
      {paymentMonth && tab === "paid" && (
        <div className="notice">
          Pagamentos de {monthLabel(paymentMonth)} ·{" "}
          <Link to="/receber?tab=paid">Ver todos os meses</Link>
        </div>
      )}
      {requestFilter && (
        <div className="notice">
          Recebimentos da requisição{" "}
          {String(
            s.current("billing_requests").find((r) => r.id === requestFilter)
              ?.order_number || "",
          )}{" "}
          · <Link to="/receber">Ver todos</Link>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "pending" ? (
        <>
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Pesquisar cobranças"
              placeholder="Pesquisar cliente, requisição, nota ou chamado"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="entity-list">
            {rows.map((r) => (
              <article className="entity-card" key={r.id}>
                <div>
                  <h3>{String(r.title)}</h3>
                  <p>
                    {String(
                      s.current("clients").find((c) => c.id === r.client_id)
                        ?.name || "Cliente",
                    )}{" "}
                    · Vencimento {dateLabel(r.due_date)}
                  </p>
                </div>
                <ReceiptReference receivable={r} />
                <div className="entity-end">
                  <strong>{money(r.remaining)}</strong>
                  <span
                    className={`badge ${paymentState(r, r.remaining) === "Vencido" ? "red" : ""}`}
                  >
                    {paymentState(r, r.remaining)}
                  </span>
                  {s.role !== "viewer" && (
                    <button className="secondary" onClick={() => setPay(r)}>
                      Receber
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!rows.length && (
            <div className="empty">Nenhuma pendência para este filtro.</div>
          )}
        </>
      ) : (
        <div className="entity-list">
          {visiblePayments.map((p) => (
            <article className="entity-card" key={p.id}>
              <button className="entity-main" onClick={() => setDetail(p)}>
                <div>
                  <h3>
                    {String(
                      s.current("clients").find((c) => c.id === p.client_id)
                        ?.name || "Cliente",
                    )}
                  </h3>
                  <p>
                    {dateLabel(p.paid_date)} · {String(p.method)} ·{" "}
                    {p.status === "reversed" ? "Revertido" : "Confirmado"}
                  </p>
                </div>
              </button>
              <div className="payment-origins">
                {s
                  .current("payment_allocations")
                  .filter((a) => a.payment_id === p.id)
                  .map((a) => {
                    const r = s.data.receivables.find(
                      (r) =>
                        r.id === a.receivable_id && r.panel_id === s.panelId,
                    );
                    return (
                      r && (
                        <div key={a.id}>
                          <ReceiptReference receivable={r} />
                          <small>
                            Recebido nesta cobrança: {money(a.amount)}
                          </small>
                        </div>
                      )
                    );
                  })}
              </div>
              <div className="entity-end">
                <strong>{money(p.amount)}</strong>
                {s.role !== "viewer" && p.status === "active" && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingDate(p)}
                  >
                    Editar data
                  </button>
                )}
                {s.role === "admin" && p.status !== "reversed" && (
                  <button
                    className="link"
                    onClick={async () => {
                      const reason = prompt("Motivo da reversão:");
                      if (!reason) return;
                      try {
                        await s.reversePayment(p.id, reason);
                      } catch (e) {
                        setError(message(e));
                      }
                    }}
                  >
                    Reverter
                  </button>
                )}
              </div>
            </article>
          ))}
          {!visiblePayments.length && (
            <div className="empty">Nenhum pagamento registrado.</div>
          )}
        </div>
      )}
      {editingDate && (
        <PaymentDateForm
          payment={editingDate}
          onClose={() => setEditingDate(null)}
        />
      )}
      {pay && (
        <PaymentForm
          initial={typeof pay === "object" ? pay : undefined}
          onClose={() => setPay(null)}
          onDone={(id) => {
            setPay(null);
            setTab("paid");
            setDetail(
              s.current("payments").find((p) => p.id === id) || {
                id,
                panel_id: s.panelId,
                created_at: "",
                title: "Pagamento registrado",
              },
            );
          }}
        />
      )}
      {add && (
        <EntityForm
          table="receivables"
          title="Nova cobrança"
          onClose={() => setAdd(false)}
          fields={[
            { key: "title", label: "Descrição", required: true },
            {
              key: "client_id",
              label: "Cliente",
              relation: "clients",
              required: true,
            },
            {
              key: "amount",
              label: "Valor esperado",
              type: "number",
              required: true,
            },
            { key: "due_date", label: "Vencimento", type: "date" },
            {
              key: "invoice_id",
              label: "Nota vinculada",
              relation: "invoices",
            },
            { key: "status", label: "Situação", options: ["active"] },
          ]}
        />
      )}{" "}
      {detail && (
        <Modal title="Pagamento e comprovantes" onClose={() => setDetail(null)}>
          <p>Pagamento registrado. Anexe os documentos opcionais abaixo.</p>
          {s
            .current("payment_allocations")
            .filter((a) => a.payment_id === detail.id)
            .map((a) => (
              <div className="summary-row" key={a.id}>
                <div>
                  {String(
                    s.data.receivables.find((r) => r.id === a.receivable_id)
                      ?.title || "Cobrança arquivada",
                  )}
                  {(() => {
                    const r = s.data.receivables.find(
                      (r) =>
                        r.id === a.receivable_id && r.panel_id === s.panelId,
                    );
                    return r && <ReceiptReference receivable={r} />;
                  })()}
                </div>
                <strong>{money(a.amount)}</strong>
              </div>
            ))}
          <Attachments entity="payments" id={detail.id} />
        </Modal>
      )}
    </>
  );
}
function PaymentDateForm({
  payment,
  onClose,
}: {
  payment: Row;
  onClose: () => void;
}) {
  const s = useStore();
  const [date, setDate] = useState(String(payment.paid_date || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Alterar data de recebimento"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await s.updatePaymentDate(payment.id, date);
            onClose();
          } catch (error) {
            setError(message(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          {String(
            s.current("clients").find((c) => c.id === payment.client_id)
              ?.name || "Cliente",
          )}{" "}
          · {money(payment.amount)} · {String(payment.method)}
        </p>
        <label>
          Data de recebimento
          <input
            type="date"
            required
            value={date}
            disabled={busy}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar data"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PaymentForm({
  onClose,
  onDone,
  initial,
}: {
  initial?: Row;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const s = useStore();
  const [client, setClient] = useState(String(initial?.client_id || ""));
  const [selectedReceipt, setSelectedReceipt] = useState(initial?.id || "");
  const [amount, setAmount] = useState(
    initial ? String(initial.remaining) : "",
  );
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("PIX");
  const [notes, setNotes] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>(
    initial ? { [initial.id]: String(initial.remaining) } : {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const rs = s
    .current("receivables")
    .filter((r) => r.client_id === client && r.status !== "cancelled")
    .map(
      (r) =>
        ({
          ...r,
          remaining: balance(
            r,
            s.current("payment_allocations"),
            s.current("payments"),
          ),
        }) as Row & { remaining: number },
    )
    .filter((r) => cents(r.remaining) > 0);
  const allocated =
    Object.values(alloc).reduce((n, v) => n + cents(v), 0) / 100;
  return (
    <Modal
      title="Registrar pagamento"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!Object.values(alloc).some((v) => Number(v) > 0))
              throw new Error(
                "Selecione uma requisição/nota ou cobrança e informe o valor recebido para ela.",
              );
            const id = await s.recordPayment({
              client_id: client,
              amount: Number(amount),
              paid_date: date,
              method,
              notes,
              allocations: Object.entries(alloc)
                .filter(([, v]) => Number(v) > 0)
                .map(([id, v]) => ({ receivable_id: id, amount: Number(v) })),
              key,
            });
            onDone(id);
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Cliente
            <select
              required
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                setAlloc({});
                setSelectedReceipt("");
              }}
            >
              <option value="">Selecione</option>
              {s.current("clients").map((c) => (
                <option value={c.id} key={c.id}>
                  {String(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor recebido
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                setAmount(value);
                const selected = rs.find((r) => r.id === selectedReceipt);
                if (
                  selected &&
                  !Object.entries(alloc).some(
                    ([id, v]) => id !== selectedReceipt && Number(v) > 0,
                  )
                )
                  setAlloc((v) => ({
                    ...v,
                    [selectedReceipt]: String(
                      Math.min(cents(value), cents(selected.remaining)) / 100,
                    ),
                  }));
              }}
            />
          </label>
          <label>
            Data
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Forma
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {["PIX", "Transferência", "Dinheiro", "Cartão", "Outro"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
        </div>
        <label>
          Requisição / nota a receber
          <select
            value={selectedReceipt}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedReceipt(id);
              const receipt = rs.find((r) => r.id === id);
              if (!receipt) return;
              const otherAllocated = Object.entries(alloc)
                .filter(([key]) => key !== id)
                .reduce((n, [, v]) => n + cents(v), 0);
              const available = amount
                ? Math.max(0, cents(amount) - otherAllocated)
                : cents(receipt.remaining);
              if (!amount) setAmount(String(receipt.remaining));
              setAlloc((v) => ({
                ...v,
                [id]: String(
                  Math.min(cents(receipt.remaining), available) / 100,
                ),
              }));
            }}
          >
            <option value="">
              Selecione uma requisição / nota ou cobrança
            </option>
            {rs.map((r) => (
              <option key={r.id} value={r.id}>
                {receiptOrigin(r, s.data).label || String(r.title)} · Saldo{" "}
                {money(r.remaining)}
              </option>
            ))}
          </select>
        </label>
        <h3>Distribuir entre cobranças</h3>
        {rs.map((r) => (
          <label className="allocation" key={r.id}>
            <span>
              {String(r.title)}
              <ReceiptReference receivable={r} links={false} />
              <small>Saldo {money(r.remaining)}</small>
            </span>
            <input
              aria-label={`Valor para ${r.title}`}
              type="number"
              min="0"
              max={r.remaining}
              step="0.01"
              placeholder="0,00"
              value={alloc[r.id] || ""}
              onChange={(e) =>
                setAlloc((v) => ({ ...v, [r.id]: e.target.value }))
              }
            />
          </label>
        ))}
        <div className="notice">
          Distribuído: <strong>{money(allocated)}</strong> · A distribuir:{" "}
          <strong>{money(Number(amount) - allocated)}</strong>
        </div>
        <label>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted">
          Comprovante e cópias de notas podem ser anexados após salvar.
        </p>
        <div className="form-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Confirmando…" : "Confirmar recebimento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
