import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  BriefcaseBusiness,
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
const DashboardPage = lazy(() =>
  import("../modules/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ClientsPage = lazy(() =>
  import("../modules/clients/ClientsPage").then((module) => ({
    default: module.ClientsPage,
  })),
);
const ServicesPage = lazy(() =>
  import("../modules/services/ServicesPage").then((module) => ({
    default: module.ServicesPage,
  })),
);
const RequestsPage = lazy(() =>
  import("../modules/requests/RequestsPage").then((module) => ({
    default: module.RequestsPage,
  })),
);
const ContractsPage = lazy(() =>
  import("../modules/contracts/ContractsPage").then((module) => ({
    default: module.ContractsPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("../modules/projects/ProjectsPage").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("../modules/invoices/InvoicesPage").then((module) => ({
    default: module.InvoicesPage,
  })),
);
const PaymentsPage = lazy(() =>
  import("../modules/payments/PaymentsPage").then((module) => ({
    default: module.PaymentsPage,
  })),
);
const IntegrationsPage = lazy(() =>
  import("../modules/integrations/IntegrationsPage").then((module) => ({
    default: module.IntegrationsPage,
  })),
);
const MembersPage = lazy(() =>
  import("../modules/members/MembersPage").then((module) => ({
    default: module.MembersPage,
  })),
);
const ArchivedPage = lazy(() =>
  import("../modules/audit/ArchivedPage").then((module) => ({
    default: module.ArchivedPage,
  })),
);
const AuditPage = lazy(() =>
  import("../modules/audit/AuditPage").then((module) => ({
    default: module.AuditPage,
  })),
);
import { Modal } from "../components/Modal";
const nav = [
  ["/", "Resumo", LayoutDashboard],
  ["/servicos", "Serviços", BriefcaseBusiness],
  ["/requisicoes", "Requisições de nota", ScrollText],
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
  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menu]);
  if (!a.ready) return <main className="loading">Carregando sessão…</main>;
  if (!a.user && !a.demo) return <Login />;
  return (
    <div className="app-shell">
      {menu && (
        <button
          type="button"
          className="menu-backdrop"
          aria-label="Fechar menu ao tocar fora"
          onClick={() => setMenu(false)}
        />
      )}
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
            aria-expanded={menu}
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
          <Suspense
            fallback={<div className="loading">Carregando módulo…</div>}
          >
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
                <Route path="/requisicoes" element={<RequestsPage />} />
                <Route
                  path="/pedidos"
                  element={<Navigate to="/requisicoes" replace />}
                />
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
          </Suspense>
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
