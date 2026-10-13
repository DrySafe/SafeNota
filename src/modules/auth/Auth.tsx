import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
const AuthContext = createContext<{
  user: User | null;
  ready: boolean;
  demo: boolean;
  enterDemo: () => void;
  signOut: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null);
        setReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        demo,
        enterDemo: () => setDemo(true),
        signOut: async () => {
          if (supabase && user) {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
          }
          setDemo(false);
          setUser(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const v = useContext(AuthContext);
  if (!v) throw new Error("AuthProvider ausente");
  return v;
};
export function Login() {
  const { enterDemo } = useAuth();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          S<span>SafeNota</span>
        </div>
        <h1>
          Seu trabalho feito.
          <br />
          Seu recebimento
          <br />
          <em>sob controle.</em>
        </h1>
        <p>Do primeiro chamado ao pagamento, tudo no mesmo lugar.</p>
        <div className="story-pill">Serviços · Notas · Recebimentos</div>
      </section>
      <section className="login-card">
        <span className="eyebrow">BEM-VINDO AO SAFENOTA</span>
        <h2>{signup ? "Crie sua conta" : "Organize seus recebimentos"}</h2>
        <p className="muted">Acesse seus painéis e acompanhe cada serviço.</p>
        {supabase ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const { error } = signup
                  ? await supabase!.auth.signUp({
                      email,
                      password,
                      options: { emailRedirectTo: location.origin },
                    })
                  : await supabase!.auth.signInWithPassword({
                      email,
                      password,
                    });
                if (error) throw error;
                if (signup)
                  setMessage("Confira seu e-mail para confirmar o cadastro.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Falha no acesso");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                minLength={8}
                autoComplete={signup ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setSignup(!signup)}
            >
              {signup ? "Já tenho uma conta" : "Criar uma conta"}
            </button>
            {message && <p role="status">{message}</p>}
          </form>
        ) : (
          <div className="notice">
            Supabase ainda não configurado. Explore o fluxo com dados fictícios;
            eles ficam somente nesta sessão.
          </div>
        )}
        <button className="secondary" onClick={enterDemo}>
          Explorar demonstração
        </button>
      </section>
    </main>
  );
}
