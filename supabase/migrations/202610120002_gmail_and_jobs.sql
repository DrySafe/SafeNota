alter table public.gmail_accounts add column status text not null default 'active' check(status in ('active','disconnected'));
create function public.gmail_token_delete(p_connection uuid) returns void language sql security definer set search_path='' as $$ delete from private.gmail_tokens where connection_id=p_connection $$;
revoke all on function public.gmail_token_delete(uuid) from public,anon,authenticated;
grant execute on function public.gmail_token_delete(uuid) to service_role;
create function private.generate_all_installments() returns void language plpgsql security definer set search_path='' as $$
declare p record;begin for p in select id from public.panels loop perform public.generate_installments(p.id);end loop;end $$;
-- Schedule this function with pg_cron after enabling that extension in Supabase.
-- select cron.schedule('safenota-monthly-billing','0 8 * * *','select private.generate_all_installments()');
