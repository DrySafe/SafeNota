-- A full ticket is the primary identifier; references may be shared by tickets.
create or replace function private.match_imported_service(p_panel uuid,p_client uuid,p_ticket text,p_reference text)
returns table(match_count bigint,service_id uuid) language sql security definer set search_path='' as $$
 with ticket_matches as (
  select s.id from public.services s where s.panel_id=p_panel and s.client_id=p_client
  and nullif(trim(p_ticket),'') is not null and trim(s.ticket_number)=trim(p_ticket)
 ), matches as (
  select id from ticket_matches
  union all
  select s.id from public.services s where s.panel_id=p_panel and s.client_id=p_client
  and not exists(select 1 from ticket_matches)
  and nullif(trim(p_reference),'') is not null and upper(trim(s.reference))=upper(trim(p_reference))
 ) select count(*),min(id::text)::uuid from matches
$$;
