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

it("transferência não confunde telefone com chamado e aceita descrição ausente", () => {
  const message = `Sr(a)., TÉCNICO EXEMPLO
O chamado de número 25307-1 acaba de ser transferido para sua chave.
Chamado: 25307
Chamado cliente: INC0679619
Cliente: BCSF
Endereço: Av. Exemplo, nº 2.445 (BR-235) - Aracaju/SE - CEP: 49.082-110
Agendado para: 14/10/2026 - 18:00
Técnico: TÉCNICO EXEMPLO
Telefone: 11 9888-0000
RG: 111.222.333-44
CPF: 111.222.333-44
E-mail: tecnico@example.test`;
  expect(extractEmail(message, "service")).toMatchObject({
    title: "Chamado 25307-1",
    ticket_number: "25307-1",
    ticket_numbers: "25307-1",
    reference: "INC0679619",
    description: "",
    received_status: "",
    amount: 0,
  });
  expect(assessEmailAutomation(message, context("service")).action).toBe(
    "create",
  );
});
it("requisição conserva vários chamados sem incluir telefones da assinatura", () => {
  const message =
    "Número do Pedido: 4500010999\nValor total: R$ 80,00\n23628-1 INC0654023\n24543-1 SUP-2056668\nTelefone: 11 9888-0000\nCelular: (11) 99999-0000\nCEP: 70070-120";
  expect(extractEmail(message, "request").ticket_numbers).toBe(
    "23628-1, 24543-1",
  );
});

it("prioriza chamado completo e usa referência como alternativa", () => {
  const ctx = context("service");
  ctx.services = [
    {
      id: "a",
      panel_id: ctx.panelId,
      client_id: ctx.clientId,
      created_at: "",
      ticket_number: "25307-1",
      reference: "INC0679619",
    },
  ];
  expect(
    assessEmailAutomation("Chamado: 99999-1\nINC0679619", ctx),
  ).toMatchObject({ action: "existing", existingId: "a" });
  ctx.services.push({
    id: "b",
    panel_id: ctx.panelId,
    client_id: ctx.clientId,
    created_at: "",
    ticket_number: "99999-1",
    reference: "INC0000001",
  });
  expect(
    assessEmailAutomation("Chamado: 99999-1\nINC0679619", ctx),
  ).toMatchObject({ action: "existing", existingId: "b" });
  ctx.services[1].reference = "INC0679619";
  expect(
    assessEmailAutomation("Chamado: 25307-1\nINC0679619", ctx),
  ).toMatchObject({ action: "existing", existingId: "a" });
  expect(
    assessEmailAutomation("Chamado: 12345-1\nINC0679619", ctx).action,
  ).toBe("review");
});
