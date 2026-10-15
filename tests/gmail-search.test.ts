import { expect, it } from "vitest";
import { gmailSearchDays } from "../src/modules/integrations/searchPeriod";
it("usa 30 dias por padrão e aceita períodos inteiros de 1 a 365", () => {
  expect(gmailSearchDays(undefined)).toBe(30);
  for (const days of [1, 3, 7, 30, 90, 365])
    expect(gmailSearchDays(days)).toBe(days);
});
it("rejeita períodos inválidos antes de consultar o Gmail", () => {
  for (const value of [
    null,
    "7",
    "1 OR from:other@example.test",
    0,
    -1,
    1.5,
    366,
    NaN,
    Infinity,
  ]) {
    expect(() => gmailSearchDays(value)).toThrow("entre 1 e 365 dias");
  }
});
