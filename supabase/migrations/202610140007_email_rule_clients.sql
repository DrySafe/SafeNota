-- Existing rules remain valid; new/edited rules select their destination client in the UI.
alter table public.email_rules add column client_id uuid;
alter table public.email_rules add constraint email_rules_client_panel_fk foreign key(panel_id,client_id) references public.clients(panel_id,id);
-- private.guard_record already validates dynamic client_id against active clients in the same panel.
create index email_rules_sender_destination on public.email_rules(panel_id,connection_id,kind,lower(sender)) where deleted_at is null;
