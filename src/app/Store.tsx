import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../modules/auth/Auth";
import { supabase } from "../lib/supabase";
import { demoData, emptyData, tables } from "../lib/demo";
import {
  balance,
  cents,
  dueAfter,
  installmentDue,
  today,
  validateAllocation,
} from "../lib/finance";
import type { Panel, Table, Row } from "../types";
function useStoreValue() {
  const { user, demo } = useAuth();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panelId, setPanelId] = useState("");
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const panel = panels.find((p) => p.id === panelId);
  const role = panel?.role;
  const current = (table: Table) =>
    data[table].filter((r) => r.panel_id === panelId && !r.deleted_at);
  async function refresh() {
    if (demo || !user || !supabase) return;
    const gen = ++generation.current;
    setLoading(true);
    try {
      const membership = await supabase
        .from("memberships")
        .select("panel_id,role,panels(id,name)");
      if (membership.error) throw membership.error;
      const ps = (membership.data || []).map((m) => ({
        ...(m.panels as unknown as { id: string; name: string }),
        role: m.role,
      })) as Panel[];
      const results = await Promise.all(
        tables.map(async (t) => {
          const rows: Row[] = [];
          for (let offset = 0; ; offset += 500) {
            const r = await supabase!
              .from(t)
              .select("*")
              .order("created_at", { ascending: false })
              .order("id")
              .range(offset, offset + 499);
            if (r.error) throw r.error;
            rows.push(...r.data);
            if (r.data.length < 500 || gen !== generation.current) break;
          }
          return { data: rows };
        }),
      );
      if (gen !== generation.current) return;
      setPanels(ps);
      setPanelId((old) =>
        ps.some((p) => p.id === old) ? old : ps[0]?.id || "",
      );
      setData(
        Object.fromEntries(
          results.map((r, i) => [tables[i], r.data || []]),
        ) as typeof data,
      );
      setError("");
    } catch (e) {
      if (gen === generation.current) {
        setData(emptyData());
        setPanels([]);
        setPanelId("");
        setError(message(e));
      }
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    generation.current++;
    setData(emptyData());
    setPanels([]);
    setPanelId("");
    setError("");
    if (demo) {
      setData(demoData());
      setPanels([
        { id: "demo-positivo", name: "POSITIVO", role: "admin" },
        { id: "demo-safe", name: "SAFETECHNOLOGY", role: "admin" },
        { id: "demo-daniel", name: "Daniel Regis", role: "admin" },
      ]);
      setPanelId("demo-positivo");
      return;
    }
    if (!user) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
    // Session changes invalidate the entire in-memory cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, demo]);
  function check(admin = false) {
    if (!panelId || !role || role === "viewer" || (admin && role !== "admin"))
      throw new Error("Você não tem permissão para esta ação.");
  }
  function audit(action: string, entity: string, id: string) {
    return {
      id: crypto.randomUUID(),
      panel_id: panelId,
      created_at: new Date().toISOString(),
      action,
      entity,
      entity_id: id,
      actor_id: user?.id || "demo",
    } as Row;
  }
  async function save(
    table: Table,
    values: Record<string, unknown>,
    id?: string,
  ) {
    check(table === "email_rules");
    if (
      [
        "payments",
        "payment_allocations",
        "audit_events",
        "attachments",
        "captured_messages",
        "request_services",
        "invoice_services",
      ].includes(table)
    )
      throw new Error("Use o fluxo específico deste módulo.");
    const payload: Record<string, unknown> = { ...values, panel_id: panelId };
    delete payload.id;
    const providedServices = Array.isArray(payload._service_ids)
      ? (payload._service_ids as string[])
      : null;
    delete payload._service_ids;
    const invoiceDraft = {
      number: payload._invoice_number,
      issue_date: payload._invoice_date,
      due_date: payload._invoice_due_date,
    };
    delete payload._invoice_number;
    delete payload._invoice_date;
    delete payload._invoice_due_date;
    const linkTable =
      table === "billing_requests" ? "request_services" : "invoice_services";
    const parentField =
      table === "billing_requests" ? "request_id" : "invoice_id";
    const selectedServices =
      providedServices ||
      (table === "invoices" &&
      id &&
      current("invoices").find((i) => i.id === id)?.request_id ===
        payload.request_id
        ? current("invoice_services")
            .filter((l) => l.invoice_id === id)
            .map((l) => String(l.service_id))
        : table === "invoices" && payload.request_id
          ? current("request_services")
              .filter((r) => r.request_id === payload.request_id)
              .map((r) => String(r.service_id))
          : id
            ? current(linkTable)
                .filter((r) => r[parentField] === id)
                .map((r) => String(r.service_id))
            : []);
    function linksFor(key: string) {
      return [...new Set(selectedServices)].map(
        (service_id) =>
          ({
            id: crypto.randomUUID(),
            panel_id: panelId,
            created_at: new Date().toISOString(),
            [parentField]: key,
            service_id,
          }) as Row,
      );
    }
    if (demo) {
      const key = id || crypto.randomUUID();
      if (table === "billing_requests" || table === "invoices") {
        if (
          selectedServices.some(
            (serviceId) =>
              !current("services").some(
                (service) =>
                  service.id === serviceId &&
                  service.client_id === payload.client_id,
              ),
          )
        )
          throw new Error(
            "Selecione serviços ativos do mesmo cliente neste painel.",
          );
        if (
          table === "invoices" &&
          payload.request_id &&
          !current("billing_requests").some(
            (request) =>
              request.id === payload.request_id &&
              request.client_id === payload.client_id,
          )
        )
          throw new Error("Selecione uma requisição do mesmo cliente.");
      }
      if (table === "billing_requests") {
        const existingNotes = current("invoices").filter(
          (i) => i.request_id === key && i.status === "Gerada",
        );
        const generate = payload.status === "Faturado" && !existingNotes.length;
        if (
          generate &&
          (!String(invoiceDraft.number || "").trim() ||
            !invoiceDraft.issue_date ||
            Number(payload.amount) <= 0)
        )
          throw new Error(
            "Informe o número, a data da nota já emitida e um valor positivo.",
          );
        const stamp = new Date().toISOString();
        const invoiceId = crypto.randomUUID();
        const invoice = {
          id: invoiceId,
          panel_id: panelId,
          created_at: stamp,
          client_id: payload.client_id,
          request_id: key,
          title: `NF ${invoiceDraft.number} · Requisição ${payload.order_number}`,
          number: String(invoiceDraft.number || "").trim(),
          issue_date: invoiceDraft.issue_date,
          amount: payload.amount,
          net_amount: payload.amount,
          status: "Gerada",
          description: `Requisição: ${payload.order_number} · Chamados: ${payload.ticket_numbers || ""}`,
        } as Row;
        const request = {
          ...payload,
          id: key,
          created_at: stamp,
          ...(existingNotes.length
            ? {
                status:
                  existingNotes.reduce((n, i) => n + cents(i.amount), 0) >=
                  cents(payload.amount)
                    ? "Faturado"
                    : "Parcialmente faturado",
              }
            : {}),
        } as Row;
        setData((d) => ({
          ...d,
          billing_requests: id
            ? d.billing_requests.map((r) =>
                r.id === key
                  ? { ...r, ...request, created_at: r.created_at }
                  : r,
              )
            : [request, ...d.billing_requests],
          request_services: [
            ...linksFor(key),
            ...d.request_services.filter((l) => l.request_id !== key),
          ],
          ...(generate
            ? {
                invoices: [invoice, ...d.invoices],
                invoice_services: [
                  ...selectedServices.map(
                    (service_id) =>
                      ({
                        id: crypto.randomUUID(),
                        panel_id: panelId,
                        created_at: stamp,
                        invoice_id: invoiceId,
                        service_id,
                      }) as Row,
                  ),
                  ...d.invoice_services,
                ],
                receivables: [
                  {
                    id: crypto.randomUUID(),
                    panel_id: panelId,
                    created_at: stamp,
                    client_id: payload.client_id,
                    invoice_id: invoiceId,
                    title: invoice.title,
                    amount: payload.amount,
                    due_date:
                      invoiceDraft.due_date ||
                      dueAfter(String(invoiceDraft.issue_date)),
                    status: "active",
                  } as Row,
                  ...d.receivables,
                ],
              }
            : {}),
          audit_events: [
            audit(id ? "updated" : "created", table, key),
            ...(generate ? [audit("created", "invoices", invoiceId)] : []),
            ...d.audit_events,
          ],
        }));
        return key;
      }
      if (table === "invoices" && !id) {
        if (
          payload.fiscal_key &&
          data.invoices.some(
            (r) =>
              r.panel_id === panelId && r.fiscal_key === payload.fiscal_key,
          )
        )
          throw new Error("Nota já cadastrada.");
        const existingId = String(payload._receivable_id || "");
        delete payload._receivable_id;
        if (
          existingId &&
          !current("receivables").some(
            (r) =>
              r.id === existingId &&
              r.client_id === payload.client_id &&
              !r.invoice_id,
          )
        )
          throw new Error("Cobrança indisponível.");
        const invoice = {
          ...payload,
          id: key,
          created_at: new Date().toISOString(),
        } as Row;
        setData((d) => ({
          ...d,
          invoices: [invoice, ...d.invoices],
          invoice_services: [...linksFor(key), ...d.invoice_services],
          billing_requests: d.billing_requests.map((r) =>
            r.id === payload.request_id ? { ...r, status: "Faturado" } : r,
          ),
          receivables: existingId
            ? d.receivables.map((r) =>
                r.id === existingId ? { ...r, invoice_id: key } : r,
              )
            : [
                {
                  id: crypto.randomUUID(),
                  panel_id: panelId,
                  created_at: new Date().toISOString(),
                  client_id: payload.client_id,
                  invoice_id: key,
                  title: payload.title,
                  amount: payload.net_amount,
                  due_date: dueAfter(String(payload.issue_date)),
                  status: "active",
                },
                ...d.receivables,
              ],
          audit_events: [audit("created", table, key), ...d.audit_events],
        }));
        return key;
      }
      setData((d) => ({
        ...d,
        [table]: id
          ? d[table].map((r) => (r.id === id ? { ...r, ...payload } : r))
          : [
              { ...payload, id: key, created_at: new Date().toISOString() },
              ...d[table],
            ],
        ...(table === "invoices"
          ? {
              [linkTable]: [
                ...linksFor(key),
                ...d[linkTable].filter((r) => r[parentField] !== key),
              ],
            }
          : {}),
        audit_events: [
          audit(id ? "updated" : "created", table, key),
          ...d.audit_events,
        ],
      }));
      return key;
    }
    if (table === "invoices" || table === "billing_requests") {
      const receivable = payload._receivable_id || null;
      delete payload._receivable_id;
      const r =
        table === "invoices"
          ? await supabase!.rpc("save_invoice", {
              p_panel: panelId,
              p_invoice: payload,
              p_services: providedServices,
              p_id: id || null,
              p_receivable: receivable,
            })
          : await supabase!.rpc("save_requisition_workflow", {
              p_panel: panelId,
              p_request: payload,
              p_services: selectedServices,
              p_id: id || null,
              p_invoice: invoiceDraft,
            });
      if (r.error) throw r.error;
      await refresh();
      return r.data as string;
    }
    const q = id
      ? supabase!
          .from(table)
          .update(payload)
          .eq("id", id)
          .eq("panel_id", panelId)
      : supabase!.from(table).insert(payload);
    const r = await q.select("id").single();
    if (r.error) throw r.error;
    await refresh();
    return r.data.id as string;
  }
  async function remove(table: Table, id: string) {
    check(true);
    if (demo)
      setData((d) => ({
        ...d,
        [table]: d[table].map((r) =>
          r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r,
        ),
        audit_events: [audit("archived", table, id), ...d.audit_events],
      }));
    else {
      const r = await supabase!.rpc("archive_record", {
        p_panel: panelId,
        p_table: table,
        p_id: id,
      });
      if (r.error) throw r.error;
      await refresh();
    }
  }
  async function restore(table: Table, id: string) {
    check(true);
    if (demo)
      setData((d) => ({
        ...d,
        [table]: d[table].map((r) =>
          r.id === id ? { ...r, deleted_at: null } : r,
        ),
        audit_events: [audit("restored", table, id), ...d.audit_events],
      }));
    else {
      const r = await supabase!.rpc("restore_record", {
        p_panel: panelId,
        p_table: table,
        p_id: id,
      });
      if (r.error) throw r.error;
      await refresh();
    }
  }
  async function createPanel(name: string) {
    if (name.trim().length < 2)
      throw new Error("Informe um nome com pelo menos 2 caracteres.");
    if (demo) {
      const p = { id: crypto.randomUUID(), name, role: "admin" as const };
      setPanels((ps) => [...ps, p]);
      setPanelId(p.id);
    } else {
      const r = await supabase!.rpc("create_panel", { p_name: name });
      if (r.error) throw r.error;
      await refresh();
      setPanelId(r.data);
    }
  }
  async function recordPayment(input: {
    client_id: string;
    amount: number;
    paid_date: string;
    method: string;
    notes: string;
    allocations: { receivable_id: string; amount: number }[];
    key: string;
  }) {
    check();
    const rs = current("receivables");
    if (
      input.allocations.some(
        (a) =>
          !rs.some(
            (r) => r.id === a.receivable_id && r.client_id === input.client_id,
          ),
      )
    )
      throw new Error("Cobrança de outro cliente ou painel.");
    validateAllocation(
      input.amount,
      input.allocations.map((a) => ({
        ...a,
        balance: balance(
          rs.find((r) => r.id === a.receivable_id)!,
          data.payment_allocations,
          data.payments,
        ),
      })),
    );
    if (demo) {
      const existing = data.payments.find(
        (p) => p.idempotency_key === input.key,
      );
      if (existing) return existing.id;
      const id = crypto.randomUUID();
      setData((d) => ({
        ...d,
        payments: [
          {
            id,
            panel_id: panelId,
            created_at: new Date().toISOString(),
            client_id: input.client_id,
            amount: input.amount,
            paid_date: input.paid_date,
            method: input.method,
            notes: input.notes,
            status: "active",
            idempotency_key: input.key,
          },
          ...d.payments,
        ],
        payment_allocations: [
          ...input.allocations
            .filter((a) => a.amount > 0)
            .map((a) => ({
              ...a,
              id: crypto.randomUUID(),
              panel_id: panelId,
              payment_id: id,
              created_at: new Date().toISOString(),
            })),
          ...d.payment_allocations,
        ],
        audit_events: [
          audit("payment_recorded", "payments", id),
          ...d.audit_events,
        ],
      }));
      return id;
    }
    const r = await supabase!.rpc("record_payment", {
      p_panel: panelId,
      p_client: input.client_id,
      p_amount: input.amount,
      p_date: input.paid_date,
      p_method: input.method,
      p_notes: input.notes,
      p_allocations: input.allocations,
      p_key: input.key,
    });
    if (r.error) throw r.error;
    await refresh();
    return r.data as string;
  }
  async function cancelInvoice(id: string, reason: string) {
    check(true);
    if (!reason.trim()) throw new Error("Informe o motivo.");
    if (demo) {
      const rs = current("receivables").filter((r) => r.invoice_id === id);
      if (
        rs.some(
          (r) =>
            balance(r, data.payment_allocations, data.payments) <
            Number(r.amount),
        )
      )
        throw new Error("Reverta o pagamento antes de cancelar.");
      setData((d) => ({
        ...d,
        invoices: d.invoices.map((r) =>
          r.id === id
            ? { ...r, status: "Cancelada", cancellation_reason: reason }
            : r,
        ),
        receivables: d.receivables.map((r) =>
          r.invoice_id === id ? { ...r, status: "cancelled" } : r,
        ),
        audit_events: [audit("cancelled", "invoices", id), ...d.audit_events],
      }));
    } else {
      const r = await supabase!.rpc("cancel_invoice", {
        p_panel: panelId,
        p_id: id,
        p_reason: reason,
      });
      if (r.error) throw r.error;
      await refresh();
    }
  }
  async function reversePayment(id: string, reason: string) {
    check(true);
    if (!reason.trim()) throw new Error("Informe o motivo.");
    if (demo)
      setData((d) => ({
        ...d,
        payments: d.payments.map((p) =>
          p.id === id
            ? { ...p, status: "reversed", reversal_reason: reason }
            : p,
        ),
        audit_events: [
          audit("payment_reversed", "payments", id),
          ...d.audit_events,
        ],
      }));
    else {
      const r = await supabase!.rpc("reverse_payment", {
        p_panel: panelId,
        p_id: id,
        p_reason: reason,
      });
      if (r.error) throw r.error;
      await refresh();
    }
  }
  async function generateInstallments() {
    check();
    if (!demo) {
      const r = await supabase!.rpc("generate_installments", {
        p_panel: panelId,
      });
      if (r.error) throw r.error;
      await refresh();
      return;
    }
    const month = today().slice(0, 7);
    const rows = current("contracts")
      .filter(
        (c) =>
          c.status === "Ativo" &&
          String(c.start_date || "") <= today() &&
          (!c.end_date || String(c.end_date) >= month + "-01"),
      )
      .filter(
        (c) =>
          !data.receivables.some(
            (r) => r.contract_id === c.id && r.competence === month,
          ),
      )
      .map((c) => ({
        id: crypto.randomUUID(),
        panel_id: panelId,
        created_at: new Date().toISOString(),
        client_id: c.client_id,
        contract_id: c.id,
        title: `${c.title} · ${month}`,
        amount: c.amount,
        competence: month,
        due_date: installmentDue(month, Number(c.due_day)),
        status: "active",
      }));
    setData((d) => ({ ...d, receivables: [...rows, ...d.receivables] }));
  }
  async function attach(file: File, entity: string, id: string) {
    check();
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Arquivo acima de 10 MB.");
    if (!/\.(pdf|xml|png|jpe?g)$/i.test(file.name))
      throw new Error("Use PDF, XML, PNG ou JPEG.");
    if (demo) throw new Error("Anexos reais exigem conexão com Supabase.");
    const path = `${panelId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const u = await supabase!.storage.from("documents").upload(path, file);
    if (u.error) throw u.error;
    const r = await supabase!.from("attachments").insert({
      panel_id: panelId,
      entity,
      entity_id: id,
      path,
      name: file.name,
      size: file.size,
    });
    if (r.error) {
      await supabase!.storage.from("documents").remove([path]);
      throw r.error;
    }
    await refresh();
  }
  return {
    panels,
    panel,
    panelId,
    setPanelId,
    data,
    current,
    role,
    loading,
    error,
    refresh,
    save,
    remove,
    restore,
    createPanel,
    recordPayment,
    reversePayment,
    cancelInvoice,
    generateInstallments,
    attach,
  };
}
export const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Não foi possível concluir. Tente novamente.";
const StoreContext = createContext<ReturnType<typeof useStoreValue> | null>(
  null,
);
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreValue();
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
export const useStore = () => {
  const v = useContext(StoreContext);
  if (!v) throw new Error("StoreProvider ausente");
  return v;
};
export const sumMoney = (rows: Row[], key = "amount") =>
  rows.reduce((s, r) => s + cents(r[key]), 0) / 100;
