import { useEffect, useState } from "react";
import { Download } from "lucide-react";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const installed = () => setPrompt(null);
    const available = (event: Event) => {
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!prompt) return null;
  return (
    <button
      className="install-app primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await prompt.prompt();
          await prompt.userChoice;
        } catch {
          /* The browser may withdraw the one-use installation prompt. */
        } finally {
          setPrompt(null);
          setBusy(false);
        }
      }}
    >
      <Download size={18} aria-hidden="true" />
      Instalar SafeNota
    </button>
  );
}
