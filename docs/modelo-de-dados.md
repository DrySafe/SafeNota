# SafeNota — modelo de dados e regras

Status: proposta para implementação, baseada no escopo aprovado. Nenhuma tabela, política ou integração foi implantada no Supabase ainda.

## Limite de acesso

Um painel é uma unidade de organização e isolamento, não necessariamente uma pessoa jurídica. POSITIVO, SAFETECHNOLOGY e Daniel Regis podem ser painéis. Clientes contratantes ficam dentro de cada painel. Um painel de pessoa física pode controlar serviços e recebimentos sem exigir nota fiscal.

Usuários pertencem a zero ou mais painéis, com um papel por painel. Criar conta não cria acesso a dados de terceiros; criar painel inclui seu criador como administrador. Remover uma participação encerra o acesso ao painel, inclusive aos anexos. Não criar acesso global ao conteúdo para a administração do SaaS.

Usar UUIDs, datas de negócio como `date`, instantes como `timestamptz` e valores monetários como `numeric(14,2)` em BRL. Identificadores fiscais, números de pedidos e chamados são texto: conservar zeros e sufixos. Cada painel terá fuso horário configurável, inicialmente America/Sao_Paulo.

## Entidades

| Tabela                   | Campos principais e finalidade                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| profiles                 | id vinculado a auth.users, nome e preferências. Sem autorização implícita por perfil.                                                                                             |
| panels                   | id, nome, fuso, created_by. Configuração de vencimento de notas, inicialmente emissão + 20 dias corridos.                                                                         |
| memberships              | panel_id, user_id, role: admin/operator/viewer. Um vínculo por usuário e painel.                                                                                                  |
| invitations              | panel_id, e-mail, papel, validade, estado e autor. Aceitação vinculada à identidade autenticada com e-mail verificado.                                                            |
| clients                  | panel_id, nome/razão social, CPF/CNPJ opcional, contatos e endereço.                                                                                                              |
| contracts                | panel_id, client_id, descrição, valor mensal, início, fim opcional, dia de vencimento, ativo e exigência de nota.                                                                 |
| projects                 | panel_id, client_id, descrição, prazo e situação.                                                                                                                                 |
| project_stages           | panel_id, project_id, nome, ordem, prazo opcional e situação.                                                                                                                     |
| services                 | panel_id, client_id, contract_id/project_id opcionais, descrição, valor esperado, data, responsável, estado, número do chamado e referência externa.                              |
| billing_requests         | panel_id, client_id, número do pedido, valor solicitado, prazo de envio da nota, instruções de descrição/tributação e estado de confirmação.                                      |
| billing_request_services | panel_id, billing_request_id, service_id e valor atribuído. Relaciona chamados ao pedido, sem duplicar o serviço.                                                                 |
| invoices                 | panel_id, client_id, chave fiscal, número, emissor, tomador, emissão, competência, valor bruto, líquido e estado fiscal: issued/cancelled.                                        |
| invoice_request_links    | panel_id, invoice_id, billing_request_id. Permite várias notas por pedido e associação explícita de pedidos a uma nota.                                                           |
| receivables              | panel_id, client_id, descrição, competência opcional, valor esperado, vencimento opcional, origem invoice/contract/service e referências de origem. Unidade financeira a receber. |
| receivable_invoice_links | panel_id, receivable_id, invoice_id e valor coberto. Associa notas às cobranças sem criar uma segunda dívida.                                                                     |
| payments                 | panel_id, client_id, data, valor recebido, método, observações, autor e situação active/reversed.                                                                                 |
| payment_allocations      | panel_id, payment_id, receivable_id e valor aplicado. Um depósito pode quitar várias cobranças; uma cobrança pode receber vários pagamentos.                                      |
| attachments              | panel_id, objeto privado no Storage, tipo, tamanho, nome original e vínculo com nota/pagamento/serviço/pedido. XML, PDF, imagens e comprovantes.                                  |
| gmail_connections        | user_id, identidade Google, escopos, estado e referência privada às credenciais. Nunca expor tokens ao cliente ou aos demais membros.                                             |
| email_rules              | panel_id, connection_id, remetentes, tipo de mensagem, palavras-chave e configuração versionada de extração.                                                                      |
| captured_messages        | panel_id, connection_id, message_id, regra, data, dados extraídos necessários e estado de revisão. Armazenar apenas conteúdo necessário ao fluxo.                                 |
| import_batches           | panel_id, tipo, autor, início, término e contadores de sucesso, duplicados e erros.                                                                                               |
| import_items             | panel_id, batch_id, identificação do arquivo e resultado individual com diagnóstico.                                                                                              |
| audit_events             | panel_id, ator, instante, ação, entidade, identificador e alterações relevantes. Histórico append-only, sem tokens ou conteúdo completo de e-mails.                               |

Todas as entidades vinculadas a um painel carregam `panel_id`, criação, atualização e, quando aplicável, `deleted_at`/`deleted_by`. E-mails e documentos fiscais contêm dados pessoais: não reproduzir seus valores em logs operacionais.

## Evitar cobrança duplicada

- Serviço avulso faturado por nota gera uma cobrança associada à nota. O serviço não deve continuar somando outra cobrança pelo mesmo valor.
- Contrato gera uma cobrança por competência. Ao importar sua nota, associá-la à cobrança existente; não gerar uma dívida adicional.
- Serviço extra de contrato pode gerar uma cobrança independente. Não presumir que todo serviço vinculado ao contrato está incluído na mensalidade.
- A nota conserva os valores fiscais. A cobrança registra o valor esperado para recebimento, podendo diferir por retenção ou desconto, com motivo registrado.
- Pedido registra a solicitação de emissão, não outra dívida. Projetos organizam etapas; receitas de projeto são registradas nos serviços/cobranças associados.

## Estados e cálculo financeiro

Serviço: aguardando revisão, aguardando atendimento, em atendimento, concluído ou cancelado. Estado recebido por e-mail é sugestão até confirmação.

Pedido: aguardando confirmação, a gerar, parcialmente faturado, faturado ou cancelado. A situação é calculada/atualizada conforme confirmações e vínculos, com revisão de divergências de valor.

Nota: gerada ou cancelada. A gerar pertence ao pedido, pois ainda não há documento fiscal.

Recebimento: pendente, parcial ou pago, calculado pelas alocações de pagamentos ativos. Atraso é um indicador derivado de vencimento anterior à data local e saldo positivo. Cobranças sem vencimento aparecem como sem previsão.

Saldo = valor esperado − soma das alocações ativas. Não permitir alocação negativa ou acima do saldo. A soma das alocações não pode superar o pagamento. Pode existir valor recebido ainda não distribuído, mostrado explicitamente. Valores esperados não podem ser reduzidos abaixo do que já foi alocado sem ajuste financeiro auditado.

Registrar pagamento e alocações em uma transação no servidor, com bloqueio das linhas pertinentes para evitar confirmação simultânea acima do saldo. Usar chave de idempotência para impedir pagamento duplicado por repetição de envio. Reversão conserva pagamento e alocações no histórico, mas deixa de contabilizá-los.

Cancelamento fiscal não elimina dinheiro recebido. Se a nota tiver pagamento ou cobrança associada, exigir decisão explícita do administrador sobre a cobrança; sinalizar necessidade de devolução/ajuste quando aplicável. Uma nota substituta pode ser associada à mesma cobrança, conservando o histórico.

## Contratos recorrentes

Job diário gera competências de contratos ativos com índice único por contrato e competência. Reexecutar não duplica registros. Para vencimento em dia inexistente, usar o último dia do mês. Datas inicial e final limitam os meses elegíveis. Na criação, oferecer prévia da primeira competência; não gerar histórico retroativo automaticamente.

Alterações de valor ou vencimento se aplicam a competências futuras, preservando registros já gerados. Encerrar contrato interrompe novas competências e conserva pendências existentes. Não aplicar proporcionalidade automática na primeira versão: permitir valor ajustado com justificativa.

## Permissões e RLS

| Ação                                                             | Admin | Operador | Consulta |
| ---------------------------------------------------------------- | ----- | -------- | -------- |
| Consultar dados e anexos do painel                               | Sim   | Sim      | Sim      |
| Cadastrar/editar serviços, clientes, contratos, projetos e notas | Sim   | Sim      | Não      |
| Confirmar extrações e importar XML                               | Sim   | Sim      | Não      |
| Registrar pagamentos e anexos                                    | Sim   | Sim      | Não      |
| Excluir/restaurar registros ou reverter pagamentos               | Sim   | Não      | Não      |
| Convidar/remover membros e alterar papéis                        | Sim   | Não      | Não      |
| Configurar painel e regras compartilhadas de captura             | Sim   | Não      | Não      |
| Consultar histórico de auditoria                                 | Sim   | Não      | Não      |

Cada usuário conecta/revoga sua própria conta Google. Administradores podem configurar o uso dessa conexão em um painel com consentimento do proprietário. Revogar conexão ou remover o proprietário do painel interrompe as regras daquele painel sem remover registros previamente confirmados.

Aplicar RLS por vínculo ativo em todas as tabelas de negócio. Usar chaves estrangeiras compostas com `panel_id` para impedir relações entre painéis. UPDATE verifica acesso ao registro anterior e novo; proibir mover registros para outro painel. Campos de papel, exclusão e estado financeiro não podem ser alterados para contornar funções restritas.

Storage com buckets privados e autorização por painel, sem URLs públicas permanentes. URLs temporárias devem ter expiração curta; a remoção do membro encerra novos acessos, mas URLs já emitidas podem funcionar até expirar. Não prometer revogação instantânea de downloads já autorizados.

Funções privilegiadas validam usuário, participação e papel no servidor; service_role nunca chega ao navegador. Jobs internos têm privilégios mínimos e revalidam conexões e regras. Tokens OAuth ficam em armazenamento privado com acesso somente do backend.

Impedir a saída, remoção ou rebaixamento do último administrador. Convites e mudanças de papel são auditados. Logs são produzidos no banco/backend, não por requisições arbitrárias do navegador. Exclusão lógica preserva integridade e histórico; retenção e eliminação definitiva serão definidas antes de produção.

## Gmail e importação fiscal

OAuth é configurado pelo SaaS. O usuário conecta pelo Google sem criar uma API individual. Credenciais Google, escopos e eventual verificação do aplicativo são requisitos de implantação; ainda não validados.

Regras por remetente suportam assunto, palavras-chave e extração de campos do texto/tabelas. A prévia permite escolher destino e tipo: transferência de chamado ou pedido de nota. Número de chamado conserva sufixos; `24543` não é automaticamente equivalente a `24543-1`. Referências como INC e SUP ficam em campos separados.

O mesmo e-mail não é importado duas vezes no mesmo painel/conexão. Evitar regras que criem duplicatas no mesmo destino; importação para painéis diferentes requer decisão explícita. Mostrar ambiguidades, pedidos sem chamados correspondentes, divergências de valor e falhas de captura. Não confirmar automaticamente dados financeiros.

Registrar o message_id no provedor e referência de origem. Não compartilhar a caixa de e-mail inteira com membros do painel. Leitura do Gmail não implica autorização para enviar mensagens; envio automático está fora da primeira versão.

XML nacional analisado: namespace `http://www.sped.fazenda.gov.br/nfse`, versão 1.01. Extrair chave, número, emitente, tomador, emissão, competência, valores e descrição. O exemplo contém pedido/chamado na descrição; outros formatos exigem revisão. Índice único por painel/chave fiscal para duplicatas. Recusar XML malformado, limitar tamanho e desabilitar resolução de entidades externas. Leitura do arquivo não equivale a validação criptográfica nem consulta oficial de cancelamento.

Arquivos inconsistentes com os prestadores/tomadores configurados geram alerta antes de confirmar. Importação em lote tem resultado por arquivo, permitindo corrigir falhas sem repetir os itens válidos. Guardar original privado; PDF pode ser anexado separadamente. API de consulta NFS-e e Open Finance não entram como dependências do primeiro lançamento.

## Validação exigida na implementação

- Usuário de um painel não consegue consultar, alterar ou baixar dados de outro; remoção encerra novos acessos.
- Operador não consegue excluir/reverter por chamada direta ao backend; consulta não consegue escrever.
- Mensalidades e importações permanecem únicas após reexecução.
- Nota de contrato não duplica a cobrança da competência.
- Um pagamento quita várias notas e pagamentos parciais deixam saldo correto.
- Duas baixas concorrentes não superam saldo; reenvio não duplica pagamento.
- Reversão e exclusão conservam histórico; cancelamento não apaga recebimentos.
- E-mails ambíguos ficam para revisão e não marcam automaticamente serviços/notas como pagos.
