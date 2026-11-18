# Loja Árvore de Natal — landing + carrinho + checkout Pix (Profanus Pay)

HTML/CSS/JS puro + API Node (sem dependências, sem banco, sem webhook). Roda local e na Vercel.

## Rodar local
```
cp .env.example .env      # preencha PROFANUS_API_KEY
npm start                 # http://localhost:3000
npm test                  # teste de ponta a ponta com gateway SIMULADO
```

## Deploy na Vercel (só 1 variável)
1. Suba o projeto no GitHub e importe na Vercel (sem build; `vercel.json` já serve `public/` e a API em `api/[...path].js`).
2. Settings → Environment Variables → **`PROFANUS_API_KEY`** = sua chave `profanus_live_...` (Production).
3. Redeploy. Confira `https://SEU-DOMINIO/api/health` → `{"ok":true,"pix":true}`.

## O que editar
- `public/js/config.js` — textos, preços, frete, prazos, Pix (modo/valor), números, IDs Meta/GA, imagens.
- `public/img/` — imagens/logo.

## Fluxo
`/` → `/carrinho` → `/checkout/dados` → `/checkout/entrega` (CEP + frete) → `/checkout/pagamento` → `/checkout/pix` (QR + copia e cola, contador, verificação automática) → `/confirmacao`

## Como funciona sem banco
- O navegador guarda carrinho, dados e endereço; ao gerar o Pix ele reenvia tudo e o **servidor revalida e recalcula** preço/frete pelo `config.js`.
- `POST /api/pix/create` (Profanus) com `external_id = <pedido>_<tentativa>`: repetir o mesmo external_id devolve a mesma cobrança, então duplo clique não cobra duas vezes. Falhas temporárias (429/5xx/timeout) têm retry exponencial.
- O status do pedido vem sempre de `GET /api/pix/{external_id}` na Profanus; a tela do Pix consulta a cada ~4 s. Não há webhook.
- **Os dados de entrega ficam resumidos na descrição do Pix** (pedido, quantidade/tamanho, nome, telefone, CEP, número, rua…, máx. 140 caracteres). É por ela que você identifica quem pagou e para onde enviar, no painel da Profanus.
- Mensagens do formulário de contato vão para os Logs da Vercel (e por e-mail, se configurar `RESEND_API_KEY`, `MAIL_FROM`, `CONTACT_NOTIFY_EMAIL`).
