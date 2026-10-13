import { useEffect, useState } from "react";
import { useStore, message } from "../../app/Store";
import { useAuth } from "../auth/Auth";
import { supabase } from "../../lib/supabase";
export function MembersPage() {
  const s = useStore();
  const { demo } = useAuth();
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>(
    [],
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    if (!demo && s.panelId) {
      const r = await supabase!
        .from("memberships")
        .select("user_id,role")
        .eq("panel_id", s.panelId);
      if (r.error) setNotice(message(r.error));
      else setMembers(r.data || []);
    }
  }
  useEffect(() => {
    setMembers([]);
    void load();
  }, [s.panelId, demo]);
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">ACESSO POR PAINEL</span>
          <h1>Equipe e convites</h1>
          <p>Cada usuário vê somente os painéis dos quais participa.</p>
        </div>
      </header>
      {s.role === "admin" && (
        <section className="surface">
          <h2>Convidar usuário</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                if (demo) throw new Error("Convites reais exigem Supabase.");
                const r = await supabase!.rpc("invite_member", {
                  p_panel: s.panelId,
                  p_email: email,
                  p_role: role,
                });
                if (r.error) throw r.error;
                setNotice(
                  `Código do convite: ${r.data}. Compartilhe com o destinatário; válido por 7 dias.`,
                );
              } catch (e) {
                setNotice(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label>
                E-mail
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Papel
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="admin">Administrador</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Consulta</option>
                </select>
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Criar convite
            </button>
          </form>
        </section>
      )}
      <section className="surface">
        <h2>Membros de {s.panel?.name}</h2>
        {demo ? (
          <p>Demonstração: você é administrador deste painel.</p>
        ) : (
          members.map((m) => (
            <div className="summary-row" key={m.user_id}>
              <span>{m.user_id}</span>
              {s.role === "admin" ? (
                <>
                  <select
                    aria-label="Papel do membro"
                    value={m.role}
                    onChange={async (e) => {
                      try {
                        const r = await supabase!.rpc("change_member", {
                          p_panel: s.panelId,
                          p_user: m.user_id,
                          p_role: e.target.value,
                        });
                        if (r.error) throw r.error;
                        await load();
                        await s.refresh();
                      } catch (e) {
                        setNotice(message(e));
                      }
                    }}
                  >
                    {["admin", "operator", "viewer"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <button
                    className="link"
                    onClick={async () => {
                      if (!confirm("Remover acesso a este painel?")) return;
                      try {
                        const r = await supabase!.rpc("change_member", {
                          p_panel: s.panelId,
                          p_user: m.user_id,
                          p_role: null,
                        });
                        if (r.error) throw r.error;
                        await load();
                        await s.refresh();
                      } catch (e) {
                        setNotice(message(e));
                      }
                    }}
                  >
                    Remover
                  </button>
                </>
              ) : (
                <span>{m.role}</span>
              )}
            </div>
          ))
        )}
      </section>
      <section className="surface">
        <h2>Aceitar convite</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              if (demo) throw new Error("Convites reais exigem Supabase.");
              const r = await supabase!.rpc("accept_invitation", {
                p_token: code,
              });
              if (r.error) throw r.error;
              await s.refresh();
              setNotice("Convite aceito. O painel está disponível no seletor.");
              setCode("");
            } catch (e) {
              setNotice(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Código do convite
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="secondary" disabled={busy}>
            Aceitar convite
          </button>
        </form>
      </section>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
