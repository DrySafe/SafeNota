# Conectar a Vercel ao Supabase

O banco do SafeNota já está implantado no projeto `fqqnzmhvlvwxlcfwseof`.
As variáveis do ambiente Codex e as variáveis da Vercel são configurações independentes.

## Variáveis do frontend

No projeto Vercel, em Settings → Environment Variables, configure:

| Nome                     | Valor                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://fqqnzmhvlvwxlcfwseof.supabase.co`                           |
| `VITE_SUPABASE_ANON_KEY` | A chave pública anon do mesmo projeto, disponível no painel Supabase |

Selecione Production e, se usar implantações de prévia, Preview. Execute um novo deployment após salvar; Vite incorpora esses valores ao JavaScript durante o build. Mudar variáveis não altera uma implantação já compilada.

Use somente a chave pública no frontend. Access Token administrativo, service_role, chave JWT de assinatura e segredos Google ficam fora das variáveis `VITE_*`.

O `vercel.json` configura Vite e o fallback para `index.html`, permitindo atualizar páginas como `/clientes` e `/receber`. Use a raiz do repositório como Root Directory, `npm run build` como Build Command e `dist` como Output Directory.

## Autenticação e integrações

Depois de confirmar a URL HTTPS real da aplicação, no projeto Supabase autorizado:

1. Defina Auth → URL Configuration → Site URL como a origem publicada.
2. Adicione essa origem à lista de Redirect URLs. Preserve URLs válidas já usadas; não autorize indiscriminadamente projetos Vercel de terceiros.
3. Atualize o segredo `APP_ORIGIN` das Edge Functions para a mesma origem, sem barra final.

A confirmação de e-mail permanece habilitada. SMTP personalizado é necessário para entrega de confirmações a clientes em produção; a configuração padrão Supabase tem limitações. A integração Gmail também exige seu cliente OAuth Google.

## Conferência do modo real

Na tela inicial devem aparecer campos de e-mail/senha e a ação Criar uma conta. O botão Explorar demonstração continua disponível, mas usa dados fictícios e não grava no banco.

Para gravar dados reais, entre com uma conta confirmada sem clicar na demonstração, crie seu painel e um cliente, depois atualize o navegador. O registro deve continuar disponível na mesma conta. Verifique também abertura direta de uma página interna.

Se a tela mostrar Supabase ainda não configurado, confira nomes das variáveis, ambiente selecionado e novo deployment. Se o cadastro informar falha de envio de e-mail, confira SMTP no Supabase; isso é separado da conexão do banco.
