alter table public.billing_requests add column ticket_references text;

create or replace function public.save_requisition(p_panel uuid,p_request jsonb,p_services uuid[],p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
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
  insert into public.billing_requests(panel_id,client_id,title,order_number,ticket_numbers,ticket_references,amount,send_deadline,instructions,status)
  values(p_panel,r.client_id,r.title,r.order_number,r.ticket_numbers,r.ticket_references,r.amount,r.send_deadline,r.instructions,coalesce(r.status,'A gerar')) returning id into v_id;
 else
  if exists(select 1 from public.invoices where request_id=p_id and client_id<>r.client_id) then raise exception 'Uma requisição com nota não pode mudar de cliente';end if;
  v_id:=p_id;
  update public.billing_requests set client_id=r.client_id,title=r.title,order_number=r.order_number,ticket_numbers=r.ticket_numbers,ticket_references=r.ticket_references,amount=r.amount,send_deadline=r.send_deadline,instructions=r.instructions,status=r.status where id=v_id and panel_id=p_panel;
 end if;
 delete from public.request_services where request_id=v_id and panel_id=p_panel;
 insert into public.request_services(panel_id,request_id,service_id) select p_panel,v_id,id from (select distinct unnest(p_services) id) ids;
 return v_id;
end $$;

create or replace function public.confirm_capture(p_panel uuid,p_id uuid,p_client uuid,p_extracted jsonb default null) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.captured_messages;v_id uuid;x jsonb;n bigint;
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
