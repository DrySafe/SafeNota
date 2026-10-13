import { pathToFileURL } from "node:url";

const expectedUrl = "https://fqqnzmhvlvwxlcfwseof.supabase.co";

export function buildEnvironmentErrors(env) {
  if (env.VERCEL !== "1") return [];
  const errors = [];
  for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
    if (!env[name]?.trim()) errors.push(`Variável ausente: ${name}`);
  }
  if (
    env.VITE_SUPABASE_URL?.trim() &&
    env.VITE_SUPABASE_URL.trim().replace(/\/$/, "") !== expectedUrl
  ) {
    errors.push(
      "VITE_SUPABASE_URL não corresponde ao projeto SafeNota autorizado.",
    );
  }
  return errors;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const errors = buildEnvironmentErrors(process.env);
  if (errors.length) {
    console.error(
      "Configuração Supabase incompleta neste build da Vercel:\n" +
        errors.join("\n") +
        "\nCadastre as variáveis no ambiente deste deployment (Production ou Preview) e gere um novo deployment. Consulte docs/vercel.md.",
    );
    process.exitCode = 1;
  }
}
