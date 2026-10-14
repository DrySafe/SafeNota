-- Date correction preserves the existing payment, allocations and documents.
create function public.update_payment_date(p_panel uuid,p_payment uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare v_old date;
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Informe a data do recebimento';end if;
 select paid_date into v_old from public.payments where id=p_payment and panel_id=p_panel and status='active' and deleted_at is null for update;
 if not found then raise exception 'Pagamento não encontrado ou revertido';end if;
 if v_old=p_date then return;end if;
 update public.payments set paid_date=p_date where id=p_payment and panel_id=p_panel;
end $$;
revoke all on function public.update_payment_date(uuid,uuid,date) from public,anon;
grant execute on function public.update_payment_date(uuid,uuid,date) to authenticated;

create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; v_before jsonb; v_keys jsonb;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_before:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into v_keys from jsonb_each(r) where tg_op='DELETE' or value is distinct from v_before->key;
 insert into public.audit_events(panel_id,actor_id,action,entity,entity_id,changes) values((r->>'panel_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,coalesce((r->>'id')::uuid,(r->>'user_id')::uuid),jsonb_build_object('changed_fields',v_keys,'before',jsonb_strip_nulls(jsonb_build_object('amount',v_before->'amount','status',v_before->'status','role',v_before->'role','due_date',v_before->'due_date','deleted_at',v_before->'deleted_at','paid_date',v_before->'paid_date')),'after',jsonb_strip_nulls(jsonb_build_object('amount',r->'amount','status',r->'status','role',r->'role','due_date',r->'due_date','deleted_at',r->'deleted_at','paid_date',r->'paid_date'))));
 return coalesce(new,old);
end $$;
