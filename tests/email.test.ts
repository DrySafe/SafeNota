import { expect, it } from "vitest";
import { extractEmail } from "../src/modules/integrations/extract";
it("captura pedido e valor brasileiro", () =>
  expect(
    extractEmail(
      "Número do Pedido: 4500010497\nValor Total da Nota Fiscal: R$ 1.280,50\n23628-1 INC0654023",
      "request",
    ),
  ).toMatchObject({
    order_number: "4500010497",
    amount: 1280.5,
    ticket_numbers: "23628-1",
    reference: "INC0654023",
  }));
it("preserva chamado completo da transferência", () =>
  expect(
    extractEmail(
      "O chamado de número 24543-1 acaba de ser transferido. SUP-2056668",
      "service",
    ),
  ).toMatchObject({ ticket_number: "24543-1", reference: "SUP-2056668" }));
it("recusa padrões com repetição de grupos", () =>
  expect(() =>
    extractEmail("aaaa", "service", { ticket_number: "(a+)+$" }),
  ).toThrow());
