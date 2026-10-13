import { expect, test, type Page } from "@playwright/test";
async function navigate(page: Page, path: string) {
  if ((page.viewportSize()?.width || 1000) < 760)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.locator(`.sidebar a[href="${path}"]`).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu trabalho, em dia." }),
  ).toBeVisible();
});
test("depósito parcial deixa saldo e pagamento reversível", async ({
  page,
}) => {
  await navigate(page, "/receber");
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByLabel("Valor recebido").fill("50");
  await dialog.getByLabel("Valor para NF 12").fill("50");
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(
    page.getByRole("heading", { name: "Pagamento e comprovantes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Pendentes", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText("30,00");
  page.on("dialog", (d) => d.accept("Correção de teste"));
  await page.getByRole("button", { name: "Pagamentos", exact: true }).click();
  await page.getByRole("button", { name: "Reverter", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText("Revertido");
  await page.getByRole("button", { name: "Pendentes", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText("80,00");
});
test("painéis isolados e competência sem duplicação", async ({ page }) => {
  await page.getByLabel("Selecionar painel").selectOption("demo-safe");
  await navigate(page, "/contratos");
  await expect(
    page.getByRole("heading", { name: "Licença mensal de software" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Gerar competências deste mês" })
    .click();
  await expect(page.getByRole("status")).toContainText("sem duplicatas");
  await page
    .getByRole("button", { name: "Gerar competências deste mês" })
    .click();
  await navigate(page, "/receber");
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText("250,00");
  await expect(page.locator(".entity-card")).not.toContainText("4500010497");
});
test("cadastro de serviço conserva chamado e edição", async ({ page }) => {
  await navigate(page, "/servicos");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .fill("Teste de manutenção");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog.getByLabel("Número completo do chamado").fill("00123-1");
  await dialog.getByLabel("Valor previsto").fill("125.50");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator(".entity-card").filter({ hasText: "Teste de manutenção" }),
  ).toContainText("00123-1");
  await page
    .getByPlaceholder("Buscar nome, número ou referência…")
    .fill("00123-1");
  await expect(page.locator(".entity-card")).toHaveCount(1);
});
test("layout não ultrapassa largura e módulos abrem", async ({ page }) => {
  for (const route of [
    "/",
    "/clientes",
    "/servicos",
    "/pedidos",
    "/notas",
    "/receber",
    "/contratos",
    "/projetos",
    "/integracoes",
    "/equipe",
    "/historico",
  ]) {
    await navigate(page, route);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Explorar demonstração" }),
    ).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    expect(overflow, route).toBe(false);
  }
  await navigate(page, "/");
  await page.screenshot({
    path: `/tmp/safenota-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("importação XML gera uma única cobrança", async ({ page }) => {
  await navigate(page, "/notas");
  await page.getByRole("button", { name: "Importar XML em lote" }).click();
  const xml =
    '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFSdemo-import"><nNFSe>88</nNFSe><emit><CNPJ>00000000000001</CNPJ></emit><valores><vLiq>90.00</vLiq></valores><DPS><infDPS><dhEmi>2026-10-12T12:00:00-03:00</dhEmi><toma><CNPJ>00000000000002</CNPJ><xNome>Cliente exemplo</xNome></toma><xDescServ>Pedido: 123456</xDescServ><vServ>100.00</vServ></infDPS></DPS></infNFSe></NFSe>';
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "exemplo.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(xml),
    });
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("status")).toContainText("Importada");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await navigate(page, "/receber");
  await expect(
    page.locator(".entity-card").filter({ hasText: "NF 88" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".entity-card").filter({ hasText: "NF 88" }),
  ).toContainText("90,00");
});
