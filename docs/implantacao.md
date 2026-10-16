# Implantação e integrações

O projeto autorizado `fqqnzmhvlvwxlcfwseof` já recebeu as migrações e funções. Consulte [ambiente-supabase.md](ambiente-supabase.md) antes de repetir etapas. Os scripts em `scripts/` verificam a URL e a identidade remota antes de qualquer alteração.

## Aplicação web

1. Criar um projeto Supabase. Habilitar confirmação de e-mail no Auth; definir Site URL e URLs de redirecionamento para o domínio da aplicação. Configurar SMTP para entrega confiável de confirmações.
2. Com a CLI Supabase autenticada na sua conta, executar `supabase link --project-ref SEU_PROJECT_REF` e `supabase db push` neste checkout. Também é possível aplicar os arquivos de `supabase/migrations` em ordem pelo editor SQL em um projeto novo. Não reaplicar SQL integral sobre uma implantação existente.
3. Configurar `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave pública).
4. Executar `npm run build`. Publicar `dist/` com fallback de rotas para `index.html`. O servidor de desenvolvimento Vite não é servidor de produção.
5. Criar contas de teste e dois painéis. Confirmar acesso de admin, operador e consulta por chamadas diretas e downloads de anexos. Remover um membro e confirmar recusa de novos acessos. URLs já assinadas expiram em até 60 segundos.

Não colocar `SUPABASE_SERVICE_ROLE_KEY`, segredos OAuth ou chave de criptografia no frontend. O Supabase injeta suas próprias credenciais nas Edge Functions.

## Gmail OAuth

A configuração Google é feita pelo responsável pelo SaaS uma vez; clientes usam o botão Conectar Google.

1. No Google Cloud Console, criar projeto, habilitar Gmail API e configurar a tela de consentimento OAuth com domínio, política de privacidade e usuários de teste quando aplicável.
2. Criar cliente OAuth do tipo aplicação web. Definir como URL de retorno `https://SEU_PROJECT_REF.supabase.co/functions/v1/gmail-callback` exatamente.
3. No painel de segredos das Edge Functions Supabase, definir:
   - `GOOGLE_CLIENT_ID`: cliente OAuth.
   - `GOOGLE_CLIENT_SECRET`: segredo do cliente.
   - `APP_ORIGIN`: origem HTTPS do app, sem barra final.
   - `TOKEN_ENCRYPTION_KEY`: chave aleatória de 32 bytes em base64, usada com AES-GCM. Gerar localmente com um gerador criptográfico e guardar pelo painel seguro, nunca no Git.
   - `SYNC_CRON_SECRET`: segredo aleatório para chamadas do agendador, também guardado de forma segura.
4. Implantar: `supabase functions deploy gmail` e `supabase functions deploy gmail-callback`. A configuração desliga a verificação de JWT no gateway para suportar o callback; `gmail` verifica a sessão com `auth.getUser` em cada ação de usuário. Sincronização global verifica o segredo do agendador.
5. Abrir Integrações, conectar sua conta Google e criar regra escolhendo conta, painel, remetente e tipo. Testar extração e sincronizar. Confirmar os registros com o cliente correto.

O escopo `gmail.readonly` pode exigir verificação Google e requisitos adicionais para uso público. Em modo de teste, autorizações podem expirar e exigir reconexão. Não anunciar Gmail em produção antes de validar consentimento e exigências aplicáveis.

A busca manual permite de 1 a 365 dias (padrão de 30). A captura automática diária considera somente as últimas 24 horas, até 250 mensagens por regra e execução, e deduplica por painel, conexão e message_id. Se houver mais, ela informa limite e pede filtros mais específicos; não é importação histórica completa. Remover o proprietário da conexão do painel interrompe a captura naquele painel. Desconectar revoga a autorização Google, remove o token e pausa as regras; registros confirmados são preservados.

Padrões JSON opcionais aceitam chaves `order_number`, `ticket_number`, `reference` e `amount`, com grupo 1 de captura. Usar apenas padrões simples. Configurar palavras-chave pelo texto do remetente para distinguir solicitações de emissão de mensagens comuns. A revisão permite corrigir campos; nenhuma extração confirma pagamentos.

## Rotinas automáticas

### Mensalidades

Competência atual é gerada ao criar/editar contrato. Índice único impede duplicatas. Para gerar os próximos meses sem abrir o app, habilitar pg_cron e agendar no editor SQL:

```sql
select cron.schedule(
  'safenota-monthly-billing',
  '0 8 * * *',
  'select private.generate_all_installments()'
);
```

O horário acima é 08:00 UTC, 05:00 em São Paulo. A competência e o vencimento usam o fuso de cada painel. Na primeira versão, novos painéis usam America/Sao_Paulo. Verificar `cron.job_run_details` após uma execução. Esse job já está ativo no projeto autorizado.

### Gmail

O job `safenota-gmail-daily` está configurado no Supabase autorizado para `0 9 * * *`: todos os dias às **06:00 em America/Sao_Paulo**. Funciona com o app fechado e considera apenas as últimas **24 horas**, usando limites Unix `after`/`before` fixos por execução. A captura deixa mensagens novas na revisão; não confirma serviços, notas ou pagamentos automaticamente. Regras pausadas e conexões sem acesso de administrador/operador não são processadas.

Para reproduzir a configuração somente no projeto autorizado: `python scripts/enable_gmail_daily.py`, após implantar a função `gmail` atualizada. O script reutiliza ou cria a credencial dedicada no Supabase Vault e a registra como `GMAIL_DAILY_CRON_SECRET` da Edge Function. Ele não troca o segredo antigo `SYNC_CRON_SECRET` nem credenciais OAuth. O SQL de agendamento fica em `supabase/ops/enable-gmail-daily-job.sql`; nenhum segredo é versionado.

O job chama `private.dispatch_gmail_daily()`, que envia POST por pg_net. Consulte `cron.job`/`cron.job_run_details`, `private.gmail_sync_dispatches` e a resposta por `request_id` em `net._http_response`. Sucesso do job indica despacho; sucesso da sincronização exige HTTP 200 e `errors` vazio na resposta. Respostas pg_net têm retenção temporária. Como a janela é limitada a 24 horas, uma execução perdida exige busca manual de um período maior para recuperar mensagens antigas. A interface conserva a busca manual.

Monitorar resposta `errors`, expiração de autorização e duração das funções. O processamento atual é sequencial e apropriado para o início; volumes altos precisam de fila e cursores de sincronização. Evitar execuções globais sobrepostas. Duplicatas concorrentes são bloqueadas no banco.

## Aceitação antes de produção

- Cadastro e confirmação de conta, convites e isolamento entre painéis.
- XML real, associação ao pedido e cobrança de contrato sem duplicidade.
- Um depósito quitando várias notas, pagamento parcial, repetição do envio e reversão.
- Upload e download privados; tentativa por usuário de outro painel.
- OAuth, captura de cada modelo de e-mail, revisão e desconexão.
- Rotinas agendadas e visibilidade de erros.
- Recuperação de conta, retenção de documentos/logs, backups e resposta a solicitações de privacidade.

Esses testes externos exigem sua implantação e credenciais. Os testes locais existentes não comprovam funcionamento dos serviços remotos.

## API administrativa no ambiente Codex

O token do ambiente pode ser uma referência substituída pelo proxy em requisições HTTPS. A CLI pode rejeitar seu formato antes de enviá-lo; isso não significa que a credencial deixou de funcionar. Os scripts Python usam a API Management diretamente, preservando proxy e verificação TLS:

```sh
python scripts/supabase_setup.py          # inspecionar, sem aplicar
python scripts/supabase_setup.py --apply  # migrações pendentes, em uma transação
python scripts/deploy_functions.py       # apenas gmail e gmail-callback
```

Requerem `SUPABASE_ACCESS_TOKEN` e a URL autorizada em `VITE_SUPABASE_URL`. Não aceitam outra referência de projeto. Migrações aplicadas têm checksums registrados; alterar uma versão aplicada interrompe a execução. Não recuperar o valor real de tokens do proxy para usar na CLI.

`supabase/ops/validate-rls.sql` testa a autorização usando dados fictícios em uma transação desfeita. `enable-contract-job.sql` registra a rotina recorrente; ambos devem ser executados somente após confirmação do projeto pelo script.
