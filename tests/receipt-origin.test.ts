import { expect, it } from "vitest";
import { demoData } from "../src/lib/demo";
import { receiptOrigin } from "../src/modules/payments/origin";
it("identifica requisição, nota e chamados pela cobrança", () => {
  const data = demoData();
  const origin = receiptOrigin(data.receivables[0], data);
  expect(origin.label).toBe("Requisição 4500010497 · NF 12");
  expect(origin.tickets).toBe("23628-1");
});
it("preserva os chamados faturados mesmo quando a seleção da requisição muda", () => {
  const data = demoData();
  data.request_services[0].service_id = "service-2";
  data.billing_requests[0].ticket_numbers = "24543-1";
  expect(receiptOrigin(data.receivables[0], data).tickets).toBe("23628-1");
});
it("não deduz origem pelo título nem usa documentos de outro painel", () => {
  const data = demoData();
  data.receivables[0].invoice_id = null;
  expect(receiptOrigin(data.receivables[0], data).label).toBe("");
  data.receivables[0].invoice_id = "invoice-1";
  data.invoices[0].panel_id = "other-panel";
  expect(receiptOrigin(data.receivables[0], data).invoice).toBeUndefined();
});
