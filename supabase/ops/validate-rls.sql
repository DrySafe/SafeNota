-- Integration checks with temporary Auth/business fixtures. Everything is rolled back.
begin;
do $test$
declare
 v_admin uuid:=gen_random_uuid(); v_operator uuid:=gen_random_uuid(); v_viewer uuid:=gen_random_uuid();
 v_panel uuid; v_other uuid; v_client uuid; v_other_client uuid; v_invite uuid;
 v_receivable uuid; v_payment uuid; v_key uuid:=gen_random_uuid();
 v_contract uuid; v_installment uuid; v_invoice uuid; v_count int; v_denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,aud,role) values
 (v_admin,'safenota-test-'||v_admin||'@example.invalid',now(),now(),now(),'authenticated','authenticated'),
 (v_operator,'safenota-test-'||v_operator||'@example.invalid',now(),now(),now(),'authenticated','authenticated'),
 (v_viewer,'safenota-test-'||v_viewer||'@example.invalid',now(),now(),now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 execute 'set local role authenticated';
 v_panel:=public.create_panel('SafeNota validation A');v_other:=public.create_panel('SafeNota validation B');
 insert into public.clients(panel_id,name) values(v_panel,'Validation client A') returning id into v_client;
 insert into public.clients(panel_id,name) values(v_other,'Validation client B') returning id into v_other_client;
 v_invite:=public.invite_member(v_panel,'safenota-test-'||v_operator||'@example.invalid','operator');
 perform set_config('request.jwt.claim.sub',v_operator::text,true);
 perform public.accept_invitation(v_invite);
 select count(*) into v_count from public.panels where id in (v_panel,v_other);
 if v_count<>1 then raise exception 'FAIL: panel isolation';end if;
 select count(*) into v_count from public.clients where id in (v_client,v_other_client);
 if v_count<>1 then raise exception 'FAIL: client isolation';end if;
 v_denied:=false;begin perform public.archive_record(v_panel,'clients',v_client);exception when raise_exception then v_denied:=sqlerrm='Somente administradores';end;
 if not v_denied then raise exception 'FAIL: operator archive';end if;
 v_denied:=false;begin update public.clients set deleted_at=now() where id=v_client;exception when raise_exception then v_denied:=sqlerrm='Somente administrador pode arquivar';end;
 if not v_denied then raise exception 'FAIL: direct operator archive';end if;
 v_denied:=false;begin insert into public.services(panel_id,client_id,title) values(v_panel,v_other_client,'Invalid cross-panel link');exception when raise_exception then v_denied:=sqlerrm='Cliente inexistente ou arquivado';end;
 if not v_denied then raise exception 'FAIL: cross-panel relationship';end if;
 insert into public.receivables(panel_id,client_id,title,amount,due_date) values(v_panel,v_client,'Validation receivable',100,current_date) returning id into v_receivable;
 v_payment:=public.record_payment(v_panel,v_client,40,current_date,'PIX','Validation',jsonb_build_array(jsonb_build_object('receivable_id',v_receivable,'amount',40)),v_key);
 if public.record_payment(v_panel,v_client,40,current_date,'PIX','Validation',jsonb_build_array(jsonb_build_object('receivable_id',v_receivable,'amount',40)),v_key)<>v_payment then raise exception 'FAIL: idempotency';end if;
 select count(*) into v_count from public.payments where id=v_payment;if v_count<>1 then raise exception 'FAIL: duplicated payment';end if;
 v_denied:=false;begin perform public.record_payment(v_panel,v_client,80,current_date,'PIX','Validation',jsonb_build_array(jsonb_build_object('receivable_id',v_receivable,'amount',80)),gen_random_uuid());exception when raise_exception then v_denied:=sqlerrm='Distribuição supera saldo';end;
 if not v_denied then raise exception 'FAIL: excess allocation';end if;
 v_denied:=false;begin perform public.reverse_payment(v_panel,v_payment,'Validation');exception when raise_exception then v_denied:=sqlerrm='Somente administradores';end;
 if not v_denied then raise exception 'FAIL: operator reversal';end if;
 v_denied:=false;begin perform 1 from private.gmail_tokens;exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: private token exposure';end if;
 v_denied:=false;begin perform public.gmail_token_get(gen_random_uuid());exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: token RPC exposure';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 perform public.reverse_payment(v_panel,v_payment,'Validation correction');
 if not exists(select 1 from public.payments where id=v_payment and status='reversed') then raise exception 'FAIL: admin reversal';end if;
 v_denied:=false;begin perform public.change_member(v_panel,v_admin,null);exception when raise_exception then v_denied:=position('último administrador' in sqlerrm)>0;end;
 if not v_denied then raise exception 'FAIL: last admin protection';end if;
 insert into public.contracts(panel_id,client_id,title,amount,due_day,start_date) values(v_panel,v_client,'Validation recurring',250,31,current_date-interval '1 month') returning id into v_contract;
 perform public.generate_installments(v_panel);perform public.generate_installments(v_panel);
 select count(*),min(id::text)::uuid into v_count,v_installment from public.receivables where contract_id=v_contract;
 if v_count<>1 then raise exception 'FAIL: recurring duplicate';end if;
 v_invoice:=public.import_invoice(v_panel,jsonb_build_object('client_id',v_client,'title','Validation NF','number','VALIDATION','fiscal_key','validation-'||v_contract,'amount',250,'net_amount',250,'issue_date',current_date),v_installment);
 select count(*) into v_count from public.receivables where contract_id=v_contract or invoice_id=v_invoice;if v_count<>1 then raise exception 'FAIL: invoice duplicated installment';end if;
 if not public.attachment_allowed(v_panel,'invoices',v_invoice) then raise exception 'FAIL: attachment ownership';end if;
 v_invite:=public.invite_member(v_panel,'safenota-test-'||v_viewer||'@example.invalid','viewer');
 perform set_config('request.jwt.claim.sub',v_viewer::text,true);perform public.accept_invitation(v_invite);
 v_denied:=false;begin insert into public.clients(panel_id,name) values(v_panel,'Forbidden');exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: viewer write';end if;
 if exists(select 1 from public.audit_events where panel_id=v_panel) then raise exception 'FAIL: viewer audit access';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);perform public.change_member(v_panel,v_operator,null);
 perform set_config('request.jwt.claim.sub',v_operator::text,true);
 if exists(select 1 from public.clients where panel_id=v_panel) then raise exception 'FAIL: access after removal';end if;
 if public.attachment_allowed(v_panel,'invoices',v_invoice) then raise exception 'FAIL: attachment after removal';end if;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.clients) then raise exception 'FAIL: anonymous data access';end if;
 v_denied:=false;begin perform public.create_panel('Forbidden');exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'FAIL: anonymous RPC';end if;
end $test$;
rollback;
