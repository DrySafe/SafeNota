import { expect, it } from "vitest";
import { extractEmail } from "../src/modules/integrations/extract";
import {
  assessEmailAutomation,
  type AutomationContext,
} from "../src/modules/integrations/automation";
import { demoData } from "../src/lib/demo";
const request = `Prezados,
Valor Total da Nota Fiscal: **R$ 80,00**
Número do Pedido: **4500010999**;
CHAMADOS REFERENTES À NOTA FISCAL
| Chamado | Referência | Valor |
| 23628-1 | INC0654023 | R$ 80,00 |
DADOS DO TOMADOR DO SERVIÇO
CNPJ: 05.510.654/0004-21
Brasília/DF – CEP 70070-120
O prazo limite para envio da Nota Fiscal é **09/10/2026**.`;
const transfer = `O chamado de número **24543-1** acaba de ser transferido para sua chave.
Chamado: 24543
SUP-2056668
Descrição: Configuração BIOS legacy para UEFI pc iniciou.
Status do atendimento: concluído`;
function context(kind: "request" | "service" = "request"): AutomationContext {
  const data = demoData();
  return {
    kind,
    panelId: "demo-positivo",
    clientId: "client-1",
    services: data.services,
    requests: data.billing_requests,
  };
}
it("extrai o modelo Positivo sem transformar CNPJ ou CEP em chamados", () => {
  expect(extractEmail(request, "request")).toMatchObject({
    order_number: "4500010999",
    amount: 80,
    ticket_numbers: "23628-1",
    send_deadline: "2026-10-09",
  });
  expect(
    extractEmail(
      "Pedido: 4500010999\n23628-1\nCNPJ: 05.510.654/0004-21\nCEP 70070-120",
      "request",
    ).ticket_numbers,
  ).toBe("23628-1");
});
it("preserva o chamado completo e mantém o status recebido como sugestão", () => {
  expect(extractEmail(transfer, "service")).toMatchObject({
    ticket_number: "24543-1",
    reference: "SUP-2056668",
    description: "Configuração BIOS legacy para UEFI pc iniciou.",
    received_status: "concluído",
  });
  expect(
    extractEmail(request.replace("09/10/2026", "31/02/2026"), "request")
      .send_deadline,
  ).toBeNull();
});
it("prepara vínculo exato de serviços sem gravar nem repetir requisição", () => {
  const ctx = context();
  const snapshot = JSON.stringify(ctx);
  expect(assessEmailAutomation(request, ctx)).toMatchObject({
    action: "create",
    serviceIds: ["service-1"],
  });
  expect(JSON.stringify(ctx)).toBe(snapshot);
  expect(
    assessEmailAutomation(request.replace("4500010999", "4500010497"), ctx),
  ).toMatchObject({ action: "existing", existingId: "request-1" });
  expect(
    assessEmailAutomation(
      request.replace("4500010999", "4500010497").replace("80,00", "90,00"),
      ctx,
    ).action,
  ).toBe("review");
});
it("remete chamados ausentes, ambíguos ou de outra empresa para revisão", () => {
  const ctx = context();
  ctx.services = ctx.services.map((service) => ({
    ...service,
    panel_id: "outro-painel",
  }));
  expect(assessEmailAutomation(request, ctx).action).toBe("review");
  const duplicate = context();
  duplicate.services.push({ ...duplicate.services[0], id: "duplicado" });
  expect(assessEmailAutomation(request, duplicate).action).toBe("review");
  expect(
    assessEmailAutomation(request.replace("23628-1", "23628"), context())
      .action,
  ).toBe("review");
});
it("identifica transferência repetida e não inventa sufixo do chamado", () => {
  expect(assessEmailAutomation(transfer, context("service"))).toMatchObject({
    action: "existing",
    existingId: "service-2",
  });
  expect(
    assessEmailAutomation(
      transfer.replace("**24543-1**", "**24543**"),
      context("service"),
    ).action,
  ).toBe("review");
});
