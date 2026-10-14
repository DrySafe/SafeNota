import { expect, it } from "vitest";
import { monthKey, saleMonth } from "../src/lib/periods";
import type { Row } from "../src/types";
const receivable = {
  id: "r",
  panel_id: "p",
  created_at: "2026-10-01T01:30:00Z",
  amount: 80,
  invoice_id: "i",
} as Row;
it("vendas usam a emissão da nota e preservam o isolamento por painel", () => {
  expect(
    saleMonth(receivable, [
      { id: "i", panel_id: "p", created_at: "", issue_date: "2026-07-15" },
    ]),
  ).toBe("2026-07");
  expect(
    saleMonth(receivable, [
      { id: "i", panel_id: "other", created_at: "", issue_date: "2026-07-15" },
    ]),
  ).toBe("2026-09");
});
it("contratos usam competência; cobranças avulsas usam cadastro no fuso brasileiro", () => {
  expect(
    saleMonth(
      { ...receivable, invoice_id: null, competence: "2026-08-01" },
      [],
    ),
  ).toBe("2026-08");
  expect(saleMonth({ ...receivable, invoice_id: null }, [])).toBe("2026-09");
});
it("serviços sem data não recebem um mês inventado", () => {
  expect(monthKey(null)).toBe("");
  expect(monthKey("2026-13-01")).toBe("");
  expect(monthKey("2026-07-28")).toBe("2026-07");
});
