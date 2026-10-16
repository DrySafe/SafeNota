-- Ticket text and actual service selection must be persisted together.
create function private.request_ticket_matches(p_panel uuid,p_client uuid,p_tickets text)
returns table(ticket text,ticket_order bigint,match_count bigint,service_id uuid)
language sql security definer set search_path='' as $$
 with tickets as (
  select trim(t.value) as ticket,min(t.ordinality) as ticket_order
  from regexp_split_to_table(coalesce(p_tickets,''),'[,;\n]+') with ordinality t(value,ordinality)
  where trim(t.value)<>'' group by trim(t.value)
 )
 select t.ticket,t.ticket_order,count(s.id),min(s.id::text)::uuid from tickets t
 left join public.services s on s.panel_id=p_panel and s.client_id=p_client
 and s.deleted_at is null and trim(s.ticket_number)=t.ticket
 group by t.ticket,t.ticket_order
$$;
revoke all on function private.request_ticket_matches(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.confirm_capture(p_panel uuid,p_id uuid,p_client uuid,p_extracted jsonb default null) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.captured_messages;v_id uuid;x jsonb;n bigint;v_note text;v_unmatched text;
begin
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 perform 1 from public.panels where id=p_panel for update;
 select * into m from public.captured_messages where id=p_id and panel_id=p_panel and deleted_at is null for update;
 if m.id is null then raise exception 'Captura não encontrada';end if;
 if m.status='confirmed' then return m.confirmed_entity_id;end if;
 if m.status='ignored' and coalesce(m.duplicate_service_id,m.duplicate_request_id) is not null then return coalesce(m.duplicate_service_id,m.duplicate_request_id);end if;
 if m.status<>'pending' then raise exception 'Captura indisponível';end if;
 if not exists(select 1 from public.clients where id=p_client and panel_id=p_panel and deleted_at is null) then raise exception 'Cliente inexistente ou arquivado';end if;
 x:=coalesce(p_extracted,m.extracted);
 if jsonb_typeof(x)<>'object' then raise exception 'Campos inválidos';end if;
 if m.kind='request' then
  if nullif(trim(x->>'order_number'),'') is null then raise exception 'Pedido sem número: ajuste a regra e capture novamente';end if;
  select * into n,v_id from private.match_imported_request(p_panel,p_client,x->>'order_number');
  if n>1 then raise exception 'Há mais de uma requisição com este número do pedido. Revise os registros.';end if;
  if n=1 then
   update public.captured_messages set status='ignored',duplicate_request_id=v_id,client_id=p_client,extracted=x,processing_note='Requisição já cadastrada: mesmo número do pedido.' where id=m.id;
   return v_id;
  end if;
  insert into public.billing_requests(panel_id,client_id,title,order_number,ticket_numbers,ticket_references,amount,instructions) values(p_panel,p_client,x->>'title',trim(x->>'order_number'),x->>'ticket_numbers',x->>'reference',coalesce((x->>'amount')::numeric,0),x->>'notes') returning id into v_id;
  insert into public.request_services(panel_id,request_id,service_id)
  select p_panel,v_id,service_id from private.request_ticket_matches(p_panel,p_client,x->>'ticket_numbers') where match_count=1
  on conflict do nothing;
  select string_agg(ticket||case when match_count=0 then ' (não encontrado)' else ' (mais de um serviço)' end,', ' order by ticket_order)
  into v_unmatched from private.request_ticket_matches(p_panel,p_client,x->>'ticket_numbers') where match_count<>1;
  v_note:=case when v_unmatched is not null then 'Requisição cadastrada. Revise os chamados não vinculados: '||v_unmatched
   when not exists(select 1 from private.request_ticket_matches(p_panel,p_client,x->>'ticket_numbers')) then 'Requisição cadastrada sem chamados informados. Selecione os serviços ao editar.'
   else 'Requisição cadastrada com os serviços vinculados automaticamente.' end;
 else
  select * into n,v_id from private.match_imported_service(p_panel,p_client,x->>'ticket_number',x->>'reference');
  if n>1 then raise exception 'Chamado e referência apontam para mais de um serviço. Revise os identificadores.';end if;
  if n=1 then
   update public.captured_messages set status='ignored',duplicate_service_id=v_id,client_id=p_client,extracted=x,processing_note='Serviço já cadastrado: chamado ou referência correspondente.' where id=m.id;
   return v_id;
  end if;
  if nullif(trim(x->>'ticket_number'),'') is null and nullif(trim(x->>'reference'),'') is null then raise exception 'Informe o chamado completo ou a referência do serviço';end if;
  insert into public.services(panel_id,client_id,title,ticket_number,reference,amount,notes) values(p_panel,p_client,x->>'title',nullif(trim(x->>'ticket_number'),''),nullif(trim(x->>'reference'),''),coalesce((x->>'amount')::numeric,0),x->>'notes') returning id into v_id;
 end if;
 update public.captured_messages set status='confirmed',confirmed_entity_id=v_id,client_id=p_client,extracted=x,processing_note=v_note where id=m.id;return v_id;
end $$;

-- Repair only confirmed Gmail imports with no existing service selection.
-- Preserve selections users have already saved manually.
create temporary table gmail_requests_to_link on commit drop as
select distinct r.id,r.panel_id,r.client_id,r.ticket_numbers
from public.billing_requests r join public.captured_messages m
 on m.panel_id=r.panel_id and m.confirmed_entity_id=r.id and m.kind='request' and m.status='confirmed'
where r.deleted_at is null and r.status<>'Cancelado'
 and not exists(select 1 from public.request_services l where l.panel_id=r.panel_id and l.request_id=r.id);
insert into public.request_services(panel_id,request_id,service_id)
select r.panel_id,r.id,t.service_id from gmail_requests_to_link r
cross join lateral private.request_ticket_matches(r.panel_id,r.client_id,r.ticket_numbers) t
where t.match_count=1 on conflict do nothing;
-- Generated notes created before the repair inherit the repaired selection only
-- when they have no manual selection of their own.
insert into public.invoice_services(panel_id,invoice_id,service_id)
select i.panel_id,i.id,l.service_id from gmail_requests_to_link r
join public.invoices i on i.panel_id=r.panel_id and i.request_id=r.id and i.deleted_at is null and i.status='Gerada'
join public.request_services l on l.panel_id=r.panel_id and l.request_id=r.id
where not exists(select 1 from public.invoice_services x where x.panel_id=i.panel_id and x.invoice_id=i.id)
on conflict do nothing;
