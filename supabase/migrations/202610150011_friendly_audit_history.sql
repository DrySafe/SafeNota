-- Friendly snapshots preserve record/actor names without exposing auth.users.
alter table public.audit_events add column entity_label text;
alter table public.audit_events add column actor_label text;

create function private.audit_record_label(p_entity text,r jsonb) returns text language plpgsql security definer set search_path='' as $$
declare v_name text;v_client text;
begin
 if r is null then return null;end if;
 if p_entity='captured_messages' then
  return coalesce(case when r->>'kind'='request' then 'Pedido '||nullif(trim(r->'extracted'->>'order_number'),'') else 'Chamado '||nullif(trim(r->'extracted'->>'ticket_number'),'') end,nullif(r->>'subject',''),'E-mail recebido');
 elsif p_entity='billing_requests' then return coalesce('Pedido '||nullif(trim(r->>'order_number'),''),r->>'title');
 elsif p_entity='services' then return coalesce('Chamado '||nullif(trim(r->>'ticket_number'),''),r->>'title',r->>'reference');
 elsif p_entity='invoices' then return coalesce('NF '||nullif(r->>'number',''),r->>'title');
 elsif p_entity='payments' then
  select name into v_client from public.clients where id=(r->>'client_id')::uuid and panel_id=(r->>'panel_id')::uuid;
  return concat_ws(' · ',v_client,'R$ '||replace(r->>'amount','.',','),r->>'method');
 elsif p_entity in ('request_services','invoice_services') then
  return concat_ws(' · ',private.audit_entity_label('services',(r->>'panel_id')::uuid,(r->>'service_id')::uuid),case when p_entity='request_services' then private.audit_entity_label('billing_requests',(r->>'panel_id')::uuid,(r->>'request_id')::uuid) else private.audit_entity_label('invoices',(r->>'panel_id')::uuid,(r->>'invoice_id')::uuid) end);
 elsif p_entity='payment_allocations' then
  return concat_ws(' · ',private.audit_entity_label('receivables',(r->>'panel_id')::uuid,(r->>'receivable_id')::uuid),'R$ '||replace(r->>'amount','.',','));
 elsif p_entity='memberships' then
  select email into v_name from auth.users where id=(r->>'user_id')::uuid;return v_name;
 end if;
 return coalesce(nullif(r->>'name',''),nullif(r->>'title',''),nullif(r->>'email',''));
end $$;
revoke all on function private.audit_record_label(text,jsonb) from public,anon,authenticated;

create function private.audit_entity_label(p_entity text,p_panel uuid,p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 if p_entity='memberships' then
  select to_jsonb(m) into r from public.memberships m where m.panel_id=p_panel and m.user_id=p_id;
 elsif p_entity in ('clients','services','billing_requests','contracts','projects','invoices','receivables','payments','payment_allocations','email_rules','captured_messages','attachments','invitations','request_services','invoice_services') then
  execute format('select to_jsonb(t) from public.%I t where t.panel_id=$1 and t.id=$2',p_entity) into r using p_panel,p_id;
 end if;
 return private.audit_record_label(p_entity,r);
end $$;
revoke all on function private.audit_entity_label(text,uuid,uuid) from public,anon,authenticated;

create function private.label_audit_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.entity_label:=coalesce(new.entity_label,private.audit_entity_label(new.entity,new.panel_id,new.entity_id));
 if new.entity_label is null and new.entity in ('request_services','invoice_services') then
  new.entity_label:=private.audit_record_label(new.entity,coalesce(new.changes,'{}'::jsonb)||jsonb_build_object('panel_id',new.panel_id));
 end if;
 if new.actor_id is null then new.actor_label:=case when new.entity='captured_messages' then 'Automação do Gmail' else 'Sistema' end;
 else select email into new.actor_label from auth.users where id=new.actor_id;end if;
 return new;
end $$;
create trigger label_audit_event before insert on public.audit_events for each row execute function private.label_audit_event();

create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; v_before jsonb; v_keys jsonb;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_before:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into v_keys from jsonb_each(r) where tg_op='DELETE' or value is distinct from v_before->key;
 insert into public.audit_events(panel_id,actor_id,action,entity,entity_id,entity_label,changes) values((r->>'panel_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,coalesce((r->>'id')::uuid,(r->>'user_id')::uuid),private.audit_record_label(tg_table_name,r),jsonb_build_object('changed_fields',v_keys,'before',jsonb_strip_nulls(jsonb_build_object('amount',v_before->'amount','status',v_before->'status','role',v_before->'role','due_date',v_before->'due_date','deleted_at',v_before->'deleted_at','paid_date',v_before->'paid_date')),'after',jsonb_strip_nulls(jsonb_build_object('amount',r->'amount','status',r->'status','role',r->'role','due_date',r->'due_date','deleted_at',r->'deleted_at','paid_date',r->'paid_date'))));
 return coalesce(new,old);
end $$;

-- Resolve older history from surviving records; keep IDs as internal references.
update public.audit_events a set entity_label=private.audit_entity_label(a.entity,a.panel_id,a.entity_id),
actor_label=case when a.actor_id is null then case when a.entity='captured_messages' then 'Automação do Gmail' else 'Sistema' end else (select email from auth.users where id=a.actor_id) end;
