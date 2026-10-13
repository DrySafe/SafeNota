import { useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  FileText,
  Wallet,
  Users,
  Mail,
  FolderKanban,
  ScrollText,
  ShieldCheck,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { useAuth, Login } from "../modules/auth/Auth";
import { useStore, message } from "./Store";
import { DashboardPage } from "../modules/dashboard/DashboardPage";
import { ClientsPage } from "../modules/clients/ClientsPage";
import { ServicesPage } from "../modules/services/ServicesPage";
import { RequestsPage } from "../modules/requests/RequestsPage";
import { ContractsPage } from "../modules/contracts/ContractsPage";
import { ProjectsPage } from "../modules/projects/ProjectsPage";
import { InvoicesPage } from "../modules/invoices/InvoicesPage";
import { PaymentsPage } from "../modules/payments/PaymentsPage";
import { IntegrationsPage } from "../modules/integrations/IntegrationsPage";
import { MembersPage } from "../modules/members/MembersPage";
import { ArchivedPage } from "../modules/audit/ArchivedPage";
import { AuditPage } from "../modules/audit/AuditPage";
import { Modal } from "../components/Modal";
const nav = [
  ["/", "Resumo", LayoutDashboard],
  ["/servicos", "Serviços", BriefcaseBusiness],
  ["/pedidos", "Pedidos", ScrollText],
  ["/notas", "Notas fiscais", FileText],
  ["/receber", "Recebimentos", Wallet],
  ["/clientes", "Clientes", Users],
  ["/contratos", "Contratos", ShieldCheck],
  ["/projetos", "Projetos", FolderKanban],
  ["/integracoes", "E-mails", Mail],
  ["/equipe", "Equipe", Users],
  ["/historico", "Histórico", ScrollText],
  ["/arquivados", "Arquivados", FolderKanban],
] as const;
export function App() {
  const a = useAuth();
  const s = useStore();
  const [newPanel, setNewPanel] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!a.ready) return <main className="loading">Carregando sessão…</main>;
  if (!a.user && !a.demo) return <Login />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          S
          <span>
            SafeNota<small>CONTROLE DE RECEBIMENTOS</small>
          </span>
          <button
            className="mobile-only icon-button"
            aria-label="Fechar menu"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <span className="nav-label">SEU PAINEL</span>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">
            {a.demo ? "D" : a.user?.email?.[0]?.toUpperCase()}
          </span>
          <div>
            <strong>{a.demo ? "Demonstração" : a.user?.email}</strong>
            <small>
              {s.role === "admin"
                ? "Administrador"
                : s.role === "operator"
                  ? "Operador"
                  : "Consulta"}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Sair"
            onClick={() => void a.signOut().catch((e) => setError(message(e)))}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-only icon-button"
            aria-label="Abrir menu"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <div className="panel-selector">
            <span className="panel-dot" />
            <select
              aria-label="Selecionar painel"
              value={s.panelId}
              onChange={(e) => s.setPanelId(e.target.value)}
            >
              {s.panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {!s.panels.length && <option value="">Nenhum painel</option>}
            </select>
            <button
              className="icon-button"
              aria-label="Criar painel"
              onClick={() => setNewPanel(true)}
            >
              <Plus size={18} />
            </button>
          </div>
          <span className="topbar-note">
            {a.demo
              ? "DADOS FICTÍCIOS · SESSÃO LOCAL"
              : "Seus dados separados por painel"}
          </span>
        </header>
        <main className="content">
          {a.demo && (
            <div className="demo-banner">
              Modo demonstração · dados fictícios, sem conexão com Gmail ou
              armazenamento de arquivos.
            </div>
          )}
          {(error || s.error) && (
            <div className="notice error" role="alert">
              {error || s.error}
            </div>
          )}
          {s.loading && !s.panel ? (
            <div className="loading">Carregando painéis…</div>
          ) : !s.panel ? (
            <div className="empty">
              <h1>Seu primeiro painel</h1>
              <p>
                Crie um painel para organizar seus clientes ou aceite um
                convite.
              </p>
              <button className="primary" onClick={() => setNewPanel(true)}>
                Criar painel
              </button>
              <MembersPage />
            </div>
          ) : (
            <Routes key={s.panelId}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clientes" element={<ClientsPage />} />
              <Route path="/servicos" element={<ServicesPage />} />
              <Route path="/pedidos" element={<RequestsPage />} />
              <Route path="/contratos" element={<ContractsPage />} />
              <Route path="/projetos" element={<ProjectsPage />} />
              <Route path="/notas" element={<InvoicesPage />} />
              <Route path="/receber" element={<PaymentsPage />} />
              <Route path="/integracoes" element={<IntegrationsPage />} />
              <Route path="/equipe" element={<MembersPage />} />
              <Route path="/historico" element={<AuditPage />} />
              <Route path="/arquivados" element={<ArchivedPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
        <nav className="bottom-nav">
          {nav
            .filter(([p]) =>
              ["/", "/servicos", "/receber", "/integracoes"].includes(p),
            )
            .map(([p, label, Icon]) => (
              <NavLink key={p} to={p} end={p === "/"}>
                <Icon size={21} />
                <span>{label}</span>
              </NavLink>
            ))}
          <button onClick={() => setMenu(true)}>
            <Menu size={21} />
            <span>Mais</span>
          </button>
        </nav>
      </div>
      {newPanel && (
        <Modal title="Criar painel" onClose={() => setNewPanel(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await s.createPanel(name.trim());
                setName("");
                setNewPanel(false);
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nome do painel
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: SAFETECHNOLOGY"
              />
            </label>
            <p className="muted">
              Este painel terá clientes, registros e permissões próprios.
            </p>
            <button className="primary" disabled={busy}>
              {busy ? "Criando…" : "Criar painel"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
