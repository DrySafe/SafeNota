-- Real PostgreSQL/RLS checks. Fixtures and audit events are rolled back.
begin;
do $test$
declare
 v_admin uuid:=gen_random_uuid();v_viewer uuid:=gen_random_uuid();
 v_panel uuid;v_other uuid;v_client uuid;v_wrong_client uuid;v_other_client uuid;
 v_a uuid;v_b uuid;v_wrong uuid;v_other_service uuid;v_request uuid;v_invoice uuid;v_count int;v_before int;v_denied boolean;v_invite uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values
 (v_admin,'service-link-test-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated'),
 (v_viewer,'service-link-test-'||v_viewer||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 execute 'set local role authenticated';
 v_panel:=public.create_panel('Service link validation A');v_other:=public.create_panel('Service link validation B');
 insert into public.clients(panel_id,name) values(v_panel,'A') returning id into v_client;
 insert into public.clients(panel_id,name) values(v_panel,'Different client') returning id into v_wrong_client;
 insert into public.clients(panel_id,name) values(v_other,'B') returning id into v_other_client;
 insert into public.services(panel_id,client_id,title,ticket_number) values(v_panel,v_client,'A','001-1') returning id into v_a;
 insert into public.services(panel_id,client_id,title,ticket_number) values(v_panel,v_client,'B','002-1') returning id into v_b;
 insert into public.services(panel_id,client_id,title) values(v_panel,v_wrong_client,'Wrong client') returning id into v_wrong;
 insert into public.services(panel_id,client_id,title) values(v_other,v_other_client,'Wrong panel') returning id into v_other_service;
 v_request:=public.save_requisition(v_panel,jsonb_build_object('client_id',v_client,'title','Requisição teste','order_number','validation','amount',80),array[v_a,v_b]);
 select count(*) into v_count from public.request_services where request_id=v_request;
 if v_count<>2 then raise exception 'FAIL: request services';end if;
 v_invoice:=public.save_invoice(v_panel,jsonb_build_object('client_id',v_client,'request_id',v_request,'title','NF teste','number','VALIDATION','amount',80,'net_amount',80,'issue_date',current_date));
 select count(*) into v_count from public.invoice_services where invoice_id=v_invoice;
 if v_count<>2 then raise exception 'FAIL: inherited services';end if;
 perform public.save_requisition(v_panel,jsonb_build_object('client_id',v_client,'title','Requisição teste','order_number','validation','amount',80),array[v_a],v_request);
 select count(*) into v_count from public.invoice_services where invoice_id=v_invoice;
 if v_count<>2 then raise exception 'FAIL: existing invoice changed';end if;
 v_denied:=false;begin perform public.set_invoice_services(v_panel,v_invoice,array[v_other_service]);exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: cross-panel service';end if;
 select count(*) into v_before from public.receivables where panel_id=v_panel;
 v_denied:=false;begin perform public.save_invoice(v_panel,jsonb_build_object('client_id',v_client,'title','Invalid','number','INVALID','amount',80,'net_amount',80,'issue_date',current_date),array[v_wrong]);exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: cross-client service';end if;
 select count(*) into v_count from public.receivables where panel_id=v_panel;
 if v_count<>v_before or exists(select 1 from public.invoices where panel_id=v_panel and number='INVALID') then raise exception 'FAIL: atomic rollback';end if;
 perform public.set_invoice_services(v_panel,v_invoice,array[v_a]);
 if not exists(select 1 from public.audit_events where panel_id=v_panel and entity='invoice_services' and changes->>'service_id'=v_b::text and action='delete') then raise exception 'FAIL: link deletion audit';end if;
 v_invite:=public.invite_member(v_panel,'service-link-test-'||v_viewer||'@example.invalid','viewer');
 perform set_config('request.jwt.claim.sub',v_viewer::text,true);perform public.accept_invitation(v_invite);
 if exists(select 1 from public.request_services where panel_id=v_other) then raise exception 'FAIL: link visibility';end if;
 v_denied:=false;begin perform public.set_invoice_services(v_panel,v_invoice,array[]::uuid[]);exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: viewer service write';end if;
 v_denied:=false;begin insert into public.invoice_services(panel_id,invoice_id,service_id) values(v_panel,v_invoice,v_b);exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: direct link insert';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);perform public.change_member(v_panel,v_viewer,null);
 perform set_config('request.jwt.claim.sub',v_viewer::text,true);
 if exists(select 1 from public.invoice_services where panel_id=v_panel) then raise exception 'FAIL: removed member';end if;
end $test$;
rollback;
