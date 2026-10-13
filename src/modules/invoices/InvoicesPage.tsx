import { useState } from "react";
import { EntityPage } from "../../components/EntityPage";
import { Modal } from "../../components/Modal";
import { useStore, message } from "../../app/Store";
import { useAuth } from "../auth/Auth";
import { supabase } from "../../lib/supabase";
import { money } from "../../lib/finance";
import { parseInvoice, readInvoiceFiles, type ParsedInvoice } from "./xml";
interface Item {
  name: string;
  xml: string;
  invoice?: ParsedInvoice;
  error?: string;
  client: string;
  receivable: string;
  result?: string;
}
export function InvoicesPage() {
  const s = useStore();
  const { demo } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(files: File[]) {
    setError("");
    setBusy(true);
    try {
      const list = await readInvoiceFiles(files);
      const seen = new Set<string>();
      setItems(
        list.map((f) => {
          try {
            const invoice = parseInvoice(f.xml);
            if (seen.has(invoice.fiscal_key))
              throw new Error("Nota duplicada no lote.");
            seen.add(invoice.fiscal_key);
            return {
              ...f,
              invoice,
              client:
                s
                  .current("clients")
                  .find(
                    (c) =>
                      String(c.document || "").replace(/\D/g, "") ===
                      invoice.client_document,
                  )?.id || "",
              receivable: "",
            };
          } catch (e) {
            return { ...f, error: message(e), client: "", receivable: "" };
          }
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function importAll() {
    setBusy(true);
    setError("");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.invoice || item.result?.startsWith("Importada") || !item.client)
        continue;
      try {
        const inv = item.invoice;
        const duplicate = s
          .current("invoices")
          .some((r) => r.fiscal_key === inv.fiscal_key);
        if (duplicate) throw new Error("Já existente neste painel.");
        const request = s
          .current("billing_requests")
          .find(
            (r) =>
              r.order_number === inv.order_number &&
              r.client_id === item.client,
          );
        let id: string;
        const registered = request
          ? s
              .current("invoices")
              .filter(
                (note) =>
                  note.client_id === item.client &&
                  note.request_id === request.id &&
                  note.number === inv.number &&
                  note.status === "Gerada" &&
                  !note.fiscal_key,
              )
          : [];
        if (registered.length > 1)
          throw new Error(
            "Há várias notas com este número na requisição. Confira os vínculos antes de importar.",
          );
        if (registered.length === 1) {
          if (item.receivable)
            throw new Error(
              "Esta nota já possui cobrança vinculada. Não selecione outra cobrança para o XML.",
            );
          id = await s.save(
            "invoices",
            {
              ...inv,
              client_id: item.client,
              request_id: request!.id,
              status: "Gerada",
            },
            registered[0].id,
          );
        } else if (demo) {
          id = await s.save("invoices", {
            _receivable_id: item.receivable,
            title: inv.title,
            number: inv.number,
            fiscal_key: inv.fiscal_key,
            issuer_document: inv.issuer_document,
            description: inv.description,
            amount: inv.amount,
            net_amount: inv.net_amount,
            issue_date: inv.issue_date,
            competence: inv.competence,
            client_id: item.client,
            request_id: request?.id || null,
            status: "Gerada",
          });
        } else {
          const r = await supabase!.rpc("import_invoice", {
            p_panel: s.panelId,
            p_invoice: {
              ...inv,
              client_id: item.client,
              request_id: request?.id || null,
            },
            p_receivable: item.receivable || null,
          });
          if (r.error) throw r.error;
          id = r.data;
          try {
            await s.attach(
              new File([item.xml], item.name.split("/").pop() || "nota.xml", {
                type: "application/xml",
              }),
              "invoices",
              id,
            );
          } catch (e) {
            setItems((old) =>
              old.map((v, n) =>
                n === i
                  ? { ...v, result: `Importada; anexo pendente: ${message(e)}` }
                  : v,
              ),
            );
            continue;
          }
        }
        setItems((old) =>
          old.map((v, n) => (n === i ? { ...v, result: "Importada" } : v)),
        );
      } catch (e) {
        setItems((old) =>
          old.map((v, n) => (n === i ? { ...v, result: message(e) } : v)),
        );
      }
    }
    await s.refresh();
    setBusy(false);
  }
  return (
    <>
      <EntityPage
        table="invoices"
        title="Notas fiscais"
        subtitle="Documentos fiscais vinculados aos serviços e recebimentos."
        extra={
          <>
            <div className="notice">
              {s.role !== "viewer" && (
                <button
                  className="secondary"
                  onClick={() => {
                    setOpen(true);
                    setItems([]);
                    setError("");
                  }}
                >
                  Importar XML em lote
                </button>
              )}{" "}
              A emissão é feita no portal oficial. O upload não verifica
              cancelamento no emissor.
            </div>
            {s.role === "admin" && (
              <section className="surface">
                <h2>Registrar cancelamento</h2>
                <p className="muted">
                  Registre aqui após cancelar no emissor oficial. Notas com
                  recebimentos exigem ajuste prévio.
                </p>
                {s
                  .current("invoices")
                  .filter((r) => r.status === "Gerada")
                  .map((r) => (
                    <div className="summary-row" key={r.id}>
                      <span>
                        {String(r.title)} · {money(r.net_amount)}
                      </span>
                      <button
                        className="link"
                        onClick={async () => {
                          const reason = prompt(
                            "Motivo do cancelamento fiscal:",
                          );
                          if (!reason) return;
                          try {
                            await s.cancelInvoice(r.id, reason);
                          } catch (e) {
                            setError(message(e));
                          }
                        }}
                      >
                        Registrar cancelamento
                      </button>
                    </div>
                  ))}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
              </section>
            )}
          </>
        }
        fields={[
          { key: "title", label: "Descrição", required: true },
          { key: "number", label: "Número da nota", required: true },
          {
            key: "client_id",
            label: "Cliente",
            relation: "clients",
            required: true,
          },
          {
            key: "request_id",
            label: "Requisição de nota",
            relation: "billing_requests",
          },
          { key: "_service_ids", label: "Serviços", type: "service-list" },
          { key: "fiscal_key", label: "Chave fiscal" },
          {
            key: "amount",
            label: "Valor bruto",
            type: "number",
            required: true,
          },
          {
            key: "net_amount",
            label: "Valor líquido",
            type: "number",
            required: true,
          },
          { key: "issue_date", label: "Emissão", type: "date", required: true },
          { key: "status", label: "Situação fiscal", options: ["Gerada"] },
          {
            key: "description",
            label: "Descrição dos serviços",
            type: "textarea",
          },
        ]}
      />
      {open && (
        <Modal
          title="Importar notas fiscais"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>
            Selecione XMLs ou ZIP. Escolha uma cobrança existente para
            contratos, evitando duplicar a mensalidade.
          </p>
          <input
            type="file"
            multiple
            accept=".xml,.zip"
            disabled={busy}
            onChange={(e) => void load(Array.from(e.target.files || []))}
          />
          {items.map((item, i) => (
            <div className="import-item" key={i}>
              <strong>{item.name}</strong>
              {item.invoice ? (
                <>
                  <p>
                    {item.invoice.client_name} ·{" "}
                    {money(item.invoice.net_amount)} · Pedido{" "}
                    {item.invoice.order_number || "não identificado"}
                  </p>
                  <label>
                    Cliente
                    <select
                      value={item.client}
                      disabled={busy}
                      onChange={(e) =>
                        setItems((old) =>
                          old.map((v, n) =>
                            n === i
                              ? { ...v, client: e.target.value, receivable: "" }
                              : v,
                          ),
                        )
                      }
                    >
                      <option value="">Selecione o cliente</option>
                      {s.current("clients").map((c) => (
                        <option key={c.id} value={c.id}>
                          {String(c.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vincular cobrança
                    <select
                      value={item.receivable}
                      disabled={busy}
                      onChange={(e) =>
                        setItems((old) =>
                          old.map((v, n) =>
                            n === i ? { ...v, receivable: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      <option value="">Criar cobrança da nota</option>
                      {s
                        .current("receivables")
                        .filter(
                          (r) => r.client_id === item.client && !r.invoice_id,
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {String(r.title)} · {money(r.amount)}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              ) : (
                <p className="error">{item.error}</p>
              )}
              {item.result && <p role="status">{item.result}</p>}
            </div>
          ))}
          {demo && (
            <p className="notice">
              Demonstração: o XML é lido, mas não será armazenado.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={
              busy || !items.some((i) => i.invoice && i.client && !i.result)
            }
            onClick={() => void importAll()}
          >
            {busy ? "Processando…" : "Confirmar importação"}
          </button>
        </Modal>
      )}
    </>
  );
}
