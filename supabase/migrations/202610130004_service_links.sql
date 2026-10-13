-- Explicit service links. Keep legacy request/ticket fields for XML and email compatibility.
create table public.request_services (
 id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id),
 request_id uuid not null, service_id uuid not null, created_at timestamptz not null default now(),
 unique(panel_id,id), unique(request_id,service_id),
 foreign key(panel_id,request_id) references public.billing_requests(panel_id,id),
 foreign key(panel_id,service_id) references public.services(panel_id,id)
);
create table public.invoice_services (
 id uuid primary key default gen_random_uuid(), panel_id uuid not null references public.panels(id),
 invoice_id uuid not null, service_id uuid not null, created_at timestamptz not null default now(),
 unique(panel_id,id), unique(invoice_id,service_id),
 foreign key(panel_id,invoice_id) references public.invoices(panel_id,id),
 foreign key(panel_id,service_id) references public.services(panel_id,id)
);
create index on public.request_services(panel_id,service_id);
create index on public.invoice_services(panel_id,service_id);
alter table public.request_services enable row level security;
alter table public.invoice_services enable row level security;
create policy request_services_read on public.request_services for select to authenticated using(public.panel_role(panel_id) is not null);
create policy invoice_services_read on public.invoice_services for select to authenticated using(public.panel_role(panel_id) is not null);
grant select on public.request_services,public.invoice_services to authenticated;
grant all on public.request_services,public.invoice_services to service_role;

create function private.guard_service_link() returns trigger language plpgsql security definer set search_path='' as $$
declare v_client uuid;v_parent uuid;
begin
 select client_id into v_client from public.services where id=new.service_id and panel_id=new.panel_id and deleted_at is null;
 if tg_table_name='request_services' then select client_id into v_parent from public.billing_requests where id=new.request_id and panel_id=new.panel_id and deleted_at is null;
 else select client_id into v_parent from public.invoices where id=new.invoice_id and panel_id=new.panel_id and deleted_at is null;end if;
 if v_client is null or v_parent is null or v_client<>v_parent then raise exception 'Serviço e documento devem pertencer ao mesmo cliente e painel';end if;
 return new;
end $$;
create trigger guard_request_service before insert or update on public.request_services for each row execute function private.guard_service_link();
create trigger guard_invoice_service before insert or update on public.invoice_services for each row execute function private.guard_service_link();
create function private.audit_service_link() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_events(panel_id,actor_id,action,entity,entity_id,changes)
 values((r->>'panel_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,(r->>'id')::uuid,
 jsonb_strip_nulls(jsonb_build_object('service_id',r->'service_id','request_id',r->'request_id','invoice_id',r->'invoice_id')));
 return coalesce(new,old);
end $$;
create trigger audit_request_service after insert or delete on public.request_services for each row execute function private.audit_service_link();
create trigger audit_invoice_service after insert or delete on public.invoice_services for each row execute function private.audit_service_link();

-- Only unambiguous, exact ticket matches are backfilled. No guessed references.
insert into public.request_services(panel_id,request_id,service_id)
select distinct r.panel_id,r.id,s.id from public.billing_requests r
cross join lateral regexp_split_to_table(coalesce(r.ticket_numbers,''),'[,;\n]+') t(ticket)
join public.services s on s.panel_id=r.panel_id and s.client_id=r.client_id and s.ticket_number=trim(t.ticket) and s.deleted_at is null
where r.deleted_at is null and trim(t.ticket)<>'' and
 (select count(*) from public.services candidate where candidate.panel_id=r.panel_id and candidate.client_id=r.client_id and candidate.ticket_number=trim(t.ticket) and candidate.deleted_at is null)=1
on conflict do nothing;
insert into public.invoice_services(panel_id,invoice_id,service_id)
select i.panel_id,i.id,l.service_id from public.invoices i join public.request_services l on l.request_id=i.request_id and l.panel_id=i.panel_id
where i.deleted_at is null on conflict do nothing;

create function private.inherit_invoice_services() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.request_id is not distinct from old.request_id then return new;end if;
 delete from public.invoice_services where invoice_id=new.id and panel_id=new.panel_id;
 insert into public.invoice_services(panel_id,invoice_id,service_id)
 select new.panel_id,new.id,l.service_id from public.request_services l join public.services s on s.id=l.service_id
 where l.request_id=new.request_id and l.panel_id=new.panel_id and s.deleted_at is null and s.client_id=new.client_id;
 return new;
end $$;
create trigger inherit_invoice_services after insert or update of request_id on public.invoices for each row execute function private.inherit_invoice_services();

create function public.save_requisition(p_panel uuid,p_request jsonb,p_services uuid[],p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.billing_requests;v_id uuid;
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 if p_services is null or array_position(p_services,null) is not null then raise exception 'Seleção de serviços inválida';end if;
 if p_id is not null then
  select * into r from public.billing_requests where id=p_id and panel_id=p_panel and deleted_at is null for update;
  if r.id is null then raise exception 'Requisição não encontrada';end if;
 end if;
 r:=jsonb_populate_record(r,p_request);
 if exists(select 1 from unnest(p_services) id where not exists(select 1 from public.services s where s.id=id and s.panel_id=p_panel and s.client_id=r.client_id and s.deleted_at is null)) then raise exception 'Selecione serviços do mesmo cliente e painel';end if;
 if p_id is null then
  insert into public.billing_requests(panel_id,client_id,title,order_number,ticket_numbers,amount,send_deadline,instructions,status)
  values(p_panel,r.client_id,r.title,r.order_number,r.ticket_numbers,r.amount,r.send_deadline,r.instructions,coalesce(r.status,'A gerar')) returning id into v_id;
 else
  if exists(select 1 from public.invoices where request_id=p_id and client_id<>r.client_id) then raise exception 'Uma requisição com nota não pode mudar de cliente';end if;
  v_id:=p_id;
  update public.billing_requests set client_id=r.client_id,title=r.title,order_number=r.order_number,ticket_numbers=r.ticket_numbers,amount=r.amount,send_deadline=r.send_deadline,instructions=r.instructions,status=r.status where id=v_id and panel_id=p_panel;
 end if;
 delete from public.request_services where request_id=v_id and panel_id=p_panel;
 insert into public.request_services(panel_id,request_id,service_id) select p_panel,v_id,id from (select distinct unnest(p_services) id) ids;
 return v_id;
end $$;

create function public.set_invoice_services(p_panel uuid,p_invoice uuid,p_services uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;v_current uuid[];
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 select * into i from public.invoices where id=p_invoice and panel_id=p_panel and deleted_at is null for update;
 if i.id is null then raise exception 'Nota não encontrada';end if;
 if p_services is null or array_position(p_services,null) is not null then raise exception 'Seleção de serviços inválida';end if;
 select coalesce(array_agg(service_id order by service_id),'{}'::uuid[]) into v_current from public.invoice_services where invoice_id=i.id;
 if v_current=coalesce((select array_agg(distinct id order by id) from unnest(p_services) id),'{}'::uuid[]) then return;end if;
 if i.status<>'Gerada' then raise exception 'Não é possível alterar serviços de nota cancelada';end if;
 if exists(select 1 from unnest(p_services) id where not exists(select 1 from public.services s where s.id=id and s.panel_id=p_panel and s.client_id=i.client_id and s.deleted_at is null)) then raise exception 'Selecione serviços do mesmo cliente e painel';end if;
 delete from public.invoice_services where invoice_id=i.id and panel_id=p_panel;
 insert into public.invoice_services(panel_id,invoice_id,service_id) select p_panel,i.id,id from (select distinct unnest(p_services) id) ids;
end $$;

create function public.save_invoice(p_panel uuid,p_invoice jsonb,p_services uuid[] default null,p_id uuid default null,p_receivable uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices;v_id uuid;
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 if p_id is null then v_id:=public.import_invoice(p_panel,p_invoice,p_receivable);
 else
  select * into i from public.invoices where id=p_id and panel_id=p_panel and deleted_at is null for update;
  if i.id is null then raise exception 'Nota não encontrada';end if;
  i:=jsonb_populate_record(i,p_invoice);
  update public.invoices set client_id=i.client_id,request_id=i.request_id,title=i.title,number=i.number,fiscal_key=i.fiscal_key,amount=i.amount,net_amount=i.net_amount,issue_date=i.issue_date,status=i.status,description=i.description where id=p_id and panel_id=p_panel;
  v_id:=p_id;
 end if;
 if p_services is not null then perform public.set_invoice_services(p_panel,v_id,p_services);end if;
 return v_id;
end $$;

create function private.guard_service_client_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.client_id=old.client_id then return new;end if;
 if tg_table_name='services' and (exists(select 1 from public.request_services where service_id=old.id) or exists(select 1 from public.invoice_services where service_id=old.id)) then raise exception 'Remova os vínculos antes de mudar o cliente do serviço';end if;
 if tg_table_name='invoices' and (exists(select 1 from public.invoice_services where invoice_id=old.id) or exists(select 1 from public.receivables where invoice_id=old.id)) then raise exception 'Uma nota vinculada não pode mudar de cliente';end if;
 if tg_table_name='billing_requests' and (exists(select 1 from public.request_services where request_id=old.id) or exists(select 1 from public.invoices where request_id=old.id)) then raise exception 'Uma requisição vinculada não pode mudar de cliente';end if;
 return new;
end $$;
create trigger guard_service_client_change before update of client_id on public.services for each row execute function private.guard_service_client_change();
create trigger guard_invoice_client_change before update of client_id on public.invoices for each row execute function private.guard_service_client_change();
create trigger guard_request_client_change before update of client_id on public.billing_requests for each row execute function private.guard_service_client_change();
revoke all on function public.save_requisition(uuid,jsonb,uuid[],uuid),public.set_invoice_services(uuid,uuid,uuid[]),public.save_invoice(uuid,jsonb,uuid[],uuid,uuid) from public,anon;
grant execute on function public.save_requisition(uuid,jsonb,uuid[],uuid),public.set_invoice_services(uuid,uuid,uuid[]),public.save_invoice(uuid,jsonb,uuid[],uuid,uuid) to authenticated;
