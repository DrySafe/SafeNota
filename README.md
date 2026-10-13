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
    requests/          # Pedidos de emissão e orientações fiscais
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
- Cadastros de clientes, serviços, pedidos, contratos e projetos. Etapas de projeto podem ser marcadas como concluídas.
- XML nacional v1.01, múltiplos arquivos e ZIP com limites. Extração de pedido/chamados na descrição, detecção de duplicatas e confirmação do cliente.
- Cadastro de nota gera cobrança; importação pode vincular competência existente sem duplicar o valor a receber. Valor fiscal e valor esperado são separados.
- Depósito distribuído entre várias cobranças do mesmo cliente; pagamentos parciais, saldo não distribuído, idempotência e reversão restrita a administradores.
- Vencimento padrão de nota em 20 dias corridos; contratos com competência única e dia de vencimento ajustado ao último dia do mês.
- PDF, XML e comprovantes opcionais no Storage privado, com links assinados de 60 segundos.
- Registro de cancelamento fiscal após a operação no emissor; bloqueio de cancelamento com recebimento ativo. Não cancela notas no portal oficial.
- RLS e vínculos por painel, auditoria no servidor e arquivamento/restauração restritos a administradores.
- Regras Gmail por remetente, palavras-chave e padrões simples. Revisão com edição de campos antes de confirmar cadastro.
- Exportação CSV de cadastros, com neutralização de fórmulas de planilha.

Nesta primeira implementação, chamados de um pedido são conservados em um campo de referências; cada nota aponta para um pedido. Não há ainda interface para ratear uma nota entre múltiplos pedidos. Projetos usam etapas textuais com estado de conclusão, sem datas individuais. O modelo completo em `docs/modelo-de-dados.md` descreve extensões futuras, não uma declaração de tabelas já implantadas.

## Supabase e Google

Siga [docs/implantacao.md](docs/implantacao.md). As migrações e funções estão prontas para implantação, mas não foram aplicadas a um projeto remoto nesta tarefa: não foram fornecidas credenciais do projeto. Gmail real depende de projeto Google, consentimento OAuth e segredos no backend. Rotinas automáticas dependem do agendamento descrito na documentação.

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
