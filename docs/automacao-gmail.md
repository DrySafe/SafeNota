# Automação de chamados e requisições pelo Gmail

## Objetivo e fluxo proposto

Usar a Gmail API com OAuth para transformar mensagens dos remetentes configurados em serviços e requisições de nota. A requisição criada permanece **A gerar**. A emissão da nota, seu registro como gerada e a confirmação do pagamento continuam sob controle do usuário.

Uma integração OAuth do SafeNota atende os usuários do SaaS. Cada pessoa conecta sua própria caixa pelo botão **Conectar Google**; não precisa criar uma API Google para cada cliente. O escopo `gmail.readonly` autoriza leitura da caixa: o filtro por remetente é aplicado pelo SafeNota, não é uma restrição de permissão concedida pelo Google.

1. Administrador configura conta, painel, cliente, remetente exato e tipo de mensagem.
2. SafeNota busca as mensagens correspondentes em tarefa de servidor.
3. Normaliza o conteúdo, extrai os campos e verifica dados e duplicidades.
4. Dados completos e vínculos exatos: registra automaticamente, se a regra estiver nesse modo.
5. Campo faltante, divergência ou associação ambígua: envia à revisão, explicando o motivo.
6. Histórico permite consultar a mensagem de origem e o registro criado.

O conteúdo do e-mail é dado de entrada; instruções no texto não alteram permissões, regras nem estados financeiros.

## O que existe e o que foi preparado

| Parte                                                                    | Situação no código                                                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Conectar/desconectar Google, consentimento e refresh token criptografado | Base existente nas Edge Functions `gmail` e `gmail-callback`; operação real depende da configuração OAuth.                         |
| Filtros de remetente/palavras-chave por painel                           | Existentes em `email_rules`.                                                                                                       |
| Captura manual e endpoint `sync-all`                                     | Existentes; endpoint não comprova que haja agendamento ativo.                                                                      |
| Revisar e confirmar uma captura                                          | Interface e RPC `confirm_capture` existentes.                                                                                      |
| Extração dos modelos fornecidos                                          | Ampliada nesta etapa: prazo de envio, descrição e status recebido; evita confundir CNPJ/CEP com chamados.                          |
| Decidir criar, revisar ou reconhecer registro existente                  | Base pura em `automation.ts`, com testes. **Ainda não ligada ao processamento de produção.**                                       |
| Duplicidade de transferências                                            | Implementada na captura e confirmação: chamado completo ou referência, com isolamento por cliente/painel e histórico de ignorados. |
| Criação automática agendada e vínculo pedido/chamados                    | Próxima etapa: exige regra com cliente definido e RPC transacional específica. Não está ativada.                                   |

`assessEmailAutomation` apenas calcula uma decisão. Não acessa o Gmail nem grava dados. A captura atual mantém a fila de revisão; não foi ativado um robô em contas reais nesta etapa.

## Regras iniciais da Positivo

Remetentes confirmados como sugestões iniciais, sempre editáveis no app:

- Transferências: `donotreply@fieldsmais.smtp-cervelloesm.com.br`.
- Requisições de nota: `ajudasmais@positivosmais.com`.

Cadastrar uma regra por remetente/tipo/cliente no painel atual. Outros estados podem usar outras regras, sem alterar o código. Novas regras começam pausadas até configurar a conta, o cliente e testar o formato.

| Mensagem            | Campos                                                                                                             | Resultado esperado                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transferência       | Chamado completo `24543-1`, referência `SUP-2056668`, descrição e status informado                                 | Serviço no cliente configurado. Status recebido é sugestão: não concluir atendimento automaticamente. Valor ausente não cria obrigação financeira. |
| Solicitação de nota | Pedido `4500010497`, chamados `23628-1`, referências, valor total `80,00`, prazo `09/10/2026`, orientações fiscais | Requisição **A gerar**, prazo de envio `2026-10-09` e vínculos exatos com serviços do mesmo cliente/painel.                                        |

Prazo de envio da nota é diferente de vencimento do recebimento. Não usar o prazo fiscal para marcar pagamento atrasado. Preservar o sufixo do chamado; `24543` não é equivalente a `24543-1`. Não somar valores de linhas e total da mesma mensagem duas vezes. Valores previstos dos serviços e valores solicitados podem diferir: preservar ambos.

## Interface a implementar

Assistente dentro de E-mails e integrações:

1. **Conectar conta:** consentimento Google, caixa vinculada e botão de desconexão.
2. **Destino:** painel atual e cliente obrigatório por regra.
3. **O que capturar:** transferência ou requisição; remetente exato e modelo Positivo ou personalizado.
4. **Testar:** colar exemplo, exibir campos, chamados encontrados e motivos de revisão, sem gravação.
5. **Ativar:** escolher revisão obrigatória ou cadastro automático dos casos completos; definir a janela inicial de busca.

Mostrar última busca, próxima execução prevista, registros criados, duplicados identificados, revisões pendentes e erros. Permitir pausar uma regra e repetir uma execução sem duplicar dados.

## Persistência e processamento — próxima implementação

- `client_id` e seu vínculo composto ao painel foram adicionados às regras. Perfil de extração e modo de processamento automático permanecem na próxima etapa. Manter autorizações administrativas e proprietário da caixa.
- Persistir regra de origem, data do e-mail, identificadores Gmail, decisão, campos extraídos, motivos de revisão e entidade criada. Tokens permanecem privados no backend.
- Criar RPC exclusiva do worker para processar a captura atomicamente: validar regra ativa, conta ativa, acesso atual do proprietário ao painel e cliente autorizado; bloquear o painel; reconhecer duplicatas; criar serviço ou requisição; gravar `request_services`; registrar resultado e auditoria.
- A RPC de revisão atual depende do usuário autenticado e ainda não vincula `request_services` nem persiste o prazo extraído. Atualizá-la para o mesmo fluxo transacional. O worker não deve simplesmente chamar `confirm_capture` com `service_role`, pois essa função exige permissões de usuário.
- Deduplicar por mensagem Gmail/caixa/painel e também por identificador do negócio: chamado completo ou pedido dentro do cliente/painel. Reenvio e encaminhamento podem ter outro ID Gmail, mas representar o mesmo atendimento.
- Identificar duplicatas preexistentes antes de propor índices únicos. Não apagar, unir ou escolher um serviço ambiguamente.
- Pedido existente com valor ou chamados diferentes vai à revisão. Mensagem compatível com várias regras precisa de resolução explícita: a primeira regra não deve vencer silenciosamente.
- Chamado ausente ou ambíguo bloqueia o vínculo automático; a revisão poderá cadastrar/selecionar o atendimento faltante. Uma nova busca não deve recriar o pedido.
- Registrar automação como ação do sistema, junto à conta e regra que a autorizaram; distinguir de confirmação manual.

## Execução em segundo plano

Começar com consulta agendada, sugerida a cada cinco minutos, independente de o app estar aberto. Registrar execução, progresso e retomada. A busca atual cobre 30 dias e até 250 mensagens por regra; não é suficiente como sincronização incremental definitiva.

Persistir cursor/progresso por caixa/regra, processar lotes com limites e retentativas e respeitar quotas do Google. Depois usar Gmail History para alterações incrementais, com nova varredura quando o histórico expirar. Watch/Pub/Sub pode ser uma evolução posterior; não é necessário para a primeira versão.

Normalizar MIME, preferindo texto simples e usando HTML como alternativa. Não juntar ambas as versões como se fossem mensagens diferentes. Anexos e PDFs de pedidos ficam para uma etapa posterior à leitura confiável do corpo. Nenhuma automação de envio de e-mail, emissão fiscal ou confirmação bancária faz parte desta etapa.

## Ativação e critérios de aceite

1. Configurar o projeto Google do SafeNota, Gmail API, cliente OAuth e retorno da Edge Function. Conferir os requisitos de publicação/verificação do Google para o escopo usado.
2. Configurar segredos no backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SYNC_CRON_SECRET` e `APP_ORIGIN`. Reutilizar a configuração existente quando válida. Nunca colocar esses segredos em variáveis `VITE_*`.
3. Confirmar remetentes, painel/cliente e exemplos sem dados sensíveis adicionais.
4. Implementar e testar regras, RPC, fila e agendamento. Aplicar migrações somente ao Supabase autorizado `fqqnzmhvlvwxlcfwseof`.
5. Conectar a conta pelo consentimento Google e iniciar com prévia/revisão de uma janela curta. Habilitar cadastro automático por regra após conferir os resultados.

Aceite: dois modelos fornecidos; vários chamados por pedido; reenvios sem duplicação; número sem sufixo nunca associado por aproximação; divergências revisáveis; falhas recuperáveis; revogação da conta e remoção do painel interrompem novas importações; nenhuma captura marca nota gerada ou pagamento recebido. A configuração da regra não permite acesso a caixas ou dados de outros usuários.

Documentação oficial para a ativação: [Gmail API](https://developers.google.com/workspace/gmail/api/guides), [OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server), [sincronização](https://developers.google.com/workspace/gmail/api/guides/sync) e [escopos](https://developers.google.com/workspace/gmail/api/auth/scopes).
