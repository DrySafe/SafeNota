import {
  gmailSearchDays,
  gmailDailyWindow,
  gmailSearchQuery,
} from "../../../src/modules/integrations/searchPeriod.ts";
import {
  admin,
  callback,
  check,
  decrypt,
  env,
  google,
  json,
  origin,
  userFor,
} from "../_shared/runtime.ts";
import { extractEmail } from "../../../src/modules/integrations/extract.ts";
interface Rule {
  id: string;
  panel_id: string;
  connection_id: string;
  client_id: string | null;
  sender: string;
  kind: string;
  keywords: string | null;
  patterns: string | null;
}
interface Part {
  mimeType?: string;
  body?: { data?: string };
  parts?: Part[];
}
function decode(s: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    ),
  );
}
function body(part: Part): string {
  if (part.mimeType === "text/plain" && part.body?.data)
    return decode(part.body.data);
  const children = (part.parts || []).map(body).filter(Boolean);
  if (children.length) return children.join("\n");
  if (part.mimeType === "text/html" && part.body?.data)
    return decode(part.body.data)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  return "";
}
async function sync(
  rules: Rule[],
  days = 30,
  window?: { after: number; before: number },
) {
  const db = admin();
  let captured = 0;
  let ignored = 0;
  const errors: string[] = [];
  const access = new Map<string, string>();
  for (const rule of rules) {
    try {
      const account = check(
        await db
          .from("gmail_accounts")
          .select("id,user_id,status")
          .eq("id", rule.connection_id)
          .single(),
      ).data;
      if (!account) throw new Error("Conta indisponível");
      const membership = check(
        await db
          .from("memberships")
          .select("role")
          .eq("panel_id", rule.panel_id)
          .eq("user_id", account.user_id)
          .maybeSingle(),
      ).data;
      if (
        !membership ||
        !["admin", "operator"].includes(membership.role) ||
        account.status !== "active"
      )
        continue;
      let token = access.get(account.id);
      if (!token) {
        const encrypted = check(
          await db.rpc("gmail_token_get", { p_connection: account.id }),
        ).data;
        if (!encrypted) continue;
        const saved = await decrypt(encrypted);
        const fresh = await google("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: env("GOOGLE_CLIENT_ID"),
            client_secret: env("GOOGLE_CLIENT_SECRET"),
            refresh_token: saved.refresh_token,
          }),
        });
        token = String(fresh.access_token);
        access.set(account.id, token);
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rule.sender))
        throw new Error("Remetente inválido");
      let page = "";
      let pages = 0;
      do {
        const url = new URL(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages",
        );
        url.searchParams.set("q", gmailSearchQuery(rule.sender, days, window));
        url.searchParams.set("maxResults", "50");
        if (page) url.searchParams.set("pageToken", page);
        const list = await google(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        for (const m of list.messages || []) {
          const existing = check(
            await db
              .from("captured_messages")
              .select("id")
              .eq("panel_id", rule.panel_id)
              .eq("connection_id", account.id)
              .eq("message_id", m.id)
              .maybeSingle(),
          ).data;
          if (existing) continue;
          const msg = await google(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const headers = msg.payload?.headers || [];
          const from = String(
            headers.find(
              (h: { name: string }) => h.name.toLowerCase() === "from",
            )?.value || "",
          );
          const sender = from.match(/<([^>]+)>/)?.[1] || from.trim();
          if (sender.toLowerCase() !== rule.sender.toLowerCase()) continue;
          const subject = String(
            headers.find(
              (h: { name: string }) => h.name.toLowerCase() === "subject",
            )?.value || "",
          );
          const text = (subject + "\n" + body(msg.payload)).slice(0, 10000);
          if (
            rule.keywords &&
            !rule.keywords
              .split(",")
              .every((k) => text.toLowerCase().includes(k.trim().toLowerCase()))
          )
            continue;
          const extracted = extractEmail(
            text,
            rule.kind,
            rule.patterns ? JSON.parse(rule.patterns) : {},
          );
          const insert = await db
            .from("captured_messages")
            .insert({
              panel_id: rule.panel_id,
              rule_id: rule.id,
              client_id: rule.client_id,
              connection_id: account.id,
              message_id: m.id,
              kind: rule.kind,
              sender,
              subject,
              extracted,
            })
            .select("status")
            .single();
          if (insert.error && insert.error.code !== "23505") throw insert.error;
          if (!insert.error) {
            if (insert.data?.status === "ignored") ignored++;
            else captured++;
          }
        }
        page = list.nextPageToken || "";
        pages++;
      } while (page && pages < 5);
      if (page)
        errors.push(
          `Regra ${rule.id}: há mais de 250 mensagens; refine os filtros.`,
        );
    } catch {
      errors.push(
        `Regra ${rule.id}: falha na captura. Confira conexão e padrões.`,
      );
    }
  }
  return { captured, ignored, errors };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  if (req.method !== "POST")
    return json({ error: "Método não permitido" }, 405);
  try {
    const input = await req.json();
    const db = admin();
    if (input.action === "sync-all") {
      const supplied = req.headers.get("x-cron-secret");
      const allowed = [
        Deno.env.get("SYNC_CRON_SECRET"),
        Deno.env.get("GMAIL_DAILY_CRON_SECRET"),
      ].filter(Boolean);
      if (!supplied || !allowed.includes(supplied))
        return json({ error: "Não autorizado" }, 401);
      const rules = check(
        await db
          .from("email_rules")
          .select("*")
          .eq("status", "active")
          .is("deleted_at", null),
      ).data;
      return json(await sync(rules || [], 1, gmailDailyWindow()));
    }
    const user = await userFor(req);
    if (input.action === "connect") {
      const state = check(
        await db.rpc("oauth_state_create", { p_user: user.id }),
      ).data;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        redirect_uri: callback(),
        response_type: "code",
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
      }).toString();
      return json({ url: url.toString() });
    }
    if (input.action === "disconnect") {
      const account = check(
        await db
          .from("gmail_accounts")
          .select("id")
          .eq("id", input.connection_id)
          .eq("user_id", user.id)
          .single(),
      ).data;
      if (!account) throw new Error("Conta indisponível");
      const encrypted = check(
        await db.rpc("gmail_token_get", { p_connection: account.id }),
      ).data;
      if (encrypted) {
        const saved = await decrypt(encrypted);
        const response = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: saved.refresh_token }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok && response.status !== 400)
          throw new Error("Não foi possível revogar no Google.");
      }
      check(await db.rpc("gmail_token_delete", { p_connection: account.id }));
      check(
        await db
          .from("gmail_accounts")
          .update({ status: "disconnected" })
          .eq("id", account.id),
      );
      check(
        await db
          .from("email_rules")
          .update({ status: "paused" })
          .eq("connection_id", account.id),
      );
      return json({ ok: true });
    }
    if (input.action === "sync") {
      const days = gmailSearchDays(input.days);
      const member = check(
        await db
          .from("memberships")
          .select("role")
          .eq("panel_id", input.panel_id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ).data;
      if (!member || !["admin", "operator"].includes(member.role))
        return json({ error: "Sem permissão" }, 403);
      const rules = check(
        await db
          .from("email_rules")
          .select("*")
          .eq("panel_id", input.panel_id)
          .eq("status", "active")
          .is("deleted_at", null),
      ).data;
      return json(await sync(rules || [], days));
    }
    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Falha na integração" },
      400,
    );
  }
});
