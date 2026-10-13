# Estado do Supabase SafeNota

Verificação em 13/10/2026. Único projeto autorizado: `fqqnzmhvlvwxlcfwseof`, nome Safenota, URL `https://fqqnzmhvlvwxlcfwseof.supabase.co`. O acesso administrativo confirmou ACTIVE_HEALTHY antes da implantação.

## Implantado e verificado

- Três migrações aplicadas em uma transação, com histórico Supabase e checksums privados para repetição segura.
- 17 tabelas públicas com RLS habilitado; 36 políticas nos schemas público e Storage.
- Bucket `documents` privado, limite de 10 MB por arquivo e tipos permitidos PDF, XML, PNG e JPEG.
- Funções financeiras e de autorização: painéis, convites, papéis, importação de notas, mensalidades, pagamentos, distribuição, reversão, cancelamento e auditoria.
- Job `safenota-monthly-billing`, diário às 08:00 UTC / 05:00 de São Paulo, gerando competências sem duplicação.
- Edge Functions `gmail` e `gmail-callback` ativas, versão 1. O gateway aceita o callback Google; a função Gmail verifica autenticação ou segredo do agendador antes de ações privilegiadas.
- Segredos internos `TOKEN_ENCRYPTION_KEY` e `SYNC_CRON_SECRET` gerados criptograficamente e guardados somente no Supabase. Nenhum valor foi escrito no Git ou nos logs.
- `APP_ORIGIN` configurado provisoriamente para desenvolvimento. Redirecionamentos localhost:5173 e 127.0.0.1:5173 adicionados ao Auth. Site URL existente e confirmação de e-mail preservados.

## Evidência

O arquivo `supabase/ops/validate-rls.sql` executou 21 verificações no PostgreSQL real: isolamento, vínculos entre painéis, proibição de escrita por consulta, restrições de operador, idempotência de pagamento, limite de saldo, reversão administrativa, último administrador, unicidade de competências, vínculo de nota a cobrança existente, proteção de tokens e revogação de acesso. Dados Auth e de negócio eram fictícios e foram desfeitos; contagens de usuários, painéis e eventos foram comparadas antes/depois e ficaram iguais.

Pela API HTTP, leitura anônima sem registros e rejeição do RPC de criação sem login foram confirmadas. Nas Edge Functions, preflight CORS respondeu 200; ações sem autorização e callback incompleto foram recusados. Esses testes não representam um consentimento Google concluído nem upload/download real de documentos.

O frontend foi compilado com as variáveis do projeto autorizado. Os módulos são carregados sob demanda, com o SDK Supabase em chunk próprio para cache. Os testes de navegador usam dados fictícios da demonstração; testes de cadastro por e-mail e entrega de confirmações reais não foram feitos para evitar enviar mensagens sem destinatário autorizado.

## Necessário para publicação completa

1. Definir hospedagem e endereço público do webapp. Atualizar Site URL, redirecionamentos Auth e `APP_ORIGIN` para esse endereço.
2. Configurar e verificar SMTP para confirmações de conta em produção. O projeto está com o serviço padrão de e-mail, sem SMTP personalizado.
3. Configurar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nos segredos das Edge Functions, habilitar Gmail API e registrar o callback `https://fqqnzmhvlvwxlcfwseof.supabase.co/functions/v1/gmail-callback` no cliente OAuth Google.
4. Completar consentimento/verificação Google conforme o público e o escopo. Validar captura dos modelos reais antes de ativar a rotina automática de Gmail.
5. Definir retenção de documentos e logs, backups e recuperação de conta antes de disponibilizar a clientes.

Nenhum domínio público foi inventado e nenhum frontend foi publicado em hospedagem externa nesta configuração. Gmail ainda não captura e-mails reais; sua infraestrutura está implantada, mas faltam as credenciais Google.
