import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const admin = "10000000-0000-0000-0000-000000000001";
const operator = "10000000-0000-0000-0000-000000000002";
const outsider = "10000000-0000-0000-0000-000000000003";
let panel: string;
let other: string;
let client: string;
let receivable: string;
async function login(user: string) {
  await db.exec(
    `reset role; set request.jwt.claim.sub='${user}'; set role authenticated;`,
  );
}
async function value(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows[0]?.v as string;
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;insert into auth.users values('${admin}','admin@example.test',now()),('${operator}','operator@example.test',now()),('${outsider}','outside@example.test',now());`,
  );
  for (const file of [
    "202610120001_initial.sql",
    "202610120002_gmail_and_jobs.sql",
    "202610120003_workflow.sql",
    "202610130004_service_links.sql",
    "202610130005_requisition_receipts.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await login(admin);
  panel = await value("select public.create_panel('Painel A') as v");
  other = await value("select public.create_panel('Painel B') as v");
  client = await value(
    `insert into public.clients(panel_id,name) values('${panel}','Cliente') returning id as v`,
  );
  receivable = await value(
    `insert into public.receivables(panel_id,client_id,title,amount,due_date) values('${panel}','${client}','Cobrança',100,'2026-10-01') returning id as v`,
  );
  const token = await value(
    `select public.invite_member('${panel}','operator@example.test','operator') as v`,
  );
  await login(operator);
  await value(`select public.accept_invitation('${token}') as v`);
}, 30000);
afterAll(() => db.close());
it("isola leitura de quem não participa e rejeita inserção cruzada", async () => {
  await login(outsider);
  expect((await db.query("select * from public.clients")).rows).toHaveLength(0);
  await expect(
    db.exec(
      `insert into public.clients(panel_id,name) values('${panel}','Ataque')`,
    ),
  ).rejects.toThrow();
});
it("operador não arquiva nem altera papel diretamente", async () => {
  await login(operator);
  await expect(
    db.exec(`select public.archive_record('${panel}','clients','${client}')`),
  ).rejects.toThrow();
  await expect(
    db.exec(`update public.clients set deleted_at=now() where id='${client}'`),
  ).rejects.toThrow();
  await expect(
    db.query(
      `update public.memberships set role='admin' where user_id='${operator}' returning *`,
    ),
  ).rejects.toThrow();
});
it("impede vínculo com cliente de outro painel", async () => {
  await login(admin);
  await expect(
    db.exec(
      `insert into public.services(panel_id,client_id,title) values('${other}','${client}','Serviço')`,
    ),
  ).rejects.toThrow();
});
it("pagamento parcial é idempotente, saldo bloqueia excesso e operador não reverte", async () => {
  await login(operator);
  const key = "20000000-0000-0000-0000-000000000001";
  const sql = `select public.record_payment('${panel}','${client}',60,'2026-10-12','PIX','', '[{"receivable_id":"${receivable}","amount":60}]','${key}') as v`;
  const p = await value(sql);
  expect(await value(sql)).toBe(p);
  expect((await db.query("select * from public.payments")).rows).toHaveLength(
    1,
  );
  await expect(
    db.exec(
      `select public.record_payment('${panel}','${client}',50,'2026-10-12','PIX','', '[{"receivable_id":"${receivable}","amount":50}]','20000000-0000-0000-0000-000000000002')`,
    ),
  ).rejects.toThrow();
  await expect(
    db.exec(`select public.reverse_payment('${panel}','${p}','Correção')`),
  ).rejects.toThrow();
  await login(admin);
  await db.exec(`select public.reverse_payment('${panel}','${p}','Correção')`);
  expect(
    (await db.query(`select status from public.payments where id='${p}'`))
      .rows[0],
  ).toEqual({ status: "reversed" });
});
it("não remove último administrador", async () => {
  await login(admin);
  await expect(
    db.exec(`select public.change_member('${panel}','${admin}',null)`),
  ).rejects.toThrow();
});
it("contratos não duplicam competências e nota usa cobrança existente", async () => {
  await login(admin);
  const contract = await value(
    `insert into public.contracts(panel_id,client_id,title,amount,due_day,start_date) values('${panel}','${client}','Mensal',250,31,'2020-01-01') returning id as v`,
  );
  await db.exec(
    `select public.generate_installments('${panel}');select public.generate_installments('${panel}');`,
  );
  const rs = await db.query<{ id: string }>(
    `select id from public.receivables where contract_id='${contract}'`,
  );
  expect(rs.rows).toHaveLength(1);
  const invoice = {
    client_id: client,
    title: "NF contrato",
    number: "99",
    fiscal_key: "test-key",
    amount: 250,
    net_amount: 250,
    issue_date: "2026-10-12",
  };
  await db.query("select public.import_invoice($1,$2,$3)", [
    panel,
    JSON.stringify(invoice),
    rs.rows[0].id,
  ]);
  expect(
    (
      await db.query(
        `select * from public.receivables where contract_id='${contract}'`,
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("select public.import_invoice($1,$2,null)", [
      panel,
      JSON.stringify(invoice),
    ]),
  ).rejects.toThrow();
});
it("consulta não escreve e logs são protegidos", async () => {
  await login(admin);
  await db.exec(
    `select public.change_member('${panel}','${operator}','viewer')`,
  );
  await login(operator);
  await expect(
    db.exec(
      `insert into public.clients(panel_id,name) values('${panel}','Sem acesso')`,
    ),
  ).rejects.toThrow();
  expect(
    (await db.query("select * from public.audit_events")).rows,
  ).toHaveLength(0);
  await expect(
    db.exec(
      `insert into public.audit_events(panel_id,action,entity,entity_id) values('${panel}','forjado','clients','${client}')`,
    ),
  ).rejects.toThrow();
});

it("novo acesso termina após remoção do membro", async () => {
  await login(admin);
  await db.exec(`select public.change_member('${panel}','${operator}',null)`);
  await login(operator);
  expect((await db.query("select * from public.clients")).rows).toHaveLength(0);
  await expect(
    db.exec(`select public.generate_installments('${panel}')`),
  ).rejects.toThrow();
});

it("tokens OAuth não são acessíveis pelo cliente autenticado", async () => {
  await login(admin);
  await expect(db.exec("select * from private.gmail_tokens")).rejects.toThrow();
  await expect(
    db.exec(
      "select public.gmail_token_get('00000000-0000-0000-0000-000000000000')",
    ),
  ).rejects.toThrow();
});

it("depósito quita várias cobranças e não permite edição de valor abaixo do recebido", async () => {
  await login(admin);
  const a = await value(
    `insert into public.receivables(panel_id,client_id,title,amount) values('${panel}','${client}','A',20) returning id as v`,
  );
  const b = await value(
    `insert into public.receivables(panel_id,client_id,title,amount) values('${panel}','${client}','B',30) returning id as v`,
  );
  const p = await value(
    `select public.record_payment('${panel}','${client}',50,'2026-10-12','PIX','', '[{"receivable_id":"${a}","amount":20},{"receivable_id":"${b}","amount":30}]','30000000-0000-0000-0000-000000000001') as v`,
  );
  expect(
    (
      await db.query(
        `select * from public.payment_allocations where payment_id='${p}'`,
      )
    ).rows,
  ).toHaveLength(2);
  await expect(
    db.exec(`update public.receivables set amount=10 where id='${a}'`),
  ).rejects.toThrow();
});

it("cancelamento fiscal atualiza cobrança e não aceita cancelamento direto com dívida ativa", async () => {
  await login(admin);
  const p = {
    client_id: client,
    title: "Nota para cancelar",
    number: "100",
    fiscal_key: "cancel-test",
    amount: 25,
    net_amount: 25,
    issue_date: "2026-10-12",
  };
  const id = (
    await db.query<{ id: string }>(
      "select public.import_invoice($1,$2,null) as id",
      [panel, JSON.stringify(p)],
    )
  ).rows[0].id;
  await expect(
    db.exec(`update public.invoices set status='Cancelada' where id='${id}'`),
  ).rejects.toThrow();
  await db.exec(
    `select public.cancel_invoice('${panel}','${id}','Cancelada no emissor')`,
  );
  expect(
    (
      await db.query(
        `select status from public.receivables where invoice_id='${id}'`,
      )
    ).rows[0],
  ).toEqual({ status: "cancelled" });
});

it("rejeita valores monetários não finitos no banco e RPC", async () => {
  await login(admin);
  await expect(
    db.exec(
      `insert into public.receivables(panel_id,client_id,title,amount) values('${panel}','${client}','Inválida','NaN')`,
    ),
  ).rejects.toThrow();
  await expect(
    db.exec(
      `select public.record_payment('${panel}','${client}','NaN','2026-10-12','PIX','','[]','40000000-0000-0000-0000-000000000001')`,
    ),
  ).rejects.toThrow();
});

it("requisição vincula vários serviços; importação herda vínculos sem alterar notas anteriores", async () => {
  await login(admin);
  const a = await value(
    `insert into public.services(panel_id,client_id,title,ticket_number) values('${panel}','${client}','A','001-1') returning id as v`,
  );
  const b = await value(
    `insert into public.services(panel_id,client_id,title,ticket_number) values('${panel}','${client}','B','002-1') returning id as v`,
  );
  const payload = {
    client_id: client,
    title: "Requisição",
    order_number: "request-linked",
    amount: 80,
  };
  const request = (
    await db.query<{ id: string }>(
      "select public.save_requisition($1,$2,$3,null) as id",
      [panel, JSON.stringify(payload), [a, b]],
    )
  ).rows[0].id;
  expect(
    (
      await db.query(
        "select service_id from public.request_services where request_id=$1",
        [request],
      )
    ).rows,
  ).toHaveLength(2);
  const invoice = (
    await db.query<{ id: string }>(
      "select public.import_invoice($1,$2,null) as id",
      [
        panel,
        JSON.stringify({
          client_id: client,
          request_id: request,
          title: "NF serviços",
          number: "101",
          amount: 80,
          net_amount: 80,
          issue_date: "2026-10-13",
        }),
      ],
    )
  ).rows[0].id;
  expect(
    (
      await db.query(
        "select service_id from public.invoice_services where invoice_id=$1",
        [invoice],
      )
    ).rows,
  ).toHaveLength(2);
  await db.query("select public.save_requisition($1,$2,$3,$4)", [
    panel,
    JSON.stringify(payload),
    [a],
    request,
  ]);
  expect(
    (
      await db.query(
        "select service_id from public.invoice_services where invoice_id=$1",
        [invoice],
      )
    ).rows,
  ).toHaveLength(2);
  await expect(
    db.query("update public.services set client_id=$1 where id=$2", [
      client,
      a,
    ]),
  ).resolves.toBeDefined();
  await login(outsider);
  expect(
    (await db.query("select * from public.invoice_services")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.set_invoice_services($1,$2,$3)", [
      panel,
      invoice,
      [],
    ]),
  ).rejects.toThrow();
});

it("nota com seleção inválida reverte documento e cobrança; consulta não escreve vínculos", async () => {
  await login(admin);
  const otherClient = await value(
    `insert into public.clients(panel_id,name) values('${panel}','Outro cliente') returning id as v`,
  );
  const wrong = await value(
    `insert into public.services(panel_id,client_id,title) values('${panel}','${otherClient}','Incompatível') returning id as v`,
  );
  const before = (await db.query("select * from public.receivables")).rows
    .length;
  const invoice = {
    client_id: client,
    title: "Atomicidade",
    number: "102",
    fiscal_key: "atomic-linked",
    amount: 50,
    net_amount: 50,
    issue_date: "2026-10-13",
  };
  await expect(
    db.query("select public.save_invoice($1,$2,$3,null,null)", [
      panel,
      JSON.stringify(invoice),
      [wrong],
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("select * from public.receivables")).rows,
  ).toHaveLength(before);
  expect(
    (
      await db.query(
        "select * from public.invoices where fiscal_key='atomic-linked'",
      )
    ).rows,
  ).toHaveLength(0);
  const request = {
    client_id: client,
    title: "Invalid",
    order_number: "invalid-linked",
    amount: 50,
  };
  await expect(
    db.query("select public.save_requisition($1,$2,$3,null)", [
      panel,
      JSON.stringify(request),
      [wrong],
    ]),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        "select * from public.billing_requests where order_number='invalid-linked'",
      )
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.invoice_services(panel_id,invoice_id,service_id) values($1,gen_random_uuid(),$2)",
      [panel, wrong],
    ),
  ).rejects.toThrow();
  const token = await value(
    `select public.invite_member('${panel}','operator@example.test','viewer') as v`,
  );
  await login(operator);
  await value(`select public.accept_invitation('${token}') as v`);
  await expect(
    db.query("select public.save_requisition($1,$2,$3,null)", [
      panel,
      JSON.stringify(request),
      [],
    ]),
  ).rejects.toThrow();
});

it("salva e edita seleção da nota, mantém auditoria e rejeita serviço de outro painel", async () => {
  await login(admin);
  const service = await value(
    `insert into public.services(panel_id,client_id,title) values('${panel}','${client}','Manual') returning id as v`,
  );
  const otherClient = await value(
    `insert into public.clients(panel_id,name) values('${other}','Cliente painel B') returning id as v`,
  );
  const otherService = await value(
    `insert into public.services(panel_id,client_id,title) values('${other}','${otherClient}','Outro painel') returning id as v`,
  );
  const payload = {
    client_id: client,
    title: "Manual com serviço",
    number: "103",
    amount: 10,
    net_amount: 10,
    issue_date: "2026-10-13",
  };
  const invoice = (
    await db.query<{ id: string }>(
      "select public.save_invoice($1,$2,$3,null,null) as id",
      [panel, JSON.stringify(payload), [service]],
    )
  ).rows[0].id;
  expect(
    (
      await db.query(
        "select * from public.invoice_services where invoice_id=$1",
        [invoice],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("select public.set_invoice_services($1,$2,$3)", [
      panel,
      invoice,
      [otherService],
    ]),
  ).rejects.toThrow();
  const link = (
    await db.query<{ id: string }>(
      "select id from public.invoice_services where invoice_id=$1",
      [invoice],
    )
  ).rows[0].id;
  await db.query("select public.save_invoice($1,$2,$3,$4,null)", [
    panel,
    JSON.stringify({ ...payload, title: "Editada" }),
    [],
    invoice,
  ]);
  expect(
    (
      await db.query(
        "select * from public.invoice_services where invoice_id=$1",
        [invoice],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select * from public.audit_events where entity='invoice_services' and entity_id=$1",
        [link],
      )
    ).rows,
  ).toHaveLength(2);
});

it("marcar requisição gerada cria nota/cobrança atomicamente e repetir não duplica", async () => {
  await login(admin);
  const service = await value(
    `insert into public.services(panel_id,client_id,title,ticket_number) values('${panel}','${client}','Fluxo completo','003-1') returning id as v`,
  );
  const request = {
    client_id: client,
    title: "Gerada",
    order_number: "workflow-generated",
    ticket_numbers: "003-1",
    amount: 150,
    status: "Faturado",
  };
  await expect(
    db.query("select public.save_requisition_workflow($1,$2,$3,null,null)", [
      panel,
      JSON.stringify(request),
      [service],
    ]),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        "select * from public.billing_requests where order_number='workflow-generated'",
      )
    ).rows,
  ).toHaveLength(0);
  const draft = {
    number: "900",
    issue_date: "2026-10-13",
    due_date: "2026-11-05",
  };
  const id = (
    await db.query<{ id: string }>(
      "select public.save_requisition_workflow($1,$2,$3,null,$4) as id",
      [panel, JSON.stringify(request), [service], JSON.stringify(draft)],
    )
  ).rows[0].id;
  await db.query("select public.save_requisition_workflow($1,$2,$3,$4,null)", [
    panel,
    JSON.stringify(request),
    [service],
    id,
  ]);
  const invoices = (
    await db.query<{ id: string }>(
      "select id from public.invoices where request_id=$1",
      [id],
    )
  ).rows;
  expect(invoices).toHaveLength(1);
  const rs = (
    await db.query<{ id: string; amount: string; due_date: string }>(
      "select id,amount,due_date::text from public.receivables where invoice_id=$1",
      [invoices[0].id],
    )
  ).rows;
  expect(rs).toHaveLength(1);
  expect(Number(rs[0].amount)).toBe(150);
  expect(rs[0].due_date).toBe("2026-11-05");
  expect(
    (
      await db.query(
        "select * from public.invoice_services where invoice_id=$1",
        [invoices[0].id],
      )
    ).rows,
  ).toHaveLength(1);
  await db.query(
    "select public.record_payment($1,$2,150,'2026-10-13','PIX','',$3,gen_random_uuid())",
    [panel, client, JSON.stringify([{ receivable_id: rs[0].id, amount: 150 }])],
  );
  const paid = (
    await db.query<{ paid: string }>(
      "select sum(a.amount)::text as paid from public.payment_allocations a join public.payments p on p.id=a.payment_id and p.status='active' join public.receivables r on r.id=a.receivable_id join public.invoices i on i.id=r.invoice_id where i.request_id=$1",
      [id],
    )
  ).rows[0];
  expect(Number(paid.paid)).toBe(150);
  await db.query("select public.save_requisition_workflow($1,$2,$3,$4,null)", [
    panel,
    JSON.stringify({ ...request, status: "A gerar" }),
    [service],
    id,
  ]);
  expect(
    (
      await db.query("select status from public.billing_requests where id=$1", [
        id,
      ])
    ).rows[0],
  ).toEqual({ status: "Faturado" });
});

it("consulta não pode gerar nota/cobrança pelo fluxo de requisição", async () => {
  await login(operator);
  await expect(
    db.query("select public.save_requisition_workflow($1,$2,$3,null,$4)", [
      panel,
      JSON.stringify({
        client_id: client,
        title: "Forbidden",
        order_number: "forbidden-flow",
        amount: 80,
        status: "Faturado",
      }),
      [],
      JSON.stringify({ number: "999", issue_date: "2026-10-13" }),
    ]),
  ).rejects.toThrow();
  await login(admin);
  expect(
    (
      await db.query(
        "select * from public.billing_requests where order_number='forbidden-flow'",
      )
    ).rows,
  ).toHaveLength(0);
});
