import { describe, expect, it } from "vitest";
import {
  balance,
  dueAfter,
  installmentDue,
  paymentState,
  validateAllocation,
} from "../src/lib/finance";
import type { Row } from "../src/types";
const r = (id: string, values: Record<string, unknown>): Row => ({
  id,
  panel_id: "p",
  created_at: "",
  ...values,
});
describe("Recebimentos", () => {
  it("calcula pagamento parcial e ignora reversão", () => {
    const invoice = r("r", { amount: 100 });
    const allocations = [
      r("a", { receivable_id: "r", payment_id: "p1", amount: 30 }),
      r("b", { receivable_id: "r", payment_id: "p2", amount: 40 }),
    ];
    expect(
      balance(invoice, allocations, [
        r("p1", { status: "active" }),
        r("p2", { status: "reversed" }),
      ]),
    ).toBe(70);
  });
  it("classifica atraso pelo saldo e data", () => {
    const row = r("r", { amount: 100, due_date: "2026-10-01" });
    expect(paymentState(row, 70, "2026-10-12")).toBe("Vencido");
    expect(paymentState(row, 0, "2026-10-12")).toBe("Pago");
  });
  it("não deixa distribuir mais que saldo ou depósito", () => {
    expect(() =>
      validateAllocation(50, [{ amount: 60, balance: 80 }]),
    ).toThrow();
    expect(() =>
      validateAllocation(90, [{ amount: 60, balance: 50 }]),
    ).toThrow();
    expect(() =>
      validateAllocation(100, [
        { amount: 40, balance: 40 },
        { amount: 60, balance: 70 },
      ]),
    ).not.toThrow();
  });
  it("permite saldo ainda não distribuído", () =>
    expect(() =>
      validateAllocation(100, [{ amount: 30, balance: 50 }]),
    ).not.toThrow());
  it("vence em 20 dias corridos atravessando mês", () =>
    expect(dueAfter("2026-09-25")).toBe("2026-10-15"));
  it("limita vencimento ao último dia de fevereiro", () => {
    expect(installmentDue("2026-02", 31)).toBe("2026-02-28");
    expect(installmentDue("2028-02", 31)).toBe("2028-02-29");
  });
});
