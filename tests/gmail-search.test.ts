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

it("busca automática cobre exatamente 24h, sem depender do fuso ou do horário de verão", async () => {
  const { gmailDailyWindow, gmailSearchQuery } =
    await import("../src/modules/integrations/searchPeriod");
  for (const iso of [
    "2026-10-16T09:00:00Z",
    "2026-03-08T09:00:00Z",
    "2026-11-01T09:00:00Z",
  ]) {
    const now = Date.parse(iso);
    const window = gmailDailyWindow(now);
    expect(window.before - window.after).toBe(86400);
    expect(window.before).toBe(now / 1000);
    expect(gmailSearchQuery("sender@example.test", 365, window)).toBe(
      `from:sender@example.test after:${window.after} before:${window.before}`,
    );
  }
  expect(gmailSearchQuery("sender@example.test", 7)).toBe(
    "from:sender@example.test newer_than:7d",
  );
});
