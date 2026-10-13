-- Saving a generated requisition records its fiscal document and debt atomically.
create function public.save_requisition_workflow(p_panel uuid,p_request jsonb,p_services uuid[],p_id uuid default null,p_invoice jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_invoice uuid;r public.billing_requests;v_date date;v_due date;
begin
 perform 1 from public.panels where id=p_panel for update;
 if coalesce(public.panel_role(p_panel),'') not in ('admin','operator') then raise exception 'Sem permissão';end if;
 v_id:=public.save_requisition(p_panel,p_request,p_services,p_id);
 select * into r from public.billing_requests where id=v_id and panel_id=p_panel;
 if r.status='Faturado' and not exists(select 1 from public.invoices where request_id=v_id and panel_id=p_panel and status='Gerada' and deleted_at is null) then
  if exists(select 1 from public.invoices i join public.receivables c on c.invoice_id=i.id and c.panel_id=p_panel where i.request_id=v_id and i.panel_id=p_panel and i.deleted_at is not null and c.status='active' and c.deleted_at is null) then raise exception 'Restaure ou ajuste a nota arquivada antes de gerar uma nova cobrança';end if;
  if length(trim(coalesce(p_invoice->>'number','')))=0 then raise exception 'Informe o número da nota já emitida';end if;
  v_date:=nullif(p_invoice->>'issue_date','')::date;
  if v_date is null then raise exception 'Informe a data de emissão da nota';end if;
  v_due:=coalesce(nullif(p_invoice->>'due_date','')::date,v_date+20);
  v_invoice:=public.save_invoice(p_panel,jsonb_build_object('client_id',r.client_id,'request_id',v_id,'title','NF '||trim(p_invoice->>'number')||' · Requisição '||r.order_number,
   'number',trim(p_invoice->>'number'),'issue_date',v_date,'amount',r.amount,'net_amount',r.amount,
   'description','Requisição: '||r.order_number||E'\nChamados: '||coalesce(r.ticket_numbers,'')||E'\n'||coalesce(r.instructions,'')));
  update public.receivables set due_date=v_due where invoice_id=v_invoice and panel_id=p_panel;
 end if;
 -- A status edit cannot hide a document/debt that already exists.
 if exists(select 1 from public.invoices where request_id=v_id and panel_id=p_panel and status='Gerada' and deleted_at is null) then
  update public.billing_requests set status=case when (select coalesce(sum(amount),0) from public.invoices where request_id=v_id and panel_id=p_panel and status='Gerada' and deleted_at is null)>=amount then 'Faturado' else 'Parcialmente faturado' end where id=v_id and panel_id=p_panel;
 end if;
 return v_id;
end $$;
revoke all on function public.save_requisition_workflow(uuid,jsonb,uuid[],uuid,jsonb) from public,anon;
grant execute on function public.save_requisition_workflow(uuid,jsonb,uuid[],uuid,jsonb) to authenticated;
