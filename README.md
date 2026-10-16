# SafeNota

Webapp responsivo para organizar serviços, pedidos de emissão, NFS-e e recebimentos. Vite + React + TypeScript, HTML e CSS próprio. Supabase fornece autenticação, PostgreSQL, RLS, Storage privado e Edge Functions.

## Executar

Requer Node.js 22 ou superior. Esta implementação foi testada com Node 24.

```sh
npm ci
npm run dev
```

Sem variáveis Supabase, a tela inicial oferece **Explorar demonstração**. Os registros são fictícios e ficam em memória; atualizar a página ou sair reinicia a demonstração. Não há login falso, upload remoto ou conexão Gmail neste modo. A navegação interna preserva os registros da sessão.

Para usar dados reais, copie `.env.example` para `.env.local` e informe a URL do seu projeto e sua chave pública anon/publishable. Reinicie Vite após mudar variáveis. Nunca use service_role ou segredos Google em variáveis `VITE_*`: elas são públicas no bundle.

## Árvore

```text
src/
  app/                 # Rotas, layout, sessão de dados e operações
  components/          # Modal acessível, formulários, listas e anexos
  lib/                 # Supabase, cálculos financeiros, CSV e dados fictícios
  types/               # Contratos TypeScript compartilhados
  styles/              # CSS responsivo
  modules/
    auth/              # Login, cadastro e sessão Supabase
    dashboard/         # Resumo financeiro e pendências
    clients/           # Clientes contratantes
    services/          # Serviços, chamados e referências
    requests/          # Requisições de nota e serviços selecionados
    contracts/         # Contratos e competências mensais
    projects/          # Projetos e conclusão de etapas
    invoices/          # Notas, parser XML, lote/ZIP e cancelamento registrado
    payments/          # Cobranças, distribuição de depósito, anexos e reversão
    integrations/      # Gmail, regras, extração e revisão
    members/           # Convites e papéis por painel
    audit/             # Logs e restauração de arquivados
supabase/
  migrations/          # Schema, RLS, RPCs, regras financeiras e Storage
  functions/
    _shared/           # Autenticação backend, Google e criptografia de tokens
    gmail/             # OAuth inicial, captura, sincronização e desconexão
    gmail-callback/    # Retorno Google com state de uso único
  config.toml          # Configuração de Edge Functions
 tests/                # Domínio, XML, extração e banco PostgreSQL em PGlite
 e2e/                  # Fluxos de navegador em desktop e celular
 docs/                 # Escopo, modelo, UX e implantação
```

## Funcionalidades desta implementação

- Usuário em vários painéis; papéis admin, operator e viewer por painel. Vários administradores, proteção do último administrador e convites por código com e-mail confirmado.
- Cadastros de clientes, serviços, requisições de nota, contratos e projetos. Etapas de projeto podem ser marcadas como concluídas.
- XML nacional v1.01, múltiplos arquivos e ZIP com limites. Extração de pedido/chamados na descrição, detecção de duplicatas e confirmação do cliente.
- Em Requisições de nota, selecionar “Gerada” solicita o número da nota emitida, emissão e vencimento e cria nota/cobrança atomicamente. Edições posteriores reutilizam a nota existente. O menu Notas fiscais foi removido; documentos e importação XML continuam acessíveis pelas requisições e pelos links de nota.
- Recebimentos mostram requisição, nota e chamados nas pendências, seleção de pagamento e histórico. As referências abrem detalhes em popup sem sair da página ou trocar a aba. Documentos enviados à requisição também aparecem na nota vinculada e vice-versa, mantendo o vínculo original de cada upload. Confirmar um pagamento exige distribuição para ao menos uma cobrança; o dashboard mostra o saldo pendente, o total recebido e o valor recebido no mês.
- Cadastro de nota gera cobrança; importação pode vincular competência existente sem duplicar o valor a receber. Valor fiscal e valor esperado são separados.
- Depósito distribuído entre várias cobranças do mesmo cliente; pagamentos parciais, saldo não distribuído, idempotência e reversão restrita a administradores.
- Vencimento padrão de nota em 20 dias corridos; contratos com competência única e dia de vencimento ajustado ao último dia do mês.
- PDF, XML e comprovantes opcionais no Storage privado, com links assinados de 60 segundos.
- Registro de cancelamento fiscal após a operação no emissor; bloqueio de cancelamento com recebimento ativo. Não cancela notas no portal oficial.
- RLS e vínculos por painel, auditoria no servidor e arquivamento/restauração restritos a administradores.
- Regras Gmail por remetente, palavras-chave e padrões simples. Revisão com edição de campos antes de confirmar cadastro. A estrutura para automatizar os dois modelos Positivo está em [docs/automacao-gmail.md](docs/automacao-gmail.md); o cadastro automático ainda não está ativado.
- Exportação CSV de cadastros, com neutralização de fórmulas de planilha.

Requisições selecionam os serviços em `request_services`. Cada nota aponta para uma requisição e conserva sua própria seleção em `invoice_services`: ao criar/importar a nota, os serviços da requisição são copiados. Alterações posteriores da requisição não mudam os serviços de notas já geradas. A tela de serviços mostra notas vinculadas com links diretos e identifica atendimentos sem nota ativa. Notas canceladas permanecem visíveis com indicação de cancelamento; notas arquivadas deixam de contar como geradas. O campo de chamados continua disponível para compatibilidade com e-mail/XML. Não há ainda interface para ratear uma nota entre múltiplos pedidos. Projetos usam etapas textuais com estado de conclusão, sem datas individuais. O modelo completo em `docs/modelo-de-dados.md` descreve extensões futuras, não uma declaração de tabelas já implantadas.

## Supabase e Google

Siga [docs/implantacao.md](docs/implantacao.md). As três migrações e as duas Edge Functions foram implantadas no projeto `fqqnzmhvlvwxlcfwseof` em 13/10/2026. O banco, o Storage privado e a rotina de contratos foram validados. Veja [docs/ambiente-supabase.md](docs/ambiente-supabase.md) para a evidência e os requisitos restantes. Gmail real depende de projeto Google, consentimento OAuth e segredos no backend. Rotinas automáticas dependem do agendamento descrito na documentação.

## Verificar

```sh
npm test
npm run build
npm run test:edge
npm run test:e2e
```

`npm test` usa PostgreSQL em WASM/PGlite para aplicar as migrações e exercitar permissões e transações. Ele não substitui testes de integração com Supabase Auth, Storage e Google reais. `test:edge` verifica TypeScript das funções Deno.

Para E2E, instale Chromium pelo Playwright (`npx playwright install chromium`) ou defina `CHROMIUM_PATH` para um navegador existente. Na máquina desta tarefa, os testes foram executados com `/usr/bin/chromium`. Os testes não enviam e-mails e usam apenas dados fictícios.

## Fora desta versão

Consulta/emissão via API do Emissor Nacional, Open Finance, cobrança de assinatura, envio automático de e-mails, validação criptográfica da assinatura XML, recuperação de senha na interface e operação offline. Integrações externas não são simuladas como conexões bem-sucedidas. Antes de produção, validar o projeto remoto, configurar entrega de e-mails Auth e concluir as políticas de retenção, backups e privacidade.

Serviços podem ser filtrados por nota gerada e mês da data do serviço, com agrupamento mensal e uma seção para serviços sem data. Notas canceladas ou arquivadas não contam como geradas. No Resumo, o filtro mensal se aplica aos recebimentos (data do pagamento) e ao total de vendas (soma das cobranças ativas, pela emissão da nota, competência do contrato ou cadastro da cobrança avulsa). A receber e Vencido continuam abrangendo todos os meses.

Em Recebimentos → Pagamentos, administradores e operadores podem usar “Editar data” para corrigir a data de um pagamento confirmado. O mesmo pagamento conserva valor, distribuição e documentos; a auditoria registra a data anterior e a nova, e os filtros mensais usam a data corrigida. Pagamentos revertidos não podem ser editados.

Requisições de nota usam fundo verde pastel quando todas as cobranças vinculadas estão pagas, branco quando pendentes e vermelho pastel quando existe saldo vencido, inclusive em pagamentos parciais. Cada aba de Recebimentos possui seu relatório PDF separado, com totais, clientes, requisições/notas, chamados, datas e paginação. Os relatórios respeitam os filtros visíveis; pagamentos revertidos não entram como pagos e depósitos distribuídos entre várias notas somam uma única vez.

Na captura de transferências Gmail, um chamado completo ou referência já existente no mesmo cliente e painel faz a mensagem ser marcada como duplicada ignorada, inclusive quando o serviço foi arquivado. O serviço original permanece intacto. O número completo do chamado tem prioridade, pois a referência pode ser compartilhada por atendimentos diferentes. Sem correspondência pelo chamado, a referência é usada; múltiplos resultados ficam para revisão; a confirmação repete a verificação no banco para proteger mensagens repetidas em filas diferentes.

Requisições capturadas pelo Gmail também são deduplicadas pelo número completo do pedido no mesmo cliente/painel, inclusive arquivadas. A captura e a confirmação preservam a requisição original e mantêm histórico de ignorados; números ambíguos exigem revisão.

Na tela E-mails, o campo “Buscar nos últimos (dias)” permite escolher de 1 a 365 dias para cada busca manual (padrão: 30). O período se aplica aos remetentes/regras ativos do painel; reduzir a janela diminui o volume consultado. O limite de 250 mensagens por regra continua sinalizado quando há mais resultados.

O histórico traduz ações e entidades, mostra chamado/pedido/nome do registro e identifica o autor pelo e-mail; capturas sem usuário autenticado aparecem como “Automação do Gmail”. Novos eventos guardam a descrição no momento da ação, inclusive em exclusões. Eventos antigos são preenchidos pelos dados ainda disponíveis, sem expor IDs internos como descrição.

Requisições destacam o número do pedido como título e a descrição como texto secundário. A extração Gmail conserva todas as referências na ordem dos chamados, inclusive referências repetidas; linhas sem referência mantêm um marcador para não deslocar os pares. A confirmação e a edição preservam a lista na requisição.

Ao confirmar uma requisição do Gmail, o sistema vincula serviços ativos pelo número completo do chamado no mesmo cliente/painel. Chamados ausentes ou ambíguos são informados para revisão, sem associação por referência compartilhada. Importações antigas sem seleção são reparadas; seleções manuais existentes são preservadas.

A captura Gmail automática roda diariamente às 06:00 de Brasília no Supabase, com o app fechado, limitada às últimas 24 horas e às regras ativas. Alimenta a revisão e respeita o bloqueio de duplicados. A busca manual conserva seu seletor de dias. Configuração e monitoramento em docs/implantacao.md.
