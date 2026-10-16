import { it, expect } from "vitest";
import { requestTicketMatches } from "../src/modules/integrations/requestTickets";
it("prévia mantém ordem, chamados completos e isolamento sem adivinhar pela referência", () => {
  const services = [
    {
      id: "a",
      panel_id: "p",
      client_id: "c",
      ticket_number: "00123-1 ",
      created_at: "",
    },
    {
      id: "b",
      panel_id: "p",
      client_id: "other",
      ticket_number: "00124-1",
      created_at: "",
    },
  ];
  const result = requestTicketMatches(
    services,
    "p",
    "c",
    "00123-1, 00124-1, 00123-1;00123-2",
  );
  expect(result.map((t) => [t.ticket, t.matches.map((s) => s.id)])).toEqual([
    ["00123-1", ["a"]],
    ["00124-1", []],
    ["00123-2", []],
  ]);
});
