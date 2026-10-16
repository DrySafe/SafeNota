import { expect, test, type Page } from "@playwright/test";
async function navigate(page: Page, path: string) {
  if ((page.viewportSize()?.width || 1000) < 760)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .locator(`.sidebar a[href="${path === "/notas" ? "/requisicoes" : path}"]`)
    .click();
  if (path === "/notas")
    await page
      .getByRole("link", { name: "Importar XML / conferir documentos" })
      .click();
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
    "/requisicoes",
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

test("cria primeiro cliente no formulário e conserva rascunho do serviço", async ({
  page,
}) => {
  await page.getByLabel("Selecionar painel").selectOption("demo-daniel");
  await navigate(page, "/servicos");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .fill("Atendimento com cliente novo");
  await dialog.getByLabel("Número completo do chamado").fill("18285-1");
  await dialog.getByLabel("Valor previsto").fill("80");
  await expect(dialog.getByText("Nenhum cliente neste painel.")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Novo cliente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Novo cliente", exact: true }),
  ).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nome / razão social", { exact: false })
    .fill("Cliente criado no atendimento");
  await dialog
    .getByLabel("E-mail", { exact: true })
    .fill("cliente@example.test");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Adicionar registro", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Cliente", { exact: false }).locator("option:checked"),
  ).toHaveText("Cliente criado no atendimento");
  await expect(dialog.getByLabel("Descrição", { exact: false })).toHaveValue(
    "Atendimento com cliente novo",
  );
  await expect(dialog.getByLabel("Número completo do chamado")).toHaveValue(
    "18285-1",
  );
  await expect(dialog.getByLabel("Valor previsto")).toHaveValue("80");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText(
    "Cliente criado no atendimento",
  );
  await navigate(page, "/clientes");
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText(
    "Cliente criado no atendimento",
  );
});

test("cancelar novo cliente preserva serviço e seleção anterior", async ({
  page,
}) => {
  await navigate(page, "/servicos");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .fill("Rascunho preservado");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog
    .getByRole("button", { name: "Novo cliente", exact: true })
    .click();
  await dialog
    .getByLabel("Nome / razão social", { exact: false })
    .fill("Não salvar");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog.getByLabel("Descrição", { exact: false })).toHaveValue(
    "Rascunho preservado",
  );
  await expect(dialog.getByLabel("Cliente", { exact: false })).toHaveValue(
    "client-1",
  );
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await navigate(page, "/clientes");
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).not.toContainText("Não salvar");
});

test("requisição seleciona serviços e número da nota abre o documento correspondente", async ({
  page,
}) => {
  await navigate(page, "/servicos");
  const old = page.locator(".entity-card").filter({ hasText: "23628-1" });
  await expect(old).toContainText("Nota gerada");
  const pending = page.locator(".entity-card").filter({ hasText: "24543-1" });
  await expect(pending).toContainText("Sem nota gerada");
  await navigate(page, "/requisicoes");
  await expect(
    page.getByRole("heading", { name: "Requisições de nota", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .first()
    .fill("Requisição do chamado BIOS");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog.getByLabel("Número da requisição / pedido").fill("4500099999");
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  await dialog
    .getByRole("checkbox", { name: "Adicionar serviço 24543-1", exact: true })
    .check();
  await expect(dialog.getByLabel("Chamados informados")).toHaveValue("24543-1");
  await dialog.getByLabel("Valor solicitado").fill("150");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  const req = page
    .locator(".entity-card")
    .filter({ hasText: "Requisição do chamado BIOS" });
  await req.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Adicionar serviço 24543-1",
      exact: true,
    }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await navigate(page, "/notas");
  await expect(
    page.getByRole("heading", { name: "Notas fiscais", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição *", { exact: true })
    .fill("Nota BIOS gerada");
  await dialog.getByLabel("Número da nota").fill("123");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog
    .getByLabel("Requisição de nota", { exact: false })
    .selectOption({ label: "Requisição do chamado BIOS" });
  await expect(
    dialog.getByRole("checkbox", {
      name: "Adicionar serviço 24543-1",
      exact: true,
    }),
  ).toBeChecked();
  await dialog.getByLabel("Valor bruto").fill("150");
  await dialog.getByLabel("Valor líquido").fill("150");
  await dialog.getByLabel("Emissão").fill("2026-10-13");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await navigate(page, "/servicos");
  await expect(pending).toContainText("Nota gerada");
  await pending.getByRole("link", { name: "NF 123", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Nota BIOS gerada");
  await expect(page.getByRole("dialog")).toContainText("24543-1");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("requisição gerada vira pendência com chamados e pagamento atualiza dashboard", async ({
  page,
}) => {
  await expect(page.locator('.sidebar a[href="/notas"]')).toHaveCount(0);
  await navigate(page, "/requisicoes");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .first()
    .fill("Requisição para receber");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog.getByLabel("Número da requisição / pedido").fill("4500088888");
  await dialog
    .getByRole("checkbox", { name: "Adicionar serviço 24543-1", exact: true })
    .check();
  await dialog.getByLabel("Valor solicitado").fill("150");
  await dialog
    .getByLabel("Situação", { exact: false })
    .selectOption("Faturado");
  await dialog.getByLabel("Número da nota já emitida").fill("900");
  await dialog.getByLabel("Data de emissão da nota").fill("2026-10-13");
  await dialog.getByLabel("Vencimento do recebimento").fill("2026-11-02");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const req = page.locator(".entity-card").filter({ hasText: "4500088888" });
  await expect(req).toContainText("Gerada");
  await expect(req).toContainText("NF 900");
  await req.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(dialog.getByLabel("Número da nota já emitida")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await navigate(page, "/notas");
  await page.getByRole("button", { name: "Importar XML em lote" }).click();
  const xml =
    '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFSworkflow-xml"><nNFSe>900</nNFSe><emit><CNPJ>00000000000001</CNPJ></emit><valores><vLiq>150.00</vLiq></valores><DPS><infDPS><dhEmi>2026-10-13T12:00:00-03:00</dhEmi><toma><CNPJ>00000000000002</CNPJ><xNome>Cliente exemplo</xNome></toma><xDescServ>Pedido: 4500088888 Chamado: 24543-1</xDescServ><vServ>150.00</vServ></infDPS></DPS></infNFSe></NFSe>';
  await dialog.locator("input[type=file]").setInputFiles({
    name: "nota-900.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(dialog.getByRole("status")).toContainText("Importada");
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await navigate(page, "/");
  await expect(
    page
      .locator(".stat")
      .filter({ has: page.getByText("A receber", { exact: true }) }),
  ).toContainText("230,00");
  await navigate(page, "/receber");
  await expect(page.locator(".entity-card")).toHaveCount(2);
  const pending = page.locator(".entity-card").filter({ hasText: "NF 900" });
  await expect(pending).toContainText("24543-1");
  await expect(pending).toContainText("02/11/2026");
  await pending
    .getByRole("button", { name: "Requisição 4500088888", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Requisição para receber",
  );
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await navigate(page, "/receber");
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByLabel("Requisição / nota a receber").selectOption({
    label: "Requisição 4500088888 · NF 900 · Saldo R$ 150,00",
  });
  await expect(dialog.getByLabel("Valor recebido")).toHaveValue("150");
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(dialog).toContainText("Requisição 4500088888");
  await expect(dialog).toContainText("NF 900");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText(
    "Requisição 4500088888",
  );
  await navigate(page, "/");
  await expect(
    page
      .locator(".stat")
      .filter({ has: page.getByText("A receber", { exact: true }) }),
  ).toContainText("80,00");
  await expect(
    page
      .locator(".stat")
      .filter({ has: page.getByText("Recebido", { exact: true }) }),
  ).toContainText("150,00");
  await navigate(page, "/requisicoes");
  await expect(req).toContainText("Pago");
});

test("referências abrem somente popup e mantêm a aba Pagamentos ao fechar", async ({
  page,
}) => {
  await navigate(page, "/receber");
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByLabel("Valor recebido").fill("80");
  await dialog.getByLabel("Valor para NF 12").fill("80");
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  const url = page.url();
  const payment = page
    .locator(".entity-card")
    .filter({ hasText: "Confirmado" });
  for (let repeat = 0; repeat < 2; repeat++) {
    await payment
      .getByRole("button", { name: "Requisição 4500010497", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Chamados informados");
    await expect(dialog).toContainText("23628-1");
    expect(page.url()).toBe(url);
    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Pagamentos", exact: true }),
    ).toHaveClass("active");
    await payment.getByRole("button", { name: "NF 12", exact: true }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Número da nota");
    await expect(dialog).toContainText("23628-1");
    await expect(
      dialog.getByText("Documentos e comprovantes", { exact: true }),
    ).toBeVisible();
    expect(page.url()).toBe(url);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(payment).toBeVisible();
  }
  await payment.locator(".entity-main").click();
  await expect(
    page.getByRole("heading", {
      name: "Pagamento e comprovantes",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "NF 12", exact: true })
    .click();
  await expect(page.locator("dialog[open]")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      name: "Pagamento e comprovantes",
      exact: true,
    }),
  ).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pagamentos", exact: true }),
  ).toHaveClass("active");
});

test("resumo inclui recebimento de mês anterior e exclui reversões", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await navigate(page, "/receber");
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByLabel("Valor recebido").fill("80");
  await dialog.getByLabel("Data", { exact: true }).fill("2026-07-28");
  await dialog.getByLabel("Valor para NF 12").fill("80");
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await navigate(page, "/");
  const received = page
    .locator(".stat")
    .filter({ has: page.getByText("Recebido", { exact: true }) });
  await expect(received.locator("strong")).toContainText("80,00");
  await expect(received.locator("small")).toContainText("0,00 neste mês");
  await received.click();
  await expect(
    page.getByRole("button", { name: "Pagamentos", exact: true }),
  ).toHaveClass("active");
  page.on("dialog", (dialog) => dialog.accept("Correção de teste"));
  await page.getByRole("button", { name: "Reverter", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText("Revertido");
  await navigate(page, "/");
  await expect(received.locator("strong")).toContainText("0,00");
});

test("menu pequeno fecha ao tocar fora, pressionar Escape ou escolher uma página", async ({
  page,
}) => {
  const width = test.info().project.name === "desktop" ? 560 : 393;
  await page.setViewportSize({ width, height: 900 });
  const open = page.getByRole("button", { name: "Abrir menu", exact: true });
  await open.click();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: "Fechar menu ao tocar fora", exact: true })
    .click({ position: { x: width - 15, y: 200 } });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await open.click();
  await page.locator('.sidebar a[href="/servicos"]').click();
  await expect(
    page.getByRole("heading", { name: "Serviços e chamados", exact: true }),
  ).toBeVisible();
  await expect(open).toHaveAttribute("aria-expanded", "false");
});

test("serviços separam notas geradas e agrupam atendimentos por mês", async ({
  page,
}) => {
  await navigate(page, "/servicos");
  for (const [ticket, date] of [
    ["23628-1", "2026-07-28"],
    ["24543-1", "2026-09-05"],
  ]) {
    await page
      .locator(".entity-card")
      .filter({ hasText: ticket })
      .getByRole("button", { name: "Editar", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Data do serviço").fill(date);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(page.locator(".month-heading")).toHaveText([
    "setembro de 2026",
    "julho de 2026",
  ]);
  await page.getByLabel("Mês dos serviços").selectOption("2026-07");
  await page.getByRole("button", { name: /^Com nota gerada/ }).click();
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText("23628-1");
  await page.getByRole("button", { name: /^Sem nota gerada/ }).click();
  await expect(page.locator(".entity-card")).toHaveCount(0);
  await page.getByLabel("Mês dos serviços").selectOption("2026-09");
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText("24543-1");
  await navigate(page, "/notas");
  page.on("dialog", (dialog) => dialog.accept("Cancelada no emissor"));
  await page
    .getByRole("button", { name: "Registrar cancelamento", exact: true })
    .click();
  await navigate(page, "/servicos");
  await page.getByRole("button", { name: /^Com nota gerada/ }).click();
  await expect(page.locator(".entity-card")).toHaveCount(0);
  await page.getByRole("button", { name: /^Sem nota gerada/ }).click();
  await expect(page.locator(".entity-card")).toHaveCount(2);
});

test("filtro mensal do resumo altera recebido/vendas e mantém todas as pendências", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await navigate(page, "/receber");
  for (const [amount, date] of [
    ["20", "2026-07-28"],
    ["30", "2026-10-14"],
  ]) {
    await page
      .getByRole("button", { name: "Registrar pagamento", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Cliente", exact: true })
      .selectOption("client-1");
    await dialog.getByLabel("Valor recebido").fill(amount);
    await dialog.getByLabel("Data", { exact: true }).fill(date);
    await dialog.getByLabel("Valor para NF 12").fill(amount);
    await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
  }
  await navigate(page, "/");
  const card = (label: string) =>
    page
      .locator(".stat")
      .filter({ has: page.getByText(label, { exact: true }) });
  for (const [month, received, sales] of [
    ["all", "50,00", "80,00"],
    ["2026-07", "20,00", "0,00"],
    ["2026-10", "30,00", "0,00"],
    ["2026-09", "0,00", "80,00"],
  ]) {
    await page.getByLabel("Mês do resumo").selectOption(month);
    await expect(card("Recebido").locator("strong")).toContainText(received);
    await expect(card("Total de vendas").locator("strong")).toContainText(
      sales,
    );
    await expect(card("A receber").locator("strong")).toContainText("30,00");
    await expect(card("Vencido").locator("strong")).toContainText("30,00");
  }
  await page.getByLabel("Mês do resumo").selectOption("2026-07");
  await card("Recebido").click();
  await expect(
    page.getByRole("button", { name: "Pagamentos", exact: true }),
  ).toHaveClass("active");
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText("28/07/2026");
  await expect(page.locator(".entity-card")).toContainText("20,00");
});

test("card de serviços sem nota conta atendimentos e abre a lista correspondente", async ({
  page,
}) => {
  const card = page
    .locator(".stat")
    .filter({ has: page.getByText("Serviços sem nota", { exact: true }) });
  await expect(card.locator("strong")).toHaveText("1");
  await card.click();
  await expect(
    page.getByRole("button", { name: /^Sem nota gerada/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText("24543-1");
  await navigate(page, "/notas");
  page.on("dialog", (dialog) => dialog.accept("Cancelamento de teste"));
  await page
    .getByRole("button", { name: "Registrar cancelamento", exact: true })
    .click();
  await navigate(page, "/");
  await expect(card.locator("strong")).toHaveText("2");
  await card.click();
  await expect(page.locator(".entity-card")).toHaveCount(2);
  await navigate(page, "/");
  await page.getByLabel("Selecionar painel").selectOption("demo-safe");
  await expect(card.locator("strong")).toHaveText("0");
});

test("editar data de pagamento move o recebimento de mês e preserva o saldo", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await navigate(page, "/receber");
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByLabel("Valor recebido").fill("50");
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-14");
  await dialog.getByLabel("Valor para NF 12").fill("50");
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Editar data", exact: true }).click();
  await dialog.getByLabel("Data de recebimento").fill("2026-07-28");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".entity-card")).toContainText("14/10/2026");
  await page.getByRole("button", { name: "Editar data", exact: true }).click();
  await dialog.getByLabel("Data de recebimento").fill("2026-07-28");
  await dialog
    .getByRole("button", { name: "Salvar data", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".entity-card")).toHaveCount(1);
  await expect(page.locator(".entity-card")).toContainText("28/07/2026");
  await expect(page.locator(".entity-card")).toContainText("NF 12");
  await navigate(page, "/");
  const card = (label: string) =>
    page
      .locator(".stat")
      .filter({ has: page.getByText(label, { exact: true }) });
  for (const [month, received] of [
    ["2026-07", "50,00"],
    ["2026-10", "0,00"],
  ]) {
    await page.getByLabel("Mês do resumo").selectOption(month);
    await expect(card("Recebido").locator("strong")).toContainText(received);
    await expect(card("A receber").locator("strong")).toContainText("30,00");
  }
  await navigate(page, "/historico");
  await expect(
    page.getByText("Data do recebimento: 14/10/2026 → 28/07/2026", {
      exact: true,
    }),
  ).toBeVisible();
});

test("requisições usam cores por saldo e cada aba baixa seu relatório PDF", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await navigate(page, "/requisicoes");
  await expect(page.locator(".entity-card").first()).toHaveClass(
    /request-overdue/,
  );
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .first()
    .fill("Requisição futura");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog.getByLabel("Número da requisição / pedido").fill("4500099111");
  await dialog.getByLabel("Valor solicitado").fill("150");
  await dialog
    .getByLabel("Situação", { exact: false })
    .selectOption("Faturado");
  await dialog.getByLabel("Número da nota já emitida").fill("901");
  await dialog.getByLabel("Data de emissão da nota").fill("2026-10-14");
  await dialog.getByLabel("Vencimento do recebimento").fill("2026-11-14");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator(".entity-card").filter({ hasText: "Requisição futura" }),
  ).toHaveClass(/request-pending/);
  await navigate(page, "/receber");
  let downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Relatório de pendentes (PDF)", exact: true })
    .click();
  const pending = await downloadPromise;
  expect(pending.suggestedFilename()).toContain("SafeNota-pendentes-");
  await pending.saveAs(testInfo.outputPath("pendentes.pdf"));
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption("client-1");
  await dialog.getByLabel("Valor recebido").fill("80");
  await dialog.getByLabel("Valor para NF 12").fill("80");
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Relatório de pagos (PDF)", exact: true })
    .click();
  const paid = await downloadPromise;
  expect(paid.suggestedFilename()).toContain("SafeNota-pagos-");
  await paid.saveAs(testInfo.outputPath("pagos.pdf"));
  await navigate(page, "/requisicoes");
  await expect(
    page.locator(".entity-card").filter({ hasText: "4500010497" }),
  ).toHaveClass(/request-paid/);
});

test("modelos de remetentes Positivo são editáveis e separados por tipo", async ({
  page,
}) => {
  await navigate(page, "/integracoes");
  for (const [button, sender, kind] of [
    [
      "Nova regra de chamados",
      "donotreply@fieldsmais.smtp-cervelloesm.com.br",
      "service",
    ],
    ["Nova regra de requisições", "ajudasmais@positivosmais.com", "request"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("E-mail exato do remetente")).toHaveValue(
      sender,
    );
    await expect(dialog.getByLabel("Tipo de mensagem")).toHaveValue(kind);
    await expect(dialog.getByLabel("Situação")).toHaveValue("paused");
    await dialog
      .getByLabel("E-mail exato do remetente")
      .fill("outro-estado@example.test");
    await dialog
      .getByLabel("Cliente de destino", { exact: false })
      .selectOption("client-1");
    await expect(dialog.getByLabel("E-mail exato do remetente")).toHaveValue(
      "outro-estado@example.test",
    );
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  }
});

test("prévia de transferência mantém só o chamado e informa descrição ausente", async ({
  page,
}) => {
  await navigate(page, "/integracoes");
  await page.getByLabel("Tipo", { exact: false }).selectOption("service");
  await page
    .getByLabel("Mensagem de exemplo")
    .fill(
      "O chamado de número 25307-1 acaba de ser transferido para sua chave.\nChamado: 25307\nChamado cliente: INC0679619\nTelefone: 11 9888-0000",
    );
  await page
    .getByRole("button", { name: "Ver campos extraídos", exact: true })
    .click();
  await expect(
    page.getByText(
      "Este e-mail não informa a descrição do serviço. Você poderá completá-la na revisão do atendimento.",
      { exact: true },
    ),
  ).toBeVisible();
  const extracted = JSON.parse(await page.locator("pre").innerText());
  expect(extracted.ticket_numbers).toBe("25307-1");
  expect(extracted.reference).toBe("INC0679619");
  expect(extracted.description).toBe("");
});

test("busca Gmail permite escolher dias e bloqueia períodos inválidos", async ({
  page,
}) => {
  await navigate(page, "/integracoes");
  const days = page.getByLabel("Buscar nos últimos (dias)");
  const search = page.getByRole("button", { name: "Buscar novos e-mails" });
  await expect(days).toHaveValue("30");
  await days.fill("3");
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.getByRole("status")).toContainText(
    "Gmail real exige Supabase",
  );
  for (const value of ["", "0", "366", "1.5"]) {
    await days.fill(value);
    await expect(search).toBeDisabled();
  }
  await days.fill("365");
  await expect(search).toBeEnabled();
});

test("histórico mostra chamado e autor legíveis sem IDs do banco", async ({
  page,
}) => {
  await navigate(page, "/servicos");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .fill("Serviço para histórico");
  await dialog.getByLabel("Cliente", { exact: false }).selectOption("client-1");
  await dialog.getByLabel("Número completo do chamado").fill("99123-1");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await navigate(page, "/historico");
  const entry = page
    .locator(".summary-row")
    .filter({ hasText: "Chamado 99123-1" });
  await expect(entry).toContainText("Cadastro · Serviço");
  await expect(entry).toContainText("Autor: Usuário de demonstração");
  await expect(entry).not.toContainText("entity_id");
  await expect(entry).not.toContainText("null");
  expect(await entry.innerText()).not.toMatch(
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
  );
});

test("requisição destaca pedido e conserva pares de chamados e referências", async ({
  page,
}) => {
  await navigate(page, "/requisicoes");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descrição *", { exact: true })
    .fill("Descrição secundária do pedido");
  await dialog.getByRole("combobox").first().selectOption("client-1");
  await dialog.getByLabel("Número da requisição / pedido").fill("4500010650");
  await dialog.getByLabel("Chamados informados").fill("24493-1, 24543-1");
  await dialog
    .getByLabel("Referências (na ordem dos chamados)")
    .fill("INC-2032465, SUP-2056668");
  await dialog.getByLabel("Valor solicitado").fill("160");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  const card = page.locator(".entity-card").filter({ hasText: "4500010650" });
  await expect(
    card.getByRole("heading", { name: "4500010650", exact: true }),
  ).toBeVisible();
  await expect(card.locator(".entity-main p")).toContainText(
    "Descrição secundária do pedido",
  );
  await expect(card.locator(".request-ticket").nth(0)).toHaveText(
    "24493-1 · INC-2032465",
  );
  await expect(card.locator(".request-ticket").nth(1)).toHaveText(
    "24543-1 · SUP-2056668",
  );
  await card.locator(".entity-main").click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("INC-2032465, SUP-2056668", { exact: true }),
  ).toBeVisible();
});
