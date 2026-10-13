-- SafeNota: apply with Supabase migrations. No application credentials here.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.panels (id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100), timezone text not null default 'America/Sao_Paulo', created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table public.memberships (panel_id uuid not null references public.panels(id), user_id uuid not null references auth.users(id), role text not null check(role in ('admin','operator','viewer')), created_at timestamptz not null default now(), primary key(panel_id,user_id));
create function public.panel_role(p_panel uuid) returns text language sql stable security definer set search_path = '' as $$ select role from public.memberships where panel_id=p_panel and user_id=auth.uid() $$;
create table public.invitations(id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), email text not null, role text not null check(role in ('admin','operator','viewer')), token uuid not null unique default gen_random_uuid(), expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz, created_at timestamptz not null default now());
create table public.clients (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, name text not null check(length(trim(name))>0), document text, email text, phone text, description text, unique(panel_id,id));
create index on public.clients(panel_id,created_at desc);
create table public.services (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, title text not null, ticket_number text, reference text, amount numeric(14,2) check(amount>=0), service_date date, contract_id uuid, project_id uuid, status text not null default 'Aguardando atendimento' check(status in ('Aguardando atendimento','Em atendimento','Concluído','Cancelado')), notes text, unique(panel_id,id));
create index on public.services(panel_id,created_at desc);
create table public.billing_requests (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, title text not null, order_number text not null, ticket_numbers text, amount numeric(14,2) not null check(amount>=0), send_deadline date, instructions text, status text not null default 'A gerar' check(status in ('A gerar','Parcialmente faturado','Faturado','Cancelado')), unique(panel_id,id));
create index on public.billing_requests(panel_id,created_at desc);
create table public.contracts (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, title text not null, amount numeric(14,2) not null check(amount>0), due_day int not null check(due_day between 1 and 31), start_date date not null, end_date date, status text not null default 'Ativo' check(status in ('Ativo','Suspenso','Encerrado')), notes text, check(end_date is null or end_date>=start_date), unique(panel_id,id));
create index on public.contracts(panel_id,created_at desc);
create table public.projects (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, title text not null, description text, due_date date, stages text, status text not null default 'Planejamento' check(status in ('Planejamento','Em andamento','Concluído','Cancelado')), unique(panel_id,id));
create index on public.projects(panel_id,created_at desc);
create table public.invoices (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, request_id uuid, title text not null, number text not null, fiscal_key text, issuer_document text, issue_date date not null, competence date, amount numeric(14,2) not null check(amount>=0), net_amount numeric(14,2) not null check(net_amount>=0), status text not null default 'Gerada' check(status in ('Gerada','Cancelada')), description text, unique(panel_id,id));
create index on public.invoices(panel_id,created_at desc);
create table public.receivables (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, invoice_id uuid, contract_id uuid, title text not null, competence date, amount numeric(14,2) not null check(amount>0), due_date date, status text not null default 'active' check(status in ('active','cancelled')), unique(panel_id,id));
create index on public.receivables(panel_id,created_at desc);
create table public.payments (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, client_id uuid not null, amount numeric(14,2) not null check(amount>0), paid_date date not null, method text not null, notes text, status text not null default 'active' check(status in ('active','reversed')), reversal_reason text, idempotency_key uuid not null, unique(panel_id,id));
create index on public.payments(panel_id,created_at desc);
create table public.payment_allocations (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, payment_id uuid not null, receivable_id uuid not null, amount numeric(14,2) not null check(amount>0), unique(panel_id,id));
create index on public.payment_allocations(panel_id,created_at desc);
create table public.email_rules (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, connection_id uuid not null, title text not null, sender text not null, kind text not null check(kind in ('request','service')), keywords text, patterns text, status text not null default 'active' check(status in ('active','paused')), unique(panel_id,id));
create index on public.email_rules(panel_id,created_at desc);
create table public.captured_messages (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, connection_id uuid not null, message_id text not null, kind text not null check(kind in ('request','service')), sender text not null, subject text not null, extracted jsonb not null, status text not null default 'pending' check(status in ('pending','confirmed','ignored')), confirmed_entity_id uuid, unique(panel_id,id));
create index on public.captured_messages(panel_id,created_at desc);
create table public.attachments (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, entity text not null check(entity in ('invoices','payments','services','billing_requests')), entity_id uuid not null, path text not null unique, name text not null, size bigint not null check(size between 0 and 10485760), unique(panel_id,id));
create index on public.attachments(panel_id,created_at desc);
create table public.audit_events (id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id), created_at timestamptz not null default now(), deleted_at timestamptz, actor_id uuid, action text not null, entity text not null, entity_id uuid not null, changes jsonb, unique(panel_id,id));
create index on public.audit_events(panel_id,created_at desc);
alter table public.services add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.billing_requests add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.contracts add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.projects add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.invoices add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.receivables add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.payments add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.services add foreign key(panel_id,contract_id) references public.contracts(panel_id,id);
alter table public.services add foreign key(panel_id,project_id) references public.projects(panel_id,id);
alter table public.invoices add foreign key(panel_id,request_id) references public.billing_requests(panel_id,id);
alter table public.receivables add foreign key(panel_id,invoice_id) references public.invoices(panel_id,id);
alter table public.receivables add foreign key(panel_id,contract_id) references public.contracts(panel_id,id);
alter table public.payment_allocations add foreign key(panel_id,payment_id) references public.payments(panel_id,id);
alter table public.payment_allocations add foreign key(panel_id,receivable_id) references public.receivables(panel_id,id);

create unique index invoice_key_unique on public.invoices(panel_id,fiscal_key) where fiscal_key is not null and fiscal_key<>'';
create unique index order_unique on public.billing_requests(panel_id,client_id,order_number) where deleted_at is null;
create unique index installment_unique on public.receivables(panel_id,contract_id,competence) where contract_id is not null;
create unique index receivable_invoice_unique on public.receivables(panel_id,invoice_id) where invoice_id is not null;
create unique index payment_key_unique on public.payments(panel_id,idempotency_key);
create unique index payment_allocation_unique on public.payment_allocations(payment_id,receivable_id);
create unique index message_unique on public.captured_messages(panel_id,connection_id,message_id);
create table public.gmail_accounts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),email text not null,created_at timestamptz not null default now(),unique(user_id,email));
create table private.gmail_tokens(connection_id uuid primary key references public.gmail_accounts(id) on delete cascade, encrypted_token text not null);
create table private.oauth_states(state uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),expires_at timestamptz not null default now()+interval '10 minutes');
alter table public.email_rules add foreign key(connection_id) references public.gmail_accounts(id);
alter table public.captured_messages add foreign key(connection_id) references public.gmail_accounts(id);

create function public.create_panel(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 insert into public.panels(name,created_by) values(trim(p_name),auth.uid()) returning id into v_id;
 insert into public.memberships values(v_id,auth.uid(),'admin',now()); return v_id;
end $$;
create function public.invite_member(p_panel uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_token uuid;
begin
 if public.panel_role(p_panel) is distinct from 'admin' then raise exception 'Somente administradores'; end if;
 if p_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' then raise exception 'E-mail inválido'; end if;
 insert into public.invitations(panel_id,email,role) values(p_panel,lower(trim(p_email)),p_role) returning token into v_token;return v_token;
end $$;
create function public.accept_invitation(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.invitations; v_email text;
begin
 select email into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirme seu e-mail antes de aceitar'; end if;
 select * into v from public.invitations where token=p_token and accepted_at is null and expires_at>now() for update;
 if v.id is null or lower(v_email)<>v.email then raise exception 'Convite inválido para esta conta'; end if;
 insert into public.memberships(panel_id,user_id,role) values(v.panel_id,auth.uid(),v.role) on conflict do nothing;
 update public.invitations set accepted_at=now() where id=v.id;return v.panel_id;
end $$;
create function public.change_member(p_panel uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.panels where id=p_panel for update;
 if public.panel_role(p_panel) is distinct from 'admin' then raise exception 'Somente administradores'; end if;
 if exists(select 1 from public.memberships where panel_id=p_panel and user_id=p_user and role='admin') and (p_role is null or p_role<>'admin') and (select count(*) from public.memberships where panel_id=p_panel and role='admin')<=1 then raise exception 'Não é possível remover o último administrador'; end if;
 if p_role is null then delete from public.memberships where panel_id=p_panel and user_id=p_user;
 else update public.memberships set role=p_role where panel_id=p_panel and user_id=p_user;end if;
end $$;

create function private.guard_record() returns trigger language plpgsql security definer set search_path='' as $$
declare v_role text; v_row jsonb; v_client uuid; v_reference uuid; v_expected uuid; v_total numeric;
begin
 v_role:=public.panel_role(new.panel_id);
 if tg_op='UPDATE' then
  if new.panel_id<>old.panel_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'Identidade do registro imutável';end if;
  if new.deleted_at is distinct from old.deleted_at and auth.uid() is not null and v_role is distinct from 'admin' then raise exception 'Somente administrador pode arquivar';end if;
 end if;
 v_row:=to_jsonb(new);v_client:=(v_row->>'client_id')::uuid;
 if v_client is not null and not exists(select 1 from public.clients where id=v_client and panel_id=new.panel_id and deleted_at is null) then raise exception 'Cliente inexistente ou arquivado';end if;
 if tg_table_name='invoices' then
  v_reference:=(v_row->>'request_id')::uuid;
  if v_reference is not null then select client_id into v_expected from public.billing_requests where id=v_reference and panel_id=new.panel_id and deleted_at is null;
   if v_expected is distinct from v_client then raise exception 'Pedido de outro cliente';end if;end if;
  if tg_op='UPDATE' and new.status is distinct from old.status and auth.uid() is not null and v_role is distinct from 'admin' then raise exception 'Somente administrador pode cancelar nota';end if;
 end if;
 if tg_table_name='receivables' then
  perform 1 from public.panels where id=new.panel_id for update;
  if tg_op='UPDATE' then
   if new.client_id<>old.client_id or new.contract_id is distinct from old.contract_id or new.competence is distinct from old.competence then raise exception 'Origem financeira imutável';end if;
   select coalesce(sum(a.amount),0) into v_total from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.receivable_id=new.id and p.status='active';
   if new.amount<v_total then raise exception 'Valor inferior ao já recebido';end if;
   if (new.deleted_at is not null or new.status='cancelled') and v_total>0 then raise exception 'Reverta os pagamentos antes de arquivar/cancelar a cobrança';end if;
  end if;
  v_reference:=(v_row->>'invoice_id')::uuid;
  if v_reference is not null then select client_id into v_expected from public.invoices where id=v_reference and panel_id=new.panel_id and deleted_at is null;
   if v_expected is distinct from v_client then raise exception 'Nota de outro cliente';end if;end if;
  v_reference:=(v_row->>'contract_id')::uuid;
  if v_reference is not null then select client_id into v_expected from public.contracts where id=v_reference and panel_id=new.panel_id and deleted_at is null;
   if v_expected is distinct from v_client then raise exception 'Contrato de outro cliente';end if;end if;
 end if;
 if tg_table_name='services' then
  v_reference:=(v_row->>'contract_id')::uuid;
  if v_reference is not null then select client_id into v_expected from public.contracts where id=v_reference and panel_id=new.panel_id and deleted_at is null;
   if v_expected is distinct from v_client then raise exception 'Contrato de outro cliente';end if;end if;
  v_reference:=(v_row->>'project_id')::uuid;
  if v_reference is not null then select client_id into v_expected from public.projects where id=v_reference and panel_id=new.panel_id and deleted_at is null;
   if v_expected is distinct from v_client then raise exception 'Projeto de outro cliente';end if;end if;
 end if;
 if tg_table_name='email_rules' then
  if not exists(select 1 from public.gmail_accounts g join public.memberships m on m.user_id=g.user_id and m.panel_id=new.panel_id where g.id=new.connection_id) then raise exception 'Conta Gmail sem proprietário neste painel';end if;
  if auth.uid() is not null and not exists(select 1 from public.gmail_accounts where id=new.connection_id and user_id=auth.uid()) then raise exception 'A regra deve usar sua própria conta Gmail';end if;
 end if;
 return new;
end $$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_events(panel_id,actor_id,action,entity,entity_id,changes) values((r->>'panel_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,coalesce((r->>'id')::uuid,(r->>'user_id')::uuid),jsonb_build_object('status',r->>'status','amount',r->>'amount','role',r->>'role','deleted_at',r->>'deleted_at'));
 return coalesce(new,old);
end $$;
create trigger guard_clients before insert or update on public.clients for each row execute function private.guard_record();
create trigger audit_clients after insert or update or delete on public.clients for each row execute function private.audit_change();
create trigger guard_services before insert or update on public.services for each row execute function private.guard_record();
create trigger audit_services after insert or update or delete on public.services for each row execute function private.audit_change();
create trigger guard_billing_requests before insert or update on public.billing_requests for each row execute function private.guard_record();
create trigger audit_billing_requests after insert or update or delete on public.billing_requests for each row execute function private.audit_change();
create trigger guard_contracts before insert or update on public.contracts for each row execute function private.guard_record();
create trigger audit_contracts after insert or update or delete on public.contracts for each row execute function private.audit_change();
create trigger guard_projects before insert or update on public.projects for each row execute function private.guard_record();
create trigger audit_projects after insert or update or delete on public.projects for each row execute function private.audit_change();
create trigger guard_invoices before insert or update on public.invoices for each row execute function private.guard_record();
create trigger audit_invoices after insert or update or delete on public.invoices for each row execute function private.audit_change();
create trigger guard_receivables before insert or update on public.receivables for each row execute function private.guard_record();
create trigger audit_receivables after insert or update or delete on public.receivables for each row execute function private.audit_change();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function private.audit_change();
create trigger audit_payment_allocations after insert or update or delete on public.payment_allocations for each row execute function private.audit_change();
create trigger guard_email_rules before insert or update on public.email_rules for each row execute function private.guard_record();
create trigger audit_email_rules after insert or update or delete on public.email_rules for each row execute function private.audit_change();
create trigger audit_captured_messages after insert or update or delete on public.captured_messages for each row execute function private.audit_change();
create trigger audit_attachments after insert or update or delete on public.attachments for each row execute function private.audit_change();
create trigger audit_members after insert or update or delete on public.memberships for each row execute function private.audit_change();
create trigger audit_invitations after insert or update on public.invitations for each row execute function private.audit_change();

create function public.archive_record(p_panel uuid,p_table text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.panel_role(p_panel) is distinct from 'admin' then raise exception 'Somente administradores';end if;
 if p_table not in ('clients','services','billing_requests','contracts','projects','invoices','receivables','email_rules') then raise exception 'Entidade não arquivável';end if;
 execute format('update public.%I set deleted_at=now() where id=$1 and panel_id=$2',p_table) using p_id,p_panel;
end $$;
create function public.restore_record(p_panel uuid,p_table text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.panel_role(p_panel) is distinct from 'admin' then raise exception 'Somente administradores';end if;
 if p_table not in ('clients','services','billing_requests','contracts','projects','invoices','receivables','email_rules') then raise exception 'Entidade inválida';end if;
 execute format('update public.%I set deleted_at=null where id=$1 and panel_id=$2',p_table) using p_id,p_panel;
end $$;

create function public.record_payment(p_panel uuid,p_client uuid,p_amount numeric,p_date date,p_method text,p_notes text,p_allocations jsonb,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; a jsonb; r public.receivables; v_balance numeric; v_sum numeric:=0; v_amount numeric;
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 select id into v_id from public.payments where panel_id=p_panel and idempotency_key=p_key; if v_id is not null then return v_id;end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) or p_date is null then raise exception 'Valor ou data inválidos';end if;
 if not exists(select 1 from public.clients where id=p_client and panel_id=p_panel and deleted_at is null) then raise exception 'Cliente inválido';end if;
 if jsonb_typeof(p_allocations) is distinct from 'array' then raise exception 'Distribuição inválida';end if;
 for a in select * from jsonb_array_elements(p_allocations) loop
  v_amount:=(a->>'amount')::numeric;
  if v_amount is null or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<=0 or v_amount<>round(v_amount,2) then raise exception 'Valor distribuído inválido';end if;
  select * into r from public.receivables where id=(a->>'receivable_id')::uuid and panel_id=p_panel and client_id=p_client and deleted_at is null and status='active' for update;
  if r.id is null then raise exception 'Cobrança inválida';end if;
  select r.amount-coalesce(sum(x.amount),0) into v_balance from public.payment_allocations x join public.payments p on p.id=x.payment_id where x.receivable_id=r.id and p.status='active';
  if v_amount>v_balance then raise exception 'Distribuição supera saldo';end if;
  v_sum:=v_sum+v_amount;
 end loop;
 if v_sum>p_amount then raise exception 'Distribuição supera pagamento';end if;
 insert into public.payments(panel_id,client_id,amount,paid_date,method,notes,idempotency_key) values(p_panel,p_client,p_amount,p_date,p_method,p_notes,p_key) returning id into v_id;
 for a in select * from jsonb_array_elements(p_allocations) loop
  insert into public.payment_allocations(panel_id,payment_id,receivable_id,amount) values(p_panel,v_id,(a->>'receivable_id')::uuid,(a->>'amount')::numeric);
 end loop;return v_id;
end $$;
create function public.reverse_payment(p_panel uuid,p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.panels where id=p_panel for update;
 if public.panel_role(p_panel) is distinct from 'admin' then raise exception 'Somente administradores';end if;
 if length(trim(coalesce(p_reason,'')))<1 then raise exception 'Informe o motivo';end if;
 update public.payments set status='reversed',reversal_reason=p_reason where id=p_id and panel_id=p_panel and status='active';
 if not found then raise exception 'Pagamento não encontrado ou já revertido';end if;
end $$;
create function public.generate_installments(p_panel uuid) returns integer language plpgsql security definer set search_path='' as $$
declare c public.contracts; v_month date;v_last date;v_n int:=0;v_rows int;
begin
 if auth.uid() is not null and coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 select date_trunc('month',now() at time zone timezone)::date into v_month from public.panels where id=p_panel;
 v_last:=(v_month+interval '1 month - 1 day')::date;
 for c in select * from public.contracts where panel_id=p_panel and deleted_at is null and status='Ativo' and start_date<=v_last and (end_date is null or end_date>=v_month) loop
  insert into public.receivables(panel_id,client_id,contract_id,competence,title,amount,due_date) values(p_panel,c.client_id,c.id,v_month,c.title||' · '||to_char(v_month,'MM/YYYY'),c.amount,v_month+least(c.due_day,extract(day from v_last)::int)-1) on conflict do nothing;
  get diagnostics v_rows=row_count;v_n:=v_n+v_rows;
 end loop;return v_n;
end $$;
create function public.import_invoice(p_panel uuid,p_invoice jsonb,p_receivable uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_client uuid;v_amount numeric;v_date date;v_request uuid;
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 v_client:=(p_invoice->>'client_id')::uuid;v_amount:=(p_invoice->>'net_amount')::numeric;v_date:=(p_invoice->>'issue_date')::date;v_request:=nullif(p_invoice->>'request_id','')::uuid;
 if v_amount<=0 then raise exception 'Valor líquido deve ser positivo para gerar cobrança';end if;
 insert into public.invoices(panel_id,client_id,request_id,title,number,fiscal_key,issuer_document,issue_date,competence,amount,net_amount,description) values(p_panel,v_client,v_request,p_invoice->>'title',p_invoice->>'number',nullif(p_invoice->>'fiscal_key',''),p_invoice->>'issuer_document',v_date,nullif(p_invoice->>'competence','')::date,(p_invoice->>'amount')::numeric,v_amount,p_invoice->>'description') returning id into v_id;
 if p_receivable is not null then
  update public.receivables set invoice_id=v_id where id=p_receivable and panel_id=p_panel and client_id=v_client and invoice_id is null and deleted_at is null and status='active';
  if not found then raise exception 'Cobrança não disponível para vínculo';end if;
 else insert into public.receivables(panel_id,client_id,invoice_id,title,amount,due_date) values(p_panel,v_client,v_id,p_invoice->>'title',v_amount,v_date+20);end if;
 if v_request is not null then update public.billing_requests set status=case when (select coalesce(sum(amount),0) from public.invoices where request_id=v_request and status='Gerada' and deleted_at is null)>=amount then 'Faturado' else 'Parcialmente faturado' end where id=v_request and panel_id=p_panel;end if;
 return v_id;
end $$;
create function public.confirm_capture(p_panel uuid,p_id uuid,p_client uuid,p_extracted jsonb default null) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.captured_messages;v_id uuid;x jsonb;
begin
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 select * into m from public.captured_messages where id=p_id and panel_id=p_panel for update;
 if m.id is null then raise exception 'Captura não encontrada';end if;
 if m.status='confirmed' then return m.confirmed_entity_id;end if;
 if m.status<>'pending' then raise exception 'Captura indisponível';end if;
 x:=coalesce(p_extracted,m.extracted);
 if jsonb_typeof(x)<>'object' then raise exception 'Campos inválidos';end if;
 if m.kind='request' then
  if length(coalesce(x->>'order_number',''))=0 then raise exception 'Pedido sem número: ajuste a regra e capture novamente';end if;
  insert into public.billing_requests(panel_id,client_id,title,order_number,ticket_numbers,amount,instructions) values(p_panel,p_client,x->>'title',x->>'order_number',x->>'ticket_numbers',coalesce((x->>'amount')::numeric,0),x->>'notes') returning id into v_id;
 else insert into public.services(panel_id,client_id,title,ticket_number,reference,amount,notes) values(p_panel,p_client,x->>'title',x->>'ticket_number',x->>'reference',coalesce((x->>'amount')::numeric,0),x->>'notes') returning id into v_id;end if;
 update public.captured_messages set status='confirmed',confirmed_entity_id=v_id where id=m.id;return v_id;
end $$;

-- RLS: deny by default; RPCs handle sensitive writes.
alter table public.panels enable row level security;
create policy panels_read on public.panels for select to authenticated using(public.panel_role(id) is not null);
alter table public.memberships enable row level security;
create policy members_read on public.memberships for select to authenticated using(public.panel_role(panel_id) is not null);
alter table public.invitations enable row level security;
create policy invites_read on public.invitations for select to authenticated using(public.panel_role(panel_id)='admin');
alter table public.gmail_accounts enable row level security;
create policy gmail_read on public.gmail_accounts for select to authenticated using(user_id=auth.uid());
alter table public.clients enable row level security;
create policy read_clients on public.clients for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_clients on public.clients for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_clients on public.clients for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.services enable row level security;
create policy read_services on public.services for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_services on public.services for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_services on public.services for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.billing_requests enable row level security;
create policy read_billing_requests on public.billing_requests for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_billing_requests on public.billing_requests for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_billing_requests on public.billing_requests for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.contracts enable row level security;
create policy read_contracts on public.contracts for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_contracts on public.contracts for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_contracts on public.contracts for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.projects enable row level security;
create policy read_projects on public.projects for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_projects on public.projects for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_projects on public.projects for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.invoices enable row level security;
create policy read_invoices on public.invoices for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_invoices on public.invoices for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_invoices on public.invoices for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.receivables enable row level security;
create policy read_receivables on public.receivables for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_receivables on public.receivables for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null);
create policy update_receivables on public.receivables for update to authenticated using(public.panel_role(panel_id) in ('admin','operator') and deleted_at is null) with check(public.panel_role(panel_id) in ('admin','operator'));
alter table public.payments enable row level security;
create policy read_payments on public.payments for select to authenticated using(public.panel_role(panel_id) is not null);
alter table public.payment_allocations enable row level security;
create policy read_payment_allocations on public.payment_allocations for select to authenticated using(public.panel_role(panel_id) is not null);
alter table public.email_rules enable row level security;
create policy read_email_rules on public.email_rules for select to authenticated using(public.panel_role(panel_id) is not null);
create policy insert_email_rules on public.email_rules for insert to authenticated with check(public.panel_role(panel_id)='admin' and deleted_at is null);
create policy update_email_rules on public.email_rules for update to authenticated using(public.panel_role(panel_id)='admin' and deleted_at is null) with check(public.panel_role(panel_id)='admin');
alter table public.captured_messages enable row level security;
create policy read_captured_messages on public.captured_messages for select to authenticated using(public.panel_role(panel_id) is not null);
alter table public.attachments enable row level security;
create policy read_attachments on public.attachments for select to authenticated using(public.panel_role(panel_id) is not null);
alter table public.audit_events enable row level security;
create policy read_audit_events on public.audit_events for select to authenticated using(public.panel_role(panel_id)='admin');

create function public.attachment_allowed(p_panel uuid,p_entity text,p_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_found boolean;
begin
 if public.panel_role(p_panel) is null or p_entity not in ('invoices','payments','services','billing_requests') then return false;end if;
 execute format('select exists(select 1 from public.%I where id=$1 and panel_id=$2 and deleted_at is null)',p_entity) into v_found using p_id,p_panel;return v_found;
end $$;
create policy insert_attachments on public.attachments for insert to authenticated with check(public.panel_role(panel_id) in ('admin','operator') and split_part(path,'/',1)=panel_id::text and public.attachment_allowed(panel_id,entity,entity_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','application/xml','text/xml','image/png','image/jpeg','application/octet-stream']) on conflict(id) do nothing;
create function public.storage_panel(p_path text) returns uuid language plpgsql immutable set search_path='' as $$ begin return split_part(p_path,'/',1)::uuid;exception when invalid_text_representation then return null;end $$;
create policy document_read on storage.objects for select to authenticated using(bucket_id='documents' and public.panel_role(public.storage_panel(name)) is not null);
create policy document_insert on storage.objects for insert to authenticated with check(bucket_id='documents' and public.panel_role(public.storage_panel(name)) in ('admin','operator'));
create policy document_cleanup on storage.objects for delete to authenticated using(bucket_id='documents' and public.panel_role(public.storage_panel(name)) in ('admin','operator') and owner_id=auth.uid()::text and not exists(select 1 from public.attachments where path=name));
grant select on public.panels,public.memberships,public.invitations,public.gmail_accounts to authenticated;
grant select,insert,update,delete on public.clients to authenticated;
grant select,insert,update,delete on public.services to authenticated;
grant select,insert,update,delete on public.billing_requests to authenticated;
grant select,insert,update,delete on public.contracts to authenticated;
grant select,insert,update,delete on public.projects to authenticated;
grant select,insert,update,delete on public.invoices to authenticated;
grant select,insert,update,delete on public.receivables to authenticated;
grant select,insert,update,delete on public.payments to authenticated;
grant select,insert,update,delete on public.payment_allocations to authenticated;
grant select,insert,update,delete on public.email_rules to authenticated;
grant select,insert,update,delete on public.captured_messages to authenticated;
grant select,insert,update,delete on public.attachments to authenticated;
grant select,insert,update,delete on public.audit_events to authenticated;
revoke all on function public.panel_role(uuid),public.create_panel(text),public.invite_member(uuid,text,text),public.accept_invitation(uuid),public.change_member(uuid,uuid,text),public.archive_record(uuid,text,uuid),public.restore_record(uuid,text,uuid),public.record_payment(uuid,uuid,numeric,date,text,text,jsonb,uuid),public.reverse_payment(uuid,uuid,text),public.generate_installments(uuid),public.import_invoice(uuid,jsonb,uuid),public.confirm_capture(uuid,uuid,uuid,jsonb),public.attachment_allowed(uuid,text,uuid),public.storage_panel(text) from public,anon;
grant execute on function public.panel_role(uuid),public.create_panel(text),public.invite_member(uuid,text,text),public.accept_invitation(uuid),public.change_member(uuid,uuid,text),public.archive_record(uuid,text,uuid),public.restore_record(uuid,text,uuid),public.record_payment(uuid,uuid,numeric,date,text,text,jsonb,uuid),public.reverse_payment(uuid,uuid,text),public.generate_installments(uuid),public.import_invoice(uuid,jsonb,uuid),public.confirm_capture(uuid,uuid,uuid,jsonb),public.attachment_allowed(uuid,text,uuid),public.storage_panel(text) to authenticated;
grant usage on schema private to service_role;
grant all on private.gmail_tokens,private.oauth_states to service_role;
grant all on public.gmail_accounts,public.captured_messages to service_role;
-- Token tables stay in a non-exposed schema. Edge functions access only through service-only RPCs.
create function public.oauth_state_create(p_user uuid) returns uuid language plpgsql security definer set search_path='' as $$ declare v uuid;begin delete from private.oauth_states where expires_at<now();insert into private.oauth_states(user_id) values(p_user) returning state into v;return v;end $$;
create function public.oauth_state_consume(p_state uuid) returns uuid language plpgsql security definer set search_path='' as $$ declare v uuid;begin delete from private.oauth_states where state=p_state and expires_at>now() returning user_id into v;return v;end $$;
create function public.gmail_token_put(p_connection uuid,p_encrypted text) returns void language sql security definer set search_path='' as $$ insert into private.gmail_tokens values(p_connection,p_encrypted) on conflict(connection_id) do update set encrypted_token=excluded.encrypted_token $$;
create function public.gmail_token_get(p_connection uuid) returns text language sql security definer set search_path='' as $$ select encrypted_token from private.gmail_tokens where connection_id=p_connection $$;
revoke all on function public.oauth_state_create(uuid),public.oauth_state_consume(uuid),public.gmail_token_put(uuid,text),public.gmail_token_get(uuid) from public,anon,authenticated;
grant execute on function public.oauth_state_create(uuid),public.oauth_state_consume(uuid),public.gmail_token_put(uuid,text),public.gmail_token_get(uuid) to service_role;

grant all on public.panels,public.memberships,public.invitations,public.clients,public.services,public.billing_requests,public.contracts,public.projects,public.invoices,public.receivables,public.payments,public.payment_allocations,public.email_rules,public.captured_messages,public.attachments,public.audit_events,public.gmail_accounts to service_role;
