import {
  admin,
  callback,
  check,
  encrypt,
  env,
  google,
  origin,
} from "../_shared/runtime.ts";
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state || !code) throw new Error("Autorização não concluída.");
    const db = admin();
    const user = check(
      await db.rpc("oauth_state_consume", { p_state: state }),
    ).data;
    if (!user) throw new Error("Autorização expirada. Conecte novamente.");
    const token = await google("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        code,
        redirect_uri: callback(),
        grant_type: "authorization_code",
      }),
    });
    if (!token.refresh_token)
      throw new Error(
        "Não foi recebida autorização persistente. Revogue o acesso no Google e conecte novamente.",
      );
    const profile = await google(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    const account = check(
      await db
        .from("gmail_accounts")
        .upsert(
          { user_id: user, email: profile.emailAddress, status: "active" },
          { onConflict: "user_id,email" },
        )
        .select("id")
        .single(),
    ).data;
    if (!account) throw new Error("Conta não criada");
    check(
      await db.rpc("gmail_token_put", {
        p_connection: account.id,
        p_encrypted: await encrypt({ refresh_token: token.refresh_token }),
      }),
    );
    return Response.redirect(origin() + "/integracoes?google=connected", 303);
  } catch {
    return new Response(
      "Não foi possível conectar o Gmail. Volte ao SafeNota e confira as credenciais OAuth, o consentimento e a URL de retorno.",
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
});
