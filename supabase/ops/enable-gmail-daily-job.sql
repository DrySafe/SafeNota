-- Execute only against the authorized SafeNota project after storing the
-- dedicated cron credential in Vault and the Edge Function secrets.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create table if not exists private.gmail_sync_dispatches (
 id bigint generated always as identity primary key,
 dispatched_at timestamptz not null default now(),request_id bigint not null
);
revoke all on private.gmail_sync_dispatches from public,anon,authenticated;
create or replace function private.dispatch_gmail_daily() returns bigint
language plpgsql security definer set search_path='' as $$
declare v_secret text;v_request bigint;
begin
 if not pg_try_advisory_xact_lock(hashtext('safenota-gmail-daily')) then return null;end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='safenota_gmail_daily_cron';
 if v_secret is null then raise exception 'Credencial do agendamento Gmail não configurada';end if;
 v_request:=net.http_post(
  url:='https://fqqnzmhvlvwxlcfwseof.supabase.co/functions/v1/gmail',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
  body:='{"action":"sync-all"}'::jsonb,timeout_milliseconds:=120000
 );
 insert into private.gmail_sync_dispatches(request_id) values(v_request);
 return v_request;
end $$;
revoke all on function private.dispatch_gmail_daily() from public,anon,authenticated;
do $$begin
 if not exists(select 1 from vault.secrets where name='safenota_gmail_daily_cron') then raise exception 'Configure a credencial do agendamento Gmail antes de ativar';end if;
end $$;
-- pg_cron uses UTC: 09:00 UTC = 06:00 America/Sao_Paulo.
select cron.schedule('safenota-gmail-daily','0 9 * * *','select private.dispatch_gmail_daily()');
commit;
