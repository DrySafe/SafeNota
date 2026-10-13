import { expect, it } from "vitest";
import { demoData } from "../src/lib/demo";
import { documentAttachments } from "../src/lib/documents";
import type { Row } from "../src/types";
function fixture() {
  const data = demoData();
  data.attachments = [
    {
      id: "request-pdf",
      panel_id: "demo-positivo",
      created_at: "",
      entity: "billing_requests",
      entity_id: "request-1",
      name: "nota-enviada.pdf",
    },
    {
      id: "invoice-xml",
      panel_id: "demo-positivo",
      created_at: "",
      entity: "invoices",
      entity_id: "invoice-1",
      name: "nota.xml",
    },
    {
      id: "other-panel",
      panel_id: "demo-safe",
      created_at: "",
      entity: "billing_requests",
      entity_id: "request-1",
      name: "private.pdf",
    },
    {
      id: "payment-file",
      panel_id: "demo-positivo",
      created_at: "",
      entity: "payments",
      entity_id: "request-1",
      name: "comprovante.pdf",
    },
    {
      id: "archived",
      panel_id: "demo-positivo",
      created_at: "",
      entity: "invoices",
      entity_id: "invoice-1",
      deleted_at: "2026-10-13",
      name: "arquivado.pdf",
    },
  ] as Row[];
  return data;
}
it("mostra o PDF da requisição e o XML da nota em ambas as visualizações, preservando os vínculos", () => {
  const data = fixture();
  const before = JSON.stringify(data.attachments);
  for (const [entity, id] of [
    ["billing_requests", "request-1"],
    ["invoices", "invoice-1"],
  ]) {
    expect(
      documentAttachments(entity, id, "demo-positivo", data).map(
        (row) => row.id,
      ),
    ).toEqual(["request-pdf", "invoice-xml"]);
  }
  expect(JSON.stringify(data.attachments)).toBe(before);
});
it("não agrega arquivos de notas de outro cliente/painel ou registros arquivados", () => {
  const data = fixture();
  data.invoices[0].client_id = "another-client";
  expect(
    documentAttachments(
      "billing_requests",
      "request-1",
      "demo-positivo",
      data,
    ).map((row) => row.id),
  ).toEqual(["request-pdf"]);
  data.invoices[0].client_id = "client-1";
  data.invoices[0].deleted_at = "2026-10-13";
  expect(
    documentAttachments(
      "billing_requests",
      "request-1",
      "demo-positivo",
      data,
    ).map((row) => row.id),
  ).toEqual(["request-pdf"]);
});
