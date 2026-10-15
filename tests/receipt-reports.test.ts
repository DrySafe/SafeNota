import { expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { demoData } from "../src/lib/demo";
import { requestFinancialState } from "../src/modules/requests/financialState";
import { receiptReport } from "../src/modules/payments/reports/data";
import { createReceiptPdf } from "../src/modules/payments/reports/pdf";
function paidFixture(amount = 50) {
  const data = demoData();
  data.payments = [
    {
      id: "p",
      panel_id: "demo-positivo",
      created_at: "",
      client_id: "client-1",
      amount,
      paid_date: "2026-10-14",
      method: "PIX",
      status: "active",
    },
  ];
  data.payment_allocations = [
    {
      id: "a",
      panel_id: "demo-positivo",
      created_at: "",
      payment_id: "p",
      receivable_id: "receivable-1",
      amount,
    },
  ];
  return data;
}
it("classifica requisições pagas, pendentes e atrasadas, inclusive pagamento parcial/revertido", () => {
  const data = paidFixture(50),
    request = data.billing_requests[0];
  expect(requestFinancialState(request, data, "2026-10-14").state).toBe(
    "overdue",
  );
  expect(requestFinancialState(request, data, "2026-10-01").state).toBe(
    "pending",
  );
  data.payment_allocations[0].amount = 80;
  data.payments[0].amount = 80;
  expect(requestFinancialState(request, data, "2026-10-14").state).toBe("paid");
  data.payments[0].status = "reversed";
  expect(requestFinancialState(request, data, "2026-10-14").state).toBe(
    "overdue",
  );
  data.invoices[0].status = "Cancelada";
  expect(requestFinancialState(request, data, "2026-10-14").state).toBe(
    "pending",
  );
});
it("relatório pendente usa saldo atual e exclui outras empresas", () => {
  const data = paidFixture();
  const other = {
    ...data.receivables[0],
    id: "private",
    panel_id: "other",
    amount: 999,
  };
  const report = receiptReport(
    "pending",
    "demo-positivo",
    [...data.receivables, other],
    data,
  );
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0].join(" ")).toContain("4500010497");
  expect(report.rows[0][1]).toBe("23628-1");
  expect(report.rows[0][6]).toContain("30,00");
});
it("depósito para várias cobranças soma uma vez; reversões não entram como pagos", () => {
  const data = paidFixture();
  data.payment_allocations[0].amount = 20;
  data.payment_allocations.push({
    ...data.payment_allocations[0],
    id: "b",
    amount: 30,
  });
  data.payments.push({
    ...data.payments[0],
    id: "reversed",
    status: "reversed",
    amount: 99,
  });
  const report = receiptReport("paid", "demo-positivo", data.payments, data);
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0][5]).toContain("50,00");
  expect(report.summaries[0].value).toContain("50,00");
  expect(report.summaries[2].value).toContain("0,00");
});
it("gera PDF real com paginação para relatório extenso", async () => {
  const data = paidFixture();
  const report = receiptReport(
    "pending",
    "demo-positivo",
    data.receivables,
    data,
  );
  report.rows = Array.from({ length: 65 }, (_, index) =>
    report.rows[0].map((value, column) =>
      column === 1
        ? `${value}\nChamados adicionais de exemplo ${index + 1}`
        : value,
    ),
  );
  const pdf = createReceiptPdf(report, "POSITIVO · Exemplo", [
    "Todos os registros deste painel",
  ]);
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  const bytes = Buffer.from(pdf.output("arraybuffer"));
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await writeFile("/tmp/SafeNota-report-preview.pdf", bytes);
});
