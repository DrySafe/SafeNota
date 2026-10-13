import { createClient } from "npm:@supabase/supabase-js@2";
export function env(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Configure ${name} no servidor.`);
  return v;
}
export const admin = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
export const origin = () => env("APP_ORIGIN");
export const callback = () =>
  `${env("SUPABASE_URL")}/functions/v1/gmail-callback`;
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin(),
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
export async function userFor(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new Error("Autenticação necessária");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new Error("Sessão inválida");
  return data.user;
}
export async function google(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!r.ok)
    throw new Error(
      `Google respondeu ${r.status}. Verifique a autorização da conta.`,
    );
  return r.json();
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key() {
  const raw = bytes(env("TOKEN_ENCRYPTION_KEY"));
  if (raw.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY deve ter 32 bytes em base64");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return b64(iv) + "." + b64(new Uint8Array(cipher));
}
export async function decrypt(value: string) {
  const [iv, cipher] = value.split(".");
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(iv) },
    await key(),
    bytes(cipher),
  );
  return JSON.parse(new TextDecoder().decode(raw));
}
export function check<T extends { error: unknown }>(r: T): T {
  if (r.error) throw r.error;
  return r;
}
