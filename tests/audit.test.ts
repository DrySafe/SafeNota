import { expect, it } from "vitest";
import { auditPresentation } from "../src/modules/audit/presentation";
import { emptyData } from "../src/lib/demo";
import type { Row } from "../src/types";
const event: Row = {
  id: "event-id",
  panel_id: "panel",
  created_at: "",
  action: "insert",
  entity: "captured_messages",
  entity_id: "database-id",
  actor_id: null,
};
it("apresenta captura Gmail pelo pedido e origem automática", () => {
  const data = emptyData();
  data.captured_messages.push({
    id: "database-id",
    panel_id: "panel",
    created_at: "",
    kind: "request",
    extracted: { order_number: "4500010008" },
  });
  expect(
    auditPresentation(
      { ...event, changes: { after: { status: "ignored" } } },
      data,
    ),
  ).toEqual({
    title: "Cadastro · E-mail recebido",
    label: "Pedido 4500010008",
    actor: "Automação do Gmail",
    detail: "Captura ignorada",
  });
});
it("preserva nome e autor gravados mesmo após remoção do registro", () => {
  expect(
    auditPresentation(
      {
        ...event,
        entity_label: "Chamado 12345-1",
        actor_label: "usuario@example.test",
        actor_id: "uuid",
      },
      emptyData(),
    ),
  ).toMatchObject({ label: "Chamado 12345-1", actor: "usuario@example.test" });
});
it("não apresenta UUID, null nem nome de registro de outro painel como descrição", () => {
  const data = emptyData();
  data.captured_messages.push({
    id: "database-id",
    panel_id: "other",
    created_at: "",
    subject: "Não expor",
  });
  const entry = auditPresentation({ ...event, actor_id: "missing-user" }, data);
  expect(entry.label).toBe("Registro sem descrição disponível");
  expect(entry.actor).toBe("Usuário não disponível");
  expect(JSON.stringify(entry)).not.toMatch(
    /database-id|missing-user|Não expor|null/,
  );
});
it("traduz arquivamento e identifica autor atual nos eventos antigos", () => {
  expect(
    auditPresentation(
      {
        ...event,
        action: "update",
        entity: "services",
        actor_id: "me",
        changes: { before: {}, after: { deleted_at: "2026-01-01" } },
      },
      emptyData(),
      { id: "me", email: "me@example.test" },
    ),
  ).toMatchObject({
    title: "Arquivamento · Serviço",
    actor: "me@example.test",
  });
});
