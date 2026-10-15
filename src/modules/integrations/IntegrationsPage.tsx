import { matchingServices, matchingRequests } from "./duplicates";
import { emailRuleFields, type EmailKind } from "./ruleFields";
import { useEffect, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { EntityPage, EntityForm } from "../../components/EntityPage";
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
  const [newRule, setNewRule] = useState<EmailKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchDays, setSearchDays] = useState("30");
  const days = Number(searchDays);
  const validDays = Number.isInteger(days) && days >= 1 && days <= 365;
  const [connections, setConnections] = useState<
    { id: string; email: string }[]
  >([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [client, setClient] = useState("");
  const [text, setText] = useState("");
  const [kind, setKind] = useState("request");
  const [preview, setPreview] = useState("");
  const [previewNotice, setPreviewNotice] = useState("");
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
  const duplicateMatches =
    selected?.kind === "service" && client
      ? matchingServices(
          s.data.services,
          s.panelId,
          client,
          edited.ticket_number,
          edited.reference,
        )
      : selected?.kind === "request" && client
        ? matchingRequests(
            s.data.billing_requests,
            s.panelId,
            client,
            edited.order_number,
          )
        : [];
  const duplicateLabel =
    selected?.kind === "request"
      ? "requisição já cadastrada"
      : "serviço já cadastrado";
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
        <label>
          Buscar nos últimos (dias)
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            value={searchDays}
            disabled={busy}
            onChange={(event) => setSearchDays(event.target.value)}
          />
        </label>
        <p className="muted">
          Escolha de 1 a 365 dias. Um período menor reduz a busca. Mensagens já
          capturadas continuam protegidas contra duplicação.
        </p>
        <button
          className="secondary"
          disabled={busy || !validDays}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await invoke("sync", { days });
              setNotice(
                `Busca nos últimos ${days} dias: ${r.captured} mensagens novas para revisar. ${r.ignored || 0} duplicadas ignoradas. ${(r.errors || []).join(" ")}`,
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
                const rules = s
                  .current("email_rules")
                  .filter(
                    (rule) =>
                      rule.connection_id === r.connection_id &&
                      rule.kind === r.kind &&
                      String(rule.sender).trim().toLowerCase() ===
                        String(r.sender).trim().toLowerCase() &&
                      s
                        .current("clients")
                        .some((client) => client.id === rule.client_id),
                  );
                const destinations = [
                  ...new Set(rules.map((rule) => String(rule.client_id))),
                ];
                setClient(
                  s.current("clients").some((c) => c.id === r.client_id)
                    ? String(r.client_id)
                    : destinations.length === 1
                      ? destinations[0]
                      : "",
                );
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
      <details className="surface">
        <summary>
          Duplicados ignorados (
          {
            s
              .current("captured_messages")
              .filter(
                (r) =>
                  r.status === "ignored" &&
                  (r.duplicate_service_id || r.duplicate_request_id),
              ).length
          }
          )
        </summary>
        {s
          .current("captured_messages")
          .filter(
            (r) =>
              r.status === "ignored" &&
              (r.duplicate_service_id || r.duplicate_request_id),
          )
          .map((r) => (
            <div className="summary-row" key={r.id}>
              <div>
                <strong>{String(r.subject)}</strong>
                <small>
                  {String(r.processing_note || "Serviço já cadastrado.")}
                </small>
              </div>
            </div>
          ))}
      </details>
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
              const extracted = extractEmail(text, kind);
              setPreview(JSON.stringify(extracted, null, 2));
              setPreviewNotice(
                kind === "service" && !extracted.description
                  ? "Este e-mail não informa a descrição do serviço. Você poderá completá-la na revisão do atendimento."
                  : "",
              );
            } catch (e) {
              setNotice(message(e));
            }
          }}
        >
          Ver campos extraídos
        </button>
        {previewNotice && (
          <p className="notice" role="status">
            {previewNotice}
          </p>
        )}
        {preview && <pre>{preview}</pre>}
      </section>
      <EntityPage
        table="email_rules"
        title="Regras de captura"
        subtitle="Cada remetente tem um destino e um formato de extração."
        fields={emailRuleFields(connections)}
        rowExtra={(rule) => (
          <>
            <span className="rule-sender">{String(rule.sender)}</span>
            <span className="badge">
              {rule.kind === "service"
                ? "Transferência de chamado"
                : "Requisição de nota"}
            </span>
          </>
        )}
        extra={
          <section className="surface">
            <h2>Adicionar remetentes por tipo</h2>
            <p>
              Cadastre uma regra para cada remetente e tipo de mensagem. Você
              pode ter vários endereços para o mesmo tipo, separados por cliente
              e estado.
            </p>
            <p className="muted">
              As sugestões Positivo abaixo são editáveis. O destino é o painel
              atual e o cliente escolhido. Novas regras começam pausadas para
              configuração.
            </p>
            {s.role === "admin" && (
              <div className="period-toolbar">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setNewRule("service")}
                >
                  Nova regra de chamados
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setNewRule("request")}
                >
                  Nova regra de requisições
                </button>
              </div>
            )}
          </section>
        }
      />
      {newRule && (
        <EntityForm
          table="email_rules"
          title={
            newRule === "service"
              ? "Nova regra de chamados"
              : "Nova regra de requisições"
          }
          fields={emailRuleFields(connections, newRule)}
          onClose={() => setNewRule(null)}
        />
      )}
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
          {duplicateMatches.length === 1 && (
            <p className="notice" role="status">
              Duplicidade identificada: {duplicateLabel}. A confirmação apenas
              ignorará esta captura, preservando o registro existente.
            </p>
          )}
          {duplicateMatches.length > 1 && (
            <p className="notice error" role="alert">
              Os identificadores correspondem a mais de um registro. Revise
              antes de continuar.
            </p>
          )}
          {Boolean(selected.processing_note) && (
            <p className="muted">{String(selected.processing_note)}</p>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              !client ||
              s.role === "viewer" ||
              duplicateMatches.length > 1
            }
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
                setNotice(
                  duplicateMatches.length === 1
                    ? `Captura ignorada: ${duplicateLabel}.`
                    : "Captura processada com verificação de duplicidade.",
                );
              } catch (e) {
                setNotice(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {duplicateMatches.length === 1
              ? `Ignorar: ${duplicateLabel}`
              : "Confirmar cadastro"}
          </button>
        </Modal>
      )}
    </>
  );
}
