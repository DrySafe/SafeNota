import { useEffect, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { EntityPage } from "../../components/EntityPage";
import { Modal } from "../../components/Modal";
import { useStore, message } from "../../app/Store";
import { useAuth } from "../auth/Auth";
import { supabase } from "../../lib/supabase";
import { extractEmail } from "./extract";
import type { Row } from "../../types";
export function IntegrationsPage() {
  const s = useStore();
  const { demo } = useAuth();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connections, setConnections] = useState<
    { id: string; email: string }[]
  >([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [client, setClient] = useState("");
  const [text, setText] = useState("");
  const [kind, setKind] = useState("request");
  const [preview, setPreview] = useState("");
  const [edited, setEdited] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (!demo && supabase)
      supabase
        .from("gmail_accounts")
        .select("id,email")
        .eq("status", "active")
        .then((r) => {
          if (r.error) setNotice(message(r.error));
          else setConnections(r.data || []);
        });
  }, [demo, s.panelId]);
  async function invoke(action: string, body: Record<string, unknown> = {}) {
    if (demo)
      throw new Error(
        "Gmail real exige Supabase e credenciais OAuth configurados.",
      );
    const r = await supabase!.functions.invoke("gmail", {
      body: { action, panel_id: s.panelId, ...body },
    });
    if (r.error) throw r.error;
    if (r.data.error) throw new Error(r.data.error);
    return r.data;
  }
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">AUTOMAÇÃO COM REVISÃO</span>
          <h1>E-mails e integrações</h1>
          <p>Capture pedidos e chamados sem perder o controle dos dados.</p>
        </div>
      </header>
      <section className="surface">
        <div className="section-heading">
          <h2>
            <Mail size={20} /> Gmail
          </h2>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await invoke("connect");
                location.assign(r.url);
              } catch (e) {
                setNotice(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Conectar Google
          </button>
        </div>
        <p className="muted">
          Autorize sua própria conta. O SafeNota lê as mensagens dos remetentes
          configurados; você confirma os registros antes de cadastrar.
        </p>
        {connections.map((c) => (
          <div className="summary-row" key={c.id}>
            <div>{c.email}</div>
            <button
              className="link"
              onClick={async () => {
                if (!confirm("Desconectar esta conta?")) return;
                try {
                  await invoke("disconnect", { connection_id: c.id });
                  setConnections((cs) => cs.filter((v) => v.id !== c.id));
                } catch (e) {
                  setNotice(message(e));
                }
              }}
            >
              Desconectar
            </button>
          </div>
        ))}
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await invoke("sync");
              setNotice(
                `${r.captured} mensagens novas para revisar. ${(r.errors || []).join(" ")}`,
              );
              await s.refresh();
            } catch (e) {
              setNotice(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={16} />
          Buscar novos e-mails
        </button>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </section>
      <section className="surface">
        <h2>Revisão pendente</h2>
        {s
          .current("captured_messages")
          .filter((r) => r.status === "pending")
          .map((r) => (
            <button
              className="review-card"
              key={r.id}
              onClick={() => {
                setSelected(r);
                setClient("");
                setEdited(r.extracted as Record<string, unknown>);
              }}
            >
              <strong>{String(r.subject)}</strong>
              <span>{String(r.sender)}</span>
            </button>
          ))}
        {!s
          .current("captured_messages")
          .some((r) => r.status === "pending") && (
          <p className="muted">Nenhuma mensagem aguardando confirmação.</p>
        )}
      </section>
      <section className="surface">
        <h2>Testar extração</h2>
        <p>
          Cole uma mensagem para conferir os campos. Esta prévia não cria
          registros.
        </p>
        <label>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="request">Pedido de emissão</option>
            <option value="service">Transferência de chamado</option>
          </select>
        </label>
        <textarea
          aria-label="Mensagem de exemplo"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="secondary"
          onClick={() => {
            try {
              setPreview(JSON.stringify(extractEmail(text, kind), null, 2));
            } catch (e) {
              setNotice(message(e));
            }
          }}
        >
          Ver campos extraídos
        </button>
        {preview && <pre>{preview}</pre>}
      </section>
      <EntityPage
        table="email_rules"
        title="Regras de captura"
        subtitle="Cada remetente tem um destino e um formato de extração."
        fields={[
          { key: "title", label: "Nome da regra", required: true },
          {
            key: "connection_id",
            label: "Conta Gmail conectada",
            required: true,
            choices: connections.map((c) => ({ value: c.id, label: c.email })),
          },
          {
            key: "sender",
            label: "E-mail exato do remetente",
            type: "email",
            required: true,
          },
          {
            key: "kind",
            label: "Tipo",
            choices: [
              { value: "request", label: "Pedido de emissão" },
              { value: "service", label: "Transferência de chamado" },
            ],
          },
          { key: "keywords", label: "Palavras-chave (separadas por vírgula)" },
          {
            key: "patterns",
            label: "Padrões JSON (opcional; grupo 1 captura cada campo)",
            type: "textarea",
          },
          {
            key: "status",
            label: "Situação",
            choices: [
              { value: "active", label: "Ativa" },
              { value: "paused", label: "Pausada" },
            ],
          },
        ]}
      />
      {selected && (
        <Modal title="Confirmar captura" onClose={() => setSelected(null)}>
          <p>{String(selected.subject)}</p>
          <div className="form-grid">
            {[
              "title",
              "order_number",
              "ticket_number",
              "ticket_numbers",
              "reference",
              "amount",
            ].map((k) => (
              <label key={k}>
                {
                  (
                    {
                      title: "Descrição",
                      order_number: "Pedido",
                      ticket_number: "Chamado",
                      ticket_numbers: "Chamados",
                      reference: "Referência",
                      amount: "Valor",
                    } as Record<string, string>
                  )[k]
                }
                <input
                  type={k === "amount" ? "number" : "text"}
                  min={k === "amount" ? 0 : undefined}
                  step={k === "amount" ? "0.01" : undefined}
                  value={String(edited[k] ?? "")}
                  onChange={(e) =>
                    setEdited((v) => ({
                      ...v,
                      [k]:
                        k === "amount"
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Cliente
            <select
              required
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">Selecione</option>
              {s.current("clients").map((c) => (
                <option value={c.id} key={c.id}>
                  {String(c.name)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || !client}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await supabase!.rpc("confirm_capture", {
                  p_panel: s.panelId,
                  p_id: selected.id,
                  p_client: client,
                  p_extracted: edited,
                });
                if (r.error) throw r.error;
                await s.refresh();
                setSelected(null);
              } catch (e) {
                setNotice(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar cadastro
          </button>
        </Modal>
      )}
    </>
  );
}
