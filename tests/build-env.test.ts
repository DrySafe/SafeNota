import { expect, it } from "vitest";
import { buildEnvironmentErrors } from "../scripts/check-build-env.mjs";

it("permite build local da demonstração sem credenciais", () => {
  expect(buildEnvironmentErrors({})).toEqual([]);
});

it("identifica as duas variáveis ausentes na Vercel", () => {
  expect(buildEnvironmentErrors({ VERCEL: "1" })).toEqual([
    "Variável ausente: VITE_SUPABASE_URL",
    "Variável ausente: VITE_SUPABASE_ANON_KEY",
  ]);
});

it("aceita configuração do projeto correto e bloqueia outro destino", () => {
  const env = {
    VERCEL: "1",
    VITE_SUPABASE_URL: "https://fqqnzmhvlvwxlcfwseof.supabase.co",
    VITE_SUPABASE_ANON_KEY: "public-test-placeholder",
  };
  expect(buildEnvironmentErrors(env)).toEqual([]);
  expect(
    buildEnvironmentErrors({
      ...env,
      VITE_SUPABASE_URL: "https://other-project.supabase.co",
    }),
  ).toHaveLength(1);
});
