# Design — Doação via Pix (PoseidonPay) + Facebook CAPI

**Data:** 2026-07-23
**Projeto:** Zuzu for Africa (React 19 + Vite + Express + TypeScript)
**Autor:** Felipe (com Claude)

## 1. Objetivo

Ativar doações reais via **Pix** no site Zuzu for Africa, substituindo o fluxo atual
"lista de apoio / pagamento em breve" (Stripe placeholder). O doador escolhe um valor,
informa nome + e-mail (podendo marcar "doar anonimamente" para o mural), gera um QR Code
Pix, paga no app do banco, e vê a confirmação na tela em tempo real + recebe e-mail.

Para maximizar a conversão de campanhas de anúncio, cada etapa do funil é enviada ao
**Facebook via Pixel (browser) + Conversions API (servidor)** com e-mail hasheado.

## 2. Decisões (fechadas no brainstorming)

| Tema | Decisão |
|------|---------|
| Escopo | Integração completa no `DonationWidget` existente (opção B) |
| Facebook | Pixel **+** Conversions API (CAPI) server-side, e-mail hasheado SHA-256 |
| Eventos | `InitiateCheckout` ao gerar QR Code + `Purchase` na confirmação do webhook |
| Feedback ao doador | **Polling** (tela atualiza sozinha) **+** e-mail de confirmação |
| Persistência | **Supabase (Postgres)** via `service_role` no backend |
| E-mail | **Resend** (configurável via `.env`, fallback gracioso p/ log) |
| "Anônimo" | Só afeta o mural público; dados reais sempre vão à API e ao CAPI (opção A) |
| Campos obrigatórios da API | Formulário enxuto (nome+e-mail); backend preenche `phone`/`document` com placeholder (A2) |

## 3. Arquitetura

```
┌─────────────────────────── FRONTEND (React) ───────────────────────────┐
│ DonationWidget.tsx                                                       │
│  Step 1: valor  →  Step 2: nome+email+anônimo  →  Step 3: QR Code + poll │
│                                                       ↓                  │
│  fbq('InitiateCheckout')          polling GET /api/donations/:id/status  │
└───────────────┬─────────────────────────────────────────┬──────────────┘
                │ POST /api/pix/create                      │
                ▼                                           ▼
┌─────────────────────────── BACKEND (Express server.ts) ─────────────────┐
│  POST /api/pix/create                                                    │
│    1. valida input                                                       │
│    2. gera identifier único                                              │
│    3. INSERT transação (status=PENDING) no Supabase                      │
│    4. chama PoseidonPay POST /gateway/pix/receive                        │
│    5. envia CAPI InitiateCheckout (server-side)                          │
│    6. devolve { pixCode, qrImage, transactionId } ao frontend            │
│                                                                          │
│  GET /api/donations/:id/status  → lê status no Supabase (p/ polling)     │
│                                                                          │
│  POST /api/webhooks/poseidonpay  ← PoseidonPay chama quando paga         │
│    1. valida origem (secret na URL / header)                             │
│    2. UPDATE transação status=OK no Supabase                             │
│    3. envia CAPI Purchase (server-side)                                  │
│    4. envia e-mail de confirmação (Resend)                               │
│    5. insere no mural (respeitando anônimo)                              │
└─────────────────────────────────────────────────────────────────────────┘
       │ pg (service_role)          │ PoseidonPay API      │ Resend / Graph API
       ▼                            ▼                      ▼
   Supabase Postgres           app.poseidonpay.site    api.resend.com / graph.facebook.com
```

## 4. Componentes (unidades isoladas)

Cada arquivo tem uma responsabilidade única e interface clara. `server.ts` hoje tem
~160 linhas; a lógica de pagamento **não** vai inchar esse arquivo — vai em módulos
dedicados sob `server/`, e `server.ts` só monta as rotas.

### 4.1 `server/lib/supabase.ts`
- **O quê:** cliente Postgres/Supabase único (usando `@supabase/supabase-js` com `service_role`).
- **Interface:** exporta `supabase` (client) e helpers `createTransaction`, `getTransaction`,
  `markTransactionPaid`, `insertMuralMessage`.
- **Depende de:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (env).

### 4.2 `server/lib/poseidon.ts`
- **O quê:** wrapper da API PoseidonPay. Função `createPixCharge(input)` que monta o body,
  envia headers `x-public-key`/`x-secret-key`, e normaliza a resposta (`pix.code`, `pix.image`,
  `transactionId`, `status`, `fee`). Trata os erros 400 documentados.
- **Depende de:** `POSEIDON_PUBLIC_KEY`, `POSEIDON_SECRET_KEY`, `POSEIDON_BASE_URL` (env).

### 4.3 `server/lib/facebook-capi.ts`
- **O quê:** envia eventos ao Graph API. `sendCapiEvent({ eventName, email, value, ... })`.
  Hasheia e-mail com SHA-256 (normalizado: trim + lowercase). Inclui `event_id` para
  **deduplicação** com o Pixel do browser (mesmo `event_id` nos dois lados).
- **Depende de:** `FB_PIXEL_ID`, `FB_CAPI_ACCESS_TOKEN`, `FB_TEST_EVENT_CODE` (opcional) (env).
- **Fallback:** sem token → loga e retorna sem quebrar.

### 4.4 `server/lib/email.ts`
- **O quê:** `sendConfirmationEmail({ to, name, amount, transactionId })` via Resend.
- **Depende de:** `RESEND_API_KEY`, `EMAIL_FROM` (env).
- **Fallback:** sem key → loga "[email] enviaria para X" e retorna sem quebrar (padrão Gemini).

### 4.5 `server/routes/pix.ts`
- **O quê:** as 3 rotas (`create`, `status`, `webhook`). Orquestra os módulos acima.
- Montado em `server.ts` via `app.use('/api', pixRoutes)`.

### 4.6 `src/components/DonationWidget.tsx` (refatorado)
- Step 1 (valor) permanece.
- Step 2: nome + e-mail (obrigatórios) + **checkbox "Doar anonimamente"** + WhatsApp/mensagem
  (opcionais). Botão vira **"GERAR PIX"** (não mais "entrar na lista").
- Step 3 (**novo**): exibe **QR Code** (renderizado a partir do `pix.code`) + **copia-e-cola**
  com botão de copiar + faz **polling** do status. Ao confirmar → tela "Pagamento recebido! 💛".
  Timer/expiração visual opcional.
- Dispara `fbq('track','InitiateCheckout')` no browser ao gerar (com `event_id` compartilhado).

### 4.7 `src/lib/fbpixel.ts` (novo)
- Helper client-side: inicializa `fbq` e expõe `trackInitiateCheckout(eventId, value)`.
- O snippet base do Pixel vai no `index.html` (ou injetado condicionalmente se `FB_PIXEL_ID` presente).

### 4.8 Textos do site (`App.tsx`, FAQ, `metadata.json`)
- Remover/atualizar todas as menções a **"pagamento em breve"**, **"cobrança não está ativa"**
  e **"Stripe"** — agora o Pix está ativo. FAQ "Como será feito o pagamento?" reescrito para Pix.
  Selo do header "Pagamento em breve" → "Pix seguro" (ou similar).

## 5. Modelo de dados (Supabase)

Tabela **`transactions`**:

| coluna | tipo | nota |
|--------|------|------|
| `id` | uuid (pk, default gen_random_uuid) | id interno |
| `identifier` | text unique | nosso id enviado à PoseidonPay |
| `poseidon_transaction_id` | text null | id retornado pela API |
| `amount` | numeric | valor em reais |
| `donor_name` | text | nome real |
| `donor_email` | text | e-mail real (usado no CAPI) |
| `donor_phone` | text null | opcional |
| `message` | text null | mensagem p/ mural |
| `is_anonymous` | boolean default false | esconde nome no mural |
| `status` | text default 'PENDING' | PENDING / OK / FAILED / ... |
| `pix_code` | text null | copia-e-cola |
| `created_at` | timestamptz default now() | |
| `paid_at` | timestamptz null | quando webhook confirmou |

Tabela **`mural_messages`** (substitui o array `recentDonations` em memória): `id`, `name`,
`amount`, `message`, `created_at`. Só recebe INSERT **após pagamento confirmado**.

- **RLS:** ligada nas duas tabelas. Backend usa `service_role` (bypassa RLS). O frontend
  **não** acessa o Supabase diretamente (só via nossas rotas Express), então nenhuma policy
  pública de escrita é necessária. Leitura do mural: feita pelo backend, não pelo browser.
- **`.env` NÃO** contém a `anon key` porque o browser não fala com o Supabase.

## 6. Fluxo de dados (feliz)

1. Doador escolhe R$50 → Step 2 → nome "João", email "joao@x.com", **não** anônimo → "GERAR PIX".
2. Front `POST /api/pix/create` `{ amount, name, email, isAnonymous, message }`.
3. Back gera `identifier`, INSERT `transactions` (PENDING), chama PoseidonPay, recebe `pix.code`+`image`.
4. Back envia CAPI `InitiateCheckout` (value=50, email hasheado, `event_id=evt_<identifier>`).
5. Back responde `{ transactionId, pixCode, qrImage }`. Front mostra QR + copia-e-cola.
6. Front dispara `fbq('InitiateCheckout')` com o mesmo `event_id` (dedupe).
7. Front faz `GET /api/donations/:transactionId/status` a cada ~4s.
8. Doador paga no banco. PoseidonPay chama `POST /api/webhooks/poseidonpay`.
9. Back valida, UPDATE status=OK + `paid_at`, envia CAPI `Purchase`, envia e-mail (Resend),
   INSERT no mural (nome ou "Doador Anônimo" conforme flag).
10. Próximo polling retorna `OK` → Front mostra "Pagamento recebido! 💛".

## 7. Tratamento de erros

- **PoseidonPay 400/rede:** back devolve erro amigável; transação fica marcada FAILED ou é
  removida; front mostra "Não foi possível gerar o Pix, tente novamente".
- **Webhook duplicado:** idempotente — se já está `OK`, não reenvia CAPI/e-mail (checa status antes).
- **Webhook de transação inexistente:** loga e responde 200 (não quebra o retry da PoseidonPay).
- **CAPI/Resend indisponíveis:** falham em silêncio (log), **nunca** bloqueiam a confirmação do pagamento.
- **Polling infinito:** front para após ~15 min ou ao receber status terminal; oferece "gerar novo Pix".
- **Segurança do webhook:** URL contém um segredo (`WEBHOOK_SECRET`) no path/query; requests sem
  ele são rejeitadas (401). (A PoseidonPay não documenta assinatura HMAC; usamos segredo na URL.)

## 8. Variáveis de ambiente novas (`.env` / `.env.example`)

```
# PoseidonPay
POSEIDON_BASE_URL="https://app.poseidonpay.site/api/v1"
POSEIDON_PUBLIC_KEY=""
POSEIDON_SECRET_KEY=""

# Supabase (service_role — SÓ backend, nunca frontend)
SUPABASE_URL="https://gobhrarraopgalhrrizm.supabase.co"
SUPABASE_SERVICE_ROLE_KEY=""

# Facebook Conversions API (backend)
FB_PIXEL_ID=""
FB_CAPI_ACCESS_TOKEN=""
FB_TEST_EVENT_CODE=""        # opcional, p/ testar eventos

# Facebook Pixel (frontend — precisa do prefixo VITE_ p/ o Vite expor ao browser)
VITE_FB_PIXEL_ID=""          # mesmo valor de FB_PIXEL_ID, exposto ao browser

# Resend
RESEND_API_KEY=""
EMAIL_FROM="Zuzu for Africa <doacoes@seu-dominio.com>"

# Webhook
WEBHOOK_SECRET=""            # segredo que valida chamadas da PoseidonPay
PUBLIC_BASE_URL=""           # URL pública do site (p/ montar o callbackUrl)
```

> ⚠️ **Segurança:** as chaves coladas no chat (service_role, secret) devem ser **rotacionadas**
> no painel do Supabase antes de ir a produção, pois foram expostas. Nada de credenciais no código.

## 9. Testes

- **Unit:** `facebook-capi.ts` (hash SHA-256 correto e determinístico), `poseidon.ts` (monta body
  correto, parseia 201 e 400), `email.ts` (fallback sem key).
- **Integração (mock):** `POST /api/pix/create` com PoseidonPay/Supabase mockados → cria transação
  PENDING e retorna pixCode. Webhook → marca OK, dispara CAPI Purchase, e é idempotente no 2º call.
- **Manual:** gerar Pix real de valor baixo (ex. R$1), pagar, ver tela mudar + e-mail chegar +
  evento aparecer no Facebook Events Manager (com Test Event Code).

## 10. Fora de escopo (YAGNI)

- Dashboard admin de doações.
- Reembolso/estorno.
- Múltiplas moedas / doação internacional.
- Split de pagamento (a API suporta `splits`, mas não usamos agora).
- Recibo fiscal / prestação de contas formal.
