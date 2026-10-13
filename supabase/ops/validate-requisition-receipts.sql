-- The complete requisition/receipt lifecycle under real authenticated RLS. No retained fixtures.
begin;
do $test$
declare v_admin uuid:=gen_random_uuid();v_viewer uuid:=gen_random_uuid();v_panel uuid;v_client uuid;v_service uuid;v_request uuid;v_invoice uuid;v_receivable uuid;v_invite uuid;v_count int;v_denied boolean;v_payload jsonb;v_paid numeric;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values
 (v_admin,'receipt-flow-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated'),
 (v_viewer,'receipt-flow-'||v_viewer||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);execute 'set local role authenticated';
 v_panel:=public.create_panel('Receipt flow validation');
 insert into public.clients(panel_id,name) values(v_panel,'Test client') returning id into v_client;
 insert into public.services(panel_id,client_id,title,ticket_number) values(v_panel,v_client,'Test service','0001-1') returning id into v_service;
 v_payload:=jsonb_build_object('client_id',v_client,'title','Test request','order_number','450000TEST','ticket_numbers','0001-1','amount',150,'status','Faturado');
 v_denied:=false;begin perform public.save_requisition_workflow(v_panel,v_payload,array[v_service]);exception when raise_exception then v_denied:=true;end;
 if not v_denied or exists(select 1 from public.billing_requests where panel_id=v_panel) then raise exception 'FAIL: incomplete generation rollback';end if;
 v_request:=public.save_requisition_workflow(v_panel,v_payload,array[v_service],null,jsonb_build_object('number','900TEST','issue_date',current_date,'due_date',current_date+20));
 perform public.save_requisition_workflow(v_panel,v_payload,array[v_service],v_request);
 select count(*),min(id::text)::uuid into v_count,v_invoice from public.invoices where request_id=v_request;
 if v_count<>1 then raise exception 'FAIL: repeated request duplicated invoice';end if;
 select count(*),min(id::text)::uuid into v_count,v_receivable from public.receivables where invoice_id=v_invoice;
 if v_count<>1 then raise exception 'FAIL: repeated request duplicated debt';end if;
 if not exists(select 1 from public.receivables where id=v_receivable and amount=150 and due_date=current_date+20) then raise exception 'FAIL: expected amount/date';end if;
 if not exists(select 1 from public.invoice_services where invoice_id=v_invoice and service_id=v_service) then raise exception 'FAIL: billed call';end if;
 perform public.record_payment(v_panel,v_client,150,current_date,'PIX','Test',jsonb_build_array(jsonb_build_object('receivable_id',v_receivable,'amount',150)),gen_random_uuid());
 select sum(a.amount) into v_paid from public.payment_allocations a join public.payments p on p.id=a.payment_id and p.status='active' join public.receivables r on r.id=a.receivable_id join public.invoices i on i.id=r.invoice_id where i.request_id=v_request;
 if v_paid<>150 then raise exception 'FAIL: received amount by requisition';end if;
 perform public.save_requisition_workflow(v_panel,v_payload||jsonb_build_object('status','A gerar'),array[v_service],v_request);
 if not exists(select 1 from public.billing_requests where id=v_request and status='Faturado') then raise exception 'FAIL: generated document hidden by status edit';end if;
 v_invite:=public.invite_member(v_panel,'receipt-flow-'||v_viewer||'@example.invalid','viewer');
 perform set_config('request.jwt.claim.sub',v_viewer::text,true);perform public.accept_invitation(v_invite);
 v_denied:=false;begin perform public.save_requisition_workflow(v_panel,v_payload,array[v_service],v_request);exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: viewer generation';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);perform public.change_member(v_panel,v_viewer,null);
 perform set_config('request.jwt.claim.sub',v_viewer::text,true);
 if exists(select 1 from public.receivables where id=v_receivable) then raise exception 'FAIL: removed member financial access';end if;
end $test$;
rollback;
