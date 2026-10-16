-- Real authenticated/worker capture checks, with every fixture rolled back.
begin;
do $test$
declare v_admin uuid:=gen_random_uuid();v_panel uuid;v_client uuid;v_account uuid;v_rule uuid;v_service uuid;v_capture uuid;v_a uuid;v_b uuid;v_new uuid;v_denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values(v_admin,'gmail-dedup-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);execute 'set local role authenticated';
 v_panel:=public.create_panel('Gmail duplicate validation');
 insert into public.clients(panel_id,name) values(v_panel,'Test client') returning id into v_client;
 insert into public.services(panel_id,client_id,title,ticket_number,reference,amount) values(v_panel,v_client,'Original','88888-1','INC88888',50) returning id into v_service;
 execute 'reset role';
 insert into public.gmail_accounts(user_id,email) values(v_admin,'gmail-dedup-'||v_admin||'@example.invalid') returning id into v_account;
 execute 'set local role authenticated';
 insert into public.email_rules(panel_id,client_id,connection_id,title,sender,kind,status) values(v_panel,v_client,v_account,'Test rule','tickets@example.invalid','service','active') returning id into v_rule;
 execute 'set local role service_role';
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'duplicate-reference','service','tickets@example.invalid','Test',jsonb_build_object('title','Incoming','ticket_number','99999-1','reference','inc88888','amount',99)) returning id into v_capture;
 if not exists(select 1 from public.captured_messages where id=v_capture and status='ignored' and duplicate_service_id=v_service) then raise exception 'FAIL: ignore duplicate by reference';end if;
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'new-a','service','tickets@example.invalid','Test',jsonb_build_object('title','New','ticket_number','77777-1','reference','SUP77777','amount',40)) returning id into v_a;
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'new-b','service','tickets@example.invalid','Test',jsonb_build_object('title','New','ticket_number','77777-1','reference','SUP77777','amount',40)) returning id into v_b;
 execute 'set local role authenticated';
 v_new:=public.confirm_capture(v_panel,v_a,v_client);
 if public.confirm_capture(v_panel,v_b,v_client)<>v_new then raise exception 'FAIL: repeated confirmation';end if;
 if (select count(*) from public.services where panel_id=v_panel and client_id=v_client and ticket_number='77777-1')<>1 then raise exception 'FAIL: duplicate service inserted';end if;
 if not exists(select 1 from public.services where id=v_service and title='Original' and amount=50) then raise exception 'FAIL: existing service changed';end if;
 insert into public.services(panel_id,client_id,title,ticket_number,reference) values(v_panel,v_client,'Shared ref','66666-1','SUP77777');
 execute 'set local role service_role';
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'conflict','service','tickets@example.invalid','Test',jsonb_build_object('title','Conflict','ticket_number','00000-1','reference','SUP77777','amount',40)) returning id into v_capture;
 if not exists(select 1 from public.captured_messages where id=v_capture and status='pending' and processing_note is not null) then raise exception 'FAIL: identifier conflict hidden';end if;
 execute 'set local role authenticated';
 v_denied:=false;begin perform public.confirm_capture(v_panel,v_capture,v_client);exception when raise_exception then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: conflict confirmed';end if;
 -- Requests use exact order number and preserve existing data.
 insert into public.billing_requests(panel_id,client_id,title,order_number,amount) values(v_panel,v_client,'Original request',' 4500012345 ',80) returning id into v_service;
 insert into public.email_rules(panel_id,client_id,connection_id,title,sender,kind,status) values(v_panel,v_client,v_account,'Request rule','requests@example.invalid','request','active') returning id into v_rule;
 execute 'set local role service_role';
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'request-duplicate','request','requests@example.invalid','Test',jsonb_build_object('title','Incoming','order_number','4500012345','amount',999)) returning id into v_capture;
 if not exists(select 1 from public.captured_messages where id=v_capture and status='ignored' and duplicate_request_id=v_service) then raise exception 'FAIL: request duplicate not ignored';end if;
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'request-a','request','requests@example.invalid','Test',jsonb_build_object('title','New request','order_number','4500012346','reference','INC-12345, SUP-67890','amount',40)) returning id into v_a;
 insert into public.captured_messages(panel_id,rule_id,client_id,connection_id,message_id,kind,sender,subject,extracted) values(v_panel,v_rule,v_client,v_account,'request-b','request','requests@example.invalid','Test',jsonb_build_object('title','New request','order_number','4500012346','reference','INC-12345, SUP-67890','amount',40)) returning id into v_b;
 execute 'set local role authenticated';
 v_new:=public.confirm_capture(v_panel,v_a,v_client);
 if public.confirm_capture(v_panel,v_b,v_client)<>v_new then raise exception 'FAIL: repeated request confirmation';end if;
 if not exists(select 1 from public.billing_requests where id=v_new and ticket_references='INC-12345, SUP-67890') then raise exception 'FAIL: request references lost';end if;
 if (select count(*) from public.billing_requests where panel_id=v_panel and order_number='4500012346')<>1 then raise exception 'FAIL: request inserted twice';end if;
 if not exists(select 1 from public.billing_requests where id=v_service and title='Original request' and amount=80) then raise exception 'FAIL: original request modified';end if;
end $test$;
rollback;
