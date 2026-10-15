-- Match imported services by exact business identifiers inside one client/panel.
create function private.match_imported_service(p_panel uuid,p_client uuid,p_ticket text,p_reference text)
returns table(match_count bigint,service_id uuid) language sql security definer set search_path='' as $$
 select count(*),min(s.id::text)::uuid from public.services s
 where s.panel_id=p_panel and s.client_id=p_client and (
  (nullif(trim(p_ticket),'') is not null and trim(s.ticket_number)=trim(p_ticket)) or
  (nullif(trim(p_reference),'') is not null and upper(trim(s.reference))=upper(trim(p_reference)))
 )
$$;
revoke all on function private.match_imported_service(uuid,uuid,text,text) from public,anon,authenticated;

alter table public.captured_messages add column rule_id uuid;
alter table public.captured_messages add column client_id uuid;
alter table public.captured_messages add column duplicate_service_id uuid;
alter table public.captured_messages add column processing_note text;
alter table public.captured_messages add foreign key(panel_id,rule_id) references public.email_rules(panel_id,id);
alter table public.captured_messages add foreign key(panel_id,client_id) references public.clients(panel_id,id);
alter table public.captured_messages add foreign key(panel_id,duplicate_service_id) references public.services(panel_id,id);

create function private.guard_gmail_capture() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.email_rules;n bigint;v_service uuid;v_destinations int;
begin
 -- Legacy captures without a rule/client are deduplicated at manual confirmation.
 if new.rule_id is null then return new;end if;
 perform 1 from public.panels where id=new.panel_id for update;
 select * into r from public.email_rules where id=new.rule_id and panel_id=new.panel_id and deleted_at is null and status='active';
 if r.id is null or r.connection_id<>new.connection_id or r.kind<>new.kind or lower(trim(r.sender))<>lower(trim(new.sender)) or r.client_id is distinct from new.client_id then raise exception 'Regra de captura inválida';end if;
 if not exists(select 1 from public.gmail_accounts g join public.memberships m on m.user_id=g.user_id and m.panel_id=new.panel_id where g.id=new.connection_id and g.status='active' and m.role in ('admin','operator')) then raise exception 'Conta sem permissão para capturar';end if;
 if new.kind<>'service' or new.client_id is null then return new;end if;
 select count(distinct coalesce(client_id::text,'unset')) into v_destinations from public.email_rules where panel_id=new.panel_id and connection_id=new.connection_id and kind=new.kind and lower(trim(sender))=lower(trim(new.sender)) and status='active' and deleted_at is null;
 if v_destinations>1 then new.processing_note:='Há regras deste remetente para clientes diferentes. Confira o destino.';return new;end if;
 select * into n,v_service from private.match_imported_service(new.panel_id,new.client_id,new.extracted->>'ticket_number',new.extracted->>'reference');
 if n=1 then new.status:='ignored';new.duplicate_service_id:=v_service;new.processing_note:='Serviço já cadastrado: chamado ou referência correspondente.';
 elsif n>1 then new.processing_note:='Chamado/referência correspondem a mais de um serviço. Revise antes de cadastrar.';end if;
 return new;
end $$;
create trigger guard_gmail_capture before insert on public.captured_messages for each row execute function private.guard_gmail_capture();

create or replace function public.confirm_capture(p_panel uuid,p_id uuid,p_client uuid,p_extracted jsonb default null) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.captured_messages;v_id uuid;x jsonb;n bigint;
begin
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 perform 1 from public.panels where id=p_panel for update;
 select * into m from public.captured_messages where id=p_id and panel_id=p_panel and deleted_at is null for update;
 if m.id is null then raise exception 'Captura não encontrada';end if;
 if m.status='confirmed' then return m.confirmed_entity_id;end if;
 if m.status='ignored' and m.duplicate_service_id is not null then return m.duplicate_service_id;end if;
 if m.status<>'pending' then raise exception 'Captura indisponível';end if;
 if not exists(select 1 from public.clients where id=p_client and panel_id=p_panel and deleted_at is null) then raise exception 'Cliente inexistente ou arquivado';end if;
 x:=coalesce(p_extracted,m.extracted);
 if jsonb_typeof(x)<>'object' then raise exception 'Campos inválidos';end if;
 if m.kind='request' then
  if length(coalesce(x->>'order_number',''))=0 then raise exception 'Pedido sem número: ajuste a regra e capture novamente';end if;
  insert into public.billing_requests(panel_id,client_id,title,order_number,ticket_numbers,amount,instructions) values(p_panel,p_client,x->>'title',x->>'order_number',x->>'ticket_numbers',coalesce((x->>'amount')::numeric,0),x->>'notes') returning id into v_id;
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
 update public.captured_messages set status='confirmed',confirmed_entity_id=v_id,client_id=p_client where id=m.id;return v_id;
end $$;
