-- Validate friendly labels and retained deletion snapshots without retaining fixtures.
begin;
do $test$
declare v_admin uuid:=gen_random_uuid();v_panel uuid;v_client uuid;v_service uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values(v_admin,'audit-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 execute 'set local role authenticated';
 v_panel:=public.create_panel('History validation');
 insert into public.clients(panel_id,name) values(v_panel,'Client for history') returning id into v_client;
 insert into public.services(panel_id,client_id,title,ticket_number) values(v_panel,v_client,'History service','12345-1') returning id into v_service;
 if not exists(select 1 from public.audit_events where entity_id=v_service and entity_label='Chamado 12345-1' and actor_label='audit-'||v_admin||'@example.invalid') then raise exception 'FAIL: service/actor label';end if;
 execute 'reset role';
 delete from public.services where id=v_service;
 execute 'set local role authenticated';
 if not exists(select 1 from public.audit_events where entity_id=v_service and action='delete' and entity_label='Chamado 12345-1') then raise exception 'FAIL: deletion label snapshot';end if;
 if not exists(select 1 from public.audit_events where entity_id=v_service and action='insert' and entity_label='Chamado 12345-1') then raise exception 'FAIL: original snapshot lost';end if;
end $test$;
rollback;
