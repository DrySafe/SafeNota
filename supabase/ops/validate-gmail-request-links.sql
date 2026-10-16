begin;
do $test$
declare v_admin uuid:=gen_random_uuid();v_panel uuid;v_client uuid;v_service uuid;v_account uuid;v_capture uuid;v_request uuid;v_invoice uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values(v_admin,'links-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);execute 'set local role authenticated';
 v_panel:=public.create_panel('Gmail service links validation');
 insert into public.clients(panel_id,name) values(v_panel,'Test client') returning id into v_client;
 insert into public.services(panel_id,client_id,title,ticket_number,amount) values(v_panel,v_client,'Existing service','88444-1 ',80) returning id into v_service;
 execute 'reset role';
 insert into public.gmail_accounts(user_id,email) values(v_admin,'links-'||v_admin||'@example.invalid') returning id into v_account;
 insert into public.captured_messages(panel_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_account,'request-links','request','requests@example.invalid','Test request',jsonb_build_object('title','Imported','order_number','4500017777','ticket_numbers','88444-1','amount',80)) returning id into v_capture;
 execute 'set local role authenticated';
 v_request:=public.confirm_capture(v_panel,v_capture,v_client);
 if not exists(select 1 from public.request_services where panel_id=v_panel and request_id=v_request and service_id=v_service) then raise exception 'FAIL: imported ticket not selected';end if;
 perform public.confirm_capture(v_panel,v_capture,v_client);
 if (select count(*) from public.request_services where request_id=v_request)<>1 then raise exception 'FAIL: repeated confirmation duplicates links';end if;
 perform public.save_requisition_workflow(v_panel,(select to_jsonb(r)||jsonb_build_object('status','Faturado') from public.billing_requests r where id=v_request),array[v_service],v_request,jsonb_build_object('number','TEST-LINK','issue_date','2026-10-15'));
 if not exists(select 1 from public.invoice_services l join public.invoices i on i.id=l.invoice_id and i.panel_id=l.panel_id where i.request_id=v_request and l.service_id=v_service) then raise exception 'FAIL: generated invoice missing service';end if;
end $test$;
rollback;
