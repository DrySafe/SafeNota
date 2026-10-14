-- Actual authenticated PostgreSQL checks; all temporary data is rolled back.
begin;
do $test$
declare v_admin uuid:=gen_random_uuid();v_viewer uuid:=gen_random_uuid();v_panel uuid;v_client uuid;v_receivable uuid;v_payment uuid;v_invite uuid;v_denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values
 (v_admin,'payment-date-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated'),
 (v_viewer,'payment-date-'||v_viewer||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);execute 'set local role authenticated';
 v_panel:=public.create_panel('Payment date validation');
 insert into public.clients(panel_id,name) values(v_panel,'Date test') returning id into v_client;
 insert into public.receivables(panel_id,client_id,title,amount) values(v_panel,v_client,'Date test',80) returning id into v_receivable;
 v_payment:=public.record_payment(v_panel,v_client,50,'2026-10-14','PIX','Test',jsonb_build_array(jsonb_build_object('receivable_id',v_receivable,'amount',50)),gen_random_uuid());
 perform public.update_payment_date(v_panel,v_payment,'2026-07-28');
 if not exists(select 1 from public.payments where id=v_payment and paid_date='2026-07-28' and amount=50 and status='active' and client_id=v_client and method='PIX') then raise exception 'FAIL: payment date correction';end if;
 if not exists(select 1 from public.payment_allocations where payment_id=v_payment and receivable_id=v_receivable and amount=50) then raise exception 'FAIL: allocations changed';end if;
 if not exists(select 1 from public.audit_events where entity_id=v_payment and actor_id=v_admin and changes->'before'->>'paid_date'='2026-10-14' and changes->'after'->>'paid_date'='2026-07-28') then raise exception 'FAIL: date audit';end if;
 v_invite:=public.invite_member(v_panel,'payment-date-'||v_viewer||'@example.invalid','viewer');
 perform set_config('request.jwt.claim.sub',v_viewer::text,true);perform public.accept_invitation(v_invite);
 v_denied:=false;begin perform public.update_payment_date(v_panel,v_payment,'2026-09-01');exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: viewer edit';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);perform public.reverse_payment(v_panel,v_payment,'Test');
 v_denied:=false;begin perform public.update_payment_date(v_panel,v_payment,'2026-09-01');exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: reversed payment edit';end if;
end $test$;
rollback;
