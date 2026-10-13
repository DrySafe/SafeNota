# SafeNota — telas e fluxos para celular

Status: desenho funcional para implementação. Não há protótipo navegável ou aplicação executando ainda.

## Navegação

Seletor de painel sempre visível no topo. Nome do painel permanece visível em criação, importação e pagamento para evitar registrar no destino errado. Navegação inferior: Resumo, Trabalho, Receber e Mais. Botão Adicionar oferece serviço, pedido, pagamento ou importação de nota. Não misturar dados de painéis em uma lista na primeira versão.

## Resumo

Cartões: saldo a receber, vencido, recebido no mês e valor recebido ainda não distribuído. Não somar simultaneamente pedido, serviço e nota referentes à mesma cobrança.

Pendências acionáveis: chamados para revisar, serviços concluídos sem pedido, pedidos a gerar, notas vencidas, contratos pendentes e capturas/importações com erro. Cores acompanham texto e ícone; atraso aparece em vermelho com vencimento e dias de atraso.

Busca por cliente, chamado, pedido e número da nota. Cada cartão abre a lista filtrada. Valores agregados respeitam o painel e sua data local.

## Trabalho

Filtros simples para Serviços, Pedidos, Contratos e Projetos. Cartões mostram cliente, identificador, valor quando aplicável e próxima ação. Formulário curto com detalhes opcionais recolhidos.

Serviço: cliente, descrição, chamado/referência opcionais, valor e estado. Permite contrato/projeto e indicar se é extra do contrato. Cadastro de pessoa física não exige CNPJ ou nota.

Pedido: número, cliente, valor, chamados, prazo de envio e orientações da contratante. Mostrar soma dos chamados e divergência com o total solicitado. Gerar descrição copiável com pedido e chamados; emissão continua no portal externo. Anexar PDF e registrar envio manual sem presumir que importar nota a enviou.

Contrato: cliente, valor mensal, início/fim, dia de vencimento e exigência de nota. Prévia da primeira cobrança antes de salvar. Detalhe apresenta competências e pagamentos; edição informa que vale para competências futuras.

Projeto: cliente, descrição, prazo e etapas. Lista de etapas com estado e prazo opcional. Sem ferramenta completa de tarefas na primeira versão.

## Receber

Abas Pendentes e Pagamentos. Pendentes mostra cobranças, com nota associada quando existir: cliente, pedido/competência, valor esperado, saldo e vencimento. Filtros por cliente, atraso e período.

Detalhe apresenta trilha serviço → pedido → nota → cobrança → pagamentos, além dos arquivos. Valores fiscais e valor esperado aparecem identificados quando diferentes. Ação principal: Registrar pagamento. Seleção de vários itens inicia uma única baixa.

### Depósito que quita várias notas

1. Informar cliente, valor recebido, data e método.
2. Selecionar cobranças pendentes do mesmo cliente e painel; busca por pedido/chamado/nota.
3. Mostrar valor do depósito, total distribuído e restante. Editar aplicação parcial por cobrança.
4. Anexar comprovante e cópias de notas opcionalmente, sem impedir salvar.
5. Confirmar em uma única ação e exibir resultado com saldos atualizados.

Pode salvar com valor não distribuído, avisando claramente. Não alocar acima do pagamento ou saldo. Sugestões por valor/vencimento nunca confirmam correspondência por conta própria. Para quitação simples, cliente e valor vêm preenchidos e os anexos são opcionais.

Pagamento registrado tem detalhe com distribuição e comprovantes. Administrador pode reverter com motivo e confirmação explícita; operador não vê essa ação. Consulta pode visualizar.

## Captura de e-mails

Em Mais → Integrações, conectar conta Google com OAuth, explicação do acesso solicitado e opção de desconectar. Exibir conexão saudável, pausada ou exigindo nova autorização; não pedir que o usuário crie chaves de API.

Cadastro de regra: conta, painel destino, remetente, tipo de e-mail, palavras-chave e campos. Usar mensagem de exemplo para prévia. Facilitar padrões para pedido Positivo e transferência de chamado, mantendo a possibilidade de ajuste. Configuração compartilhada exige administrador; conexão pessoal exige autorização do proprietário.

Central de revisão separa mensagem original necessária e campos extraídos. Permite corrigir dados, vincular chamado existente, confirmar ou ignorar. Mostrar explicitamente estado informado no e-mail. Um chamado informado como concluído só recebe esse estado ao confirmar.

Pedido confirmado cria situação a gerar. Captura de transferência conserva identificadores completos. Correspondência duvidosa exige escolha; não fundir chamados pelo número sem sufixo. Guardar referência ao e-mail sem disponibilizar outras mensagens da caixa.

## Importação de XML

Escolher vários arquivos ou ZIP; upload local não implica enviar ZIP à contratante. Aplicar limites de tamanho e quantidade, inclusive após descompactar. Prévia por arquivo com nota, cliente, valores e sugestão de pedido/contrato. Confirmar associação quando inconclusiva. Resultado final: importadas, já existentes e falhas, com diagnóstico individual.

Importação de nota de contrato propõe a competência existente. Não criar uma cobrança duplicada. Oferecer PDF adicional como anexo, conservando XML original. Não exigir PDF para importar.

## Administração

Mais reúne Clientes, Integrações, Membros, Configurações, Arquivados e Histórico conforme o papel. Convidar informa painel e papel claramente. Último administrador não pode ser removido/rebaixado. Administradores podem excluir/restaurar registros e consultar logs.

Ao perder acesso, limpar dados locais do painel, encerrar assinaturas de atualização e retornar ao seletor. Informar que o acesso foi encerrado sem revelar mais dados.

## Comportamentos comuns

Campos monetários usam formatação brasileira; documentos e identificadores conservam zeros. Datas mostram formato brasileiro. Estado vazio oferece próxima ação. Salvamento mostra andamento, impede repetição e preserva formulário em erro. Upload exibe progresso e resultado. Formulários têm rótulos, foco e alvos de toque adequados; nenhuma função depende de hover ou apenas cor.

Não implementar cache offline de documentos e dados financeiros na primeira versão. Conexão ausente mostra mensagem e preserva apenas o formulário da sessão para tentar novamente, sem afirmar que a operação foi salva.

## Ordem de implementação

1. Base Supabase: autenticação, painéis, membros, RLS, Storage privado e auditoria.
2. Clientes, serviços, pedidos, cobranças e pagamentos com distribuição e reversão.
3. Importação XML, vínculos com cobrança e painel de pendências.
4. Gmail: OAuth, processamento, regras e revisão; investigar requisitos Google já na etapa 1 para não adiar essa prioridade.
5. Contratos recorrentes, projetos simples e refinamento do uso no celular.

Gmail faz parte do primeiro lançamento. Pesquisa NFS-e e Open Finance são etapas seguintes. Antes de produção, definir retenção de arquivos/logs, recuperação de conta e requisitos de privacidade, além de validar os fluxos e políticas em testes reais.
