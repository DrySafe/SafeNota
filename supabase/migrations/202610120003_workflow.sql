alter table public.projects add column stage_states jsonb not null default '{}'::jsonb check(jsonb_typeof(stage_states)='object');
alter table public.invoices add column cancellation_reason text;
create function public.cancel_invoice(p_panel uuid,p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_request uuid;
begin
 perform 1 from public.panels where id=p_panel for update;
 if public.panel_role(p_panel) is distinct from 'admin' then raise exception 'Somente administradores';end if;
 if length(trim(coalesce(p_reason,'')))<1 then raise exception 'Informe o motivo';end if;
 if exists(select 1 from public.receivables r join public.payment_allocations a on a.receivable_id=r.id join public.payments p on p.id=a.payment_id where r.panel_id=p_panel and r.invoice_id=p_id and p.status='active') then raise exception 'Nota com recebimentos: reverta ou ajuste o pagamento antes do cancelamento';end if;
 update public.receivables set status='cancelled' where invoice_id=p_id and panel_id=p_panel;
 update public.invoices set status='Cancelada',cancellation_reason=p_reason where id=p_id and panel_id=p_panel and status='Gerada' returning request_id into v_request;
 if not found then raise exception 'Nota não encontrada ou já cancelada';end if;
 if v_request is not null then update public.billing_requests set status=case when (select coalesce(sum(amount),0) from public.invoices where request_id=v_request and status='Gerada' and deleted_at is null)=0 then 'A gerar' else 'Parcialmente faturado' end where id=v_request and panel_id=p_panel;end if;
end $$;
revoke all on function public.cancel_invoice(uuid,uuid,text) from public,anon;
grant execute on function public.cancel_invoice(uuid,uuid,text) to authenticated;
create function private.contract_billing() returns trigger language plpgsql security definer set search_path='' as $$ begin perform public.generate_installments(new.panel_id);return new;end $$;
create trigger contract_billing after insert or update on public.contracts for each row execute function private.contract_billing();

-- Invoice insertion must use the atomic RPC that also creates/links its receivable.
drop policy insert_invoices on public.invoices;
create function private.guard_invoice_cancellation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='Cancelada' and old.status<>'Cancelada' and exists(select 1 from public.receivables where invoice_id=new.id and panel_id=new.panel_id and status='active' and deleted_at is null) then raise exception 'Use o fluxo de cancelamento para atualizar a cobrança';end if;
 if old.status='Cancelada' and new.status<>old.status then raise exception 'Nota cancelada não pode ser reativada';end if;
 return new;
end $$;
create trigger guard_invoice_cancellation before update on public.invoices for each row execute function private.guard_invoice_cancellation();

create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; v_before jsonb; v_keys jsonb;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_before:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into v_keys from jsonb_each(r) where tg_op='DELETE' or value is distinct from v_before->key;
 insert into public.audit_events(panel_id,actor_id,action,entity,entity_id,changes) values((r->>'panel_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,coalesce((r->>'id')::uuid,(r->>'user_id')::uuid),jsonb_build_object('changed_fields',v_keys,'before',jsonb_strip_nulls(jsonb_build_object('amount',v_before->'amount','status',v_before->'status','role',v_before->'role','due_date',v_before->'due_date','deleted_at',v_before->'deleted_at')),'after',jsonb_strip_nulls(jsonb_build_object('amount',r->'amount','status',r->'status','role',r->'role','due_date',r->'due_date','deleted_at',r->'deleted_at'))));
 return coalesce(new,old);
end $$;

alter table public.services add constraint services_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.billing_requests add constraint billing_requests_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.contracts add constraint contracts_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.invoices add constraint invoices_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.receivables add constraint receivables_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.payments add constraint payments_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.payment_allocations add constraint payment_allocations_finite_amount check(amount is null or amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.invoices add constraint invoices_finite_net check(net_amount::text not in ('NaN','Infinity','-Infinity'));
