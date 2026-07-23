# Doação via Pix (PoseidonPay) + Facebook CAPI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar doações reais via Pix no site Zuzu for Africa, com QR Code + polling de status em tempo real, e-mail de confirmação (Resend) e eventos de conversão enviados ao Facebook (Pixel no browser + Conversions API no servidor).

**Architecture:** O front (`DonationWidget`) coleta valor + nome + e-mail e chama `POST /api/pix/create`. O backend grava a transação (PENDING) no Supabase, chama a PoseidonPay para gerar o Pix, dispara `InitiateCheckout` via CAPI, e devolve o QR Code. O front exibe o QR e faz polling em `GET /api/donations/:id/status`. Quando o doador paga, a PoseidonPay chama `POST /api/webhooks/poseidonpay/:secret`, que marca a transação como paga, dispara `Purchase` via CAPI, envia o e-mail e insere no mural. A lógica de pagamento vive em módulos isolados sob `server/`, e o Express `app` é extraído para `server/app.ts` (importável sem `listen()`) para permitir testes.

**Tech Stack:** Node 22 (ESM, `"type":"module"`), TypeScript, Express 4, Vite 6 + React 19, `@supabase/supabase-js` v2, `resend` v6, Meta Graph API v25.0 (via `fetch` nativo), Vitest 4.

## Global Constraints

- **Node ≥ 22**, ESM (`"type":"module"`) — use `import`, `node:crypto`, `fetch` nativo. Sem `require`.
- **Nenhuma credencial no código.** Tudo via `process.env` / `.env` (já no `.gitignore` via `.env*`). Atualizar `.env.example` com chaves vazias.
- **A `service_role` do Supabase e as chaves secretas NUNCA vão ao frontend.** O browser só fala com o Supabase indiretamente, via as rotas Express.
- **Fallback gracioso:** se `RESEND_API_KEY`, `FB_CAPI_ACCESS_TOKEN` ou as chaves da PoseidonPay não estiverem setadas, o módulo correspondente loga e retorna sem quebrar (padrão do `getAiClient()` existente). Exceção: `POST /api/pix/create` **precisa** das chaves da PoseidonPay para funcionar — sem elas, retorna erro amigável.
- **Idempotência do webhook:** se a transação já está `OK`, não reenviar CAPI/e-mail/mural.
- **Colunas `numeric` do Postgres voltam como STRING** — sempre coagir com `Number()` antes de usar em cálculo ou enviar como número.
- **CAPI:** Graph `v25.0`; `event_time` em **segundos** (`Math.floor(Date.now()/1000)`); `em` é **array** de SHA-256 hex de `email.trim().toLowerCase()`; dedup exige o MESMO `event_id` + `event_name` no browser e no servidor.
- **Idioma:** todo texto voltado ao usuário em **português (pt-BR)**. Comentários de código podem seguir o estilo do arquivo existente.
- **Sem número inventado** no site (segue a regra já presente em `server.ts`: só dados públicos verificáveis).

---

## File Structure

**Criar:**
- `server/app.ts` — cria e configura o Express `app` (rotas atuais + novas), SEM `listen()`.
- `server/lib/env.ts` — leitura centralizada e tipada das env vars.
- `server/lib/supabase.ts` — client Supabase + helpers de transação/mural.
- `server/lib/poseidon.ts` — wrapper da API PoseidonPay.
- `server/lib/facebook-capi.ts` — envio de eventos ao Graph API + hash de e-mail.
- `server/lib/email.ts` — envio de e-mail de confirmação via Resend.
- `server/routes/pix.ts` — rotas `create`, `status`, `webhook`.
- `server/lib/facebook-capi.test.ts` — testes do hasher e do builder de payload.
- `server/lib/poseidon.test.ts` — testes do builder de body e parse de resposta.
- `server/routes/pix.test.ts` — testes das rotas com dependências mockadas.
- `src/lib/fbpixel.ts` — helper do Pixel no browser.
- `supabase/schema.sql` — DDL das tabelas (para rodar no SQL editor do Supabase).
- `vitest.config.ts` — config de teste (environment node, sem plugins React/Tailwind).

**Modificar:**
- `server.ts` — reduzir para: importar `app` de `server/app.ts` + `listen()`.
- `src/components/DonationWidget.tsx` — Step 2 (checkbox anônimo, botão "GERAR PIX") + Step 3 (QR Code + polling).
- `src/App.tsx` — atualizar textos "pagamento em breve"/"Stripe" e o handler `onDonationComplete`.
- `index.html` — snippet base do Pixel do Facebook.
- `.env.example` — novas variáveis.
- `package.json` — deps (`@supabase/supabase-js`, `resend`) + devDep (`vitest`) + scripts de teste.
- `src/types.ts` — tipos compartilhados novos (opcional, se úteis ao front).

---

## Task 1: Setup de testes (Vitest) + primeiro teste (hash de e-mail)

Estabelece o ciclo de teste e entrega o primeiro módulo puro e testável: o hasher de e-mail do CAPI.

**Files:**
- Create: `vitest.config.ts`
- Create: `server/lib/facebook-capi.ts` (só o `hashEmail` nesta task; o resto vem na Task 6)
- Test: `server/lib/facebook-capi.test.ts`
- Modify: `package.json` (scripts + devDependency)

**Interfaces:**
- Produces: `hashEmail(email: string): string` — SHA-256 hex de `email.trim().toLowerCase()`.

- [ ] **Step 1: Instalar Vitest**

Run:
```bash
npm install -D vitest
```
Expected: instala `vitest@4.x` em `devDependencies`.

- [ ] **Step 2: Adicionar scripts de teste ao `package.json`**

No bloco `"scripts"`, adicionar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 4: Escrever o teste que falha**

Criar `server/lib/facebook-capi.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashEmail } from './facebook-capi';

describe('hashEmail', () => {
  it('normaliza caixa e espaços antes de gerar o hash', () => {
    expect(hashEmail('  JOAO@Gmail.com ')).toBe(hashEmail('joao@gmail.com'));
  });

  it('retorna 64 caracteres hexadecimais (SHA-256)', () => {
    expect(hashEmail('x@y.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('bate com o known-answer do exemplo oficial da Meta', () => {
    // Meta docs: John_Smith@gmail.com -> john_smith@gmail.com -> este hash
    expect(hashEmail('John_Smith@gmail.com')).toBe(
      '62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f',
    );
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `hashEmail` não existe / módulo não encontrado.

- [ ] **Step 6: Implementar o mínimo para passar**

Criar `server/lib/facebook-capi.ts`:
```ts
import { createHash } from 'node:crypto';

/** SHA-256 hex de email normalizado (trim + lowercase), conforme exigido pelo CAPI. */
export function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS (3 testes verdes). O known-answer confirma que a normalização está correta.

---

## Task 2: Leitura centralizada de env vars + `.env.example`

Um único módulo lê e expõe as variáveis, para o resto do código não tocar `process.env` espalhado.

**Files:**
- Create: `server/lib/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: objeto `env` com as chaves tipadas (todas `string`, podendo ser `''` quando não setadas) e helper `requirePoseidon()` que lança erro claro se as chaves da PoseidonPay faltarem.

- [ ] **Step 1: Atualizar `.env.example`**

Substituir o conteúdo por (mantendo as duas variáveis originais no topo):
```
# GEMINI_API_KEY: Required for Gemini AI API calls.
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: The URL where this applet is hosted.
APP_URL="MY_APP_URL"

# --- PoseidonPay (Pix) ---
POSEIDON_BASE_URL="https://app.poseidonpay.site/api/v1"
POSEIDON_PUBLIC_KEY=""
POSEIDON_SECRET_KEY=""

# --- Supabase (service_role — SÓ backend, nunca frontend) ---
SUPABASE_URL="https://gobhrarraopgalhrrizm.supabase.co"
SUPABASE_SERVICE_ROLE_KEY=""

# --- Facebook Conversions API (backend) ---
FB_PIXEL_ID=""
FB_CAPI_ACCESS_TOKEN=""
FB_TEST_EVENT_CODE=""

# --- Facebook Pixel (frontend — precisa do prefixo VITE_) ---
VITE_FB_PIXEL_ID=""

# --- Resend (e-mail) ---
RESEND_API_KEY=""
EMAIL_FROM="Zuzu for Africa <onboarding@resend.dev>"

# --- Webhook / URL pública ---
WEBHOOK_SECRET=""
PUBLIC_BASE_URL="http://localhost:3000"
```

- [ ] **Step 2: Criar `server/lib/env.ts`**

```ts
/** Leitura centralizada das variáveis de ambiente. Strings vazias = não configurado. */
export const env = {
  poseidonBaseUrl: process.env.POSEIDON_BASE_URL || 'https://app.poseidonpay.site/api/v1',
  poseidonPublicKey: process.env.POSEIDON_PUBLIC_KEY || '',
  poseidonSecretKey: process.env.POSEIDON_SECRET_KEY || '',

  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  fbPixelId: process.env.FB_PIXEL_ID || '',
  fbCapiAccessToken: process.env.FB_CAPI_ACCESS_TOKEN || '',
  fbTestEventCode: process.env.FB_TEST_EVENT_CODE || '',

  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Zuzu for Africa <onboarding@resend.dev>',

  webhookSecret: process.env.WEBHOOK_SECRET || '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
};

/** Lança se as chaves da PoseidonPay não estiverem configuradas. */
export function requirePoseidon(): void {
  if (!env.poseidonPublicKey || !env.poseidonSecretKey) {
    throw new Error('PoseidonPay não configurada: defina POSEIDON_PUBLIC_KEY e POSEIDON_SECRET_KEY no .env');
  }
}
```

- [ ] **Step 3: Verificar que compila**

Run:
```bash
npm run lint
```
Expected: sem erros de TypeScript relacionados a `server/lib/env.ts`.

- [ ] **Step 4: Commit (se o projeto usar git)**

> Nota: o projeto atualmente **não** é um repositório git. Se `git init` já tiver sido feito, commitar. Senão, pular todos os passos de commit deste plano.
```bash
git add server/lib/env.ts .env.example
git commit -m "feat: leitura centralizada de env vars para integração Pix"
```

---

## Task 3: Schema do Supabase + client + helpers de dados

Cria as tabelas e o módulo de acesso a dados. Os helpers são a interface que as rotas e o webhook usam.

**Files:**
- Create: `supabase/schema.sql`
- Create: `server/lib/supabase.ts`
- Modify: `package.json` (dependency `@supabase/supabase-js`)

**Interfaces:**
- Consumes: `env` de `server/lib/env.ts`.
- Produces:
  - `type TransactionInput = { identifier, amount, donorName, donorEmail, donorPhone, message, isAnonymous, pixCode }`
  - `type TransactionRow = { id, identifier, poseidon_transaction_id, amount (number, coagido), donor_name, donor_email, donor_phone, message, is_anonymous, status, pix_code, created_at, paid_at }`
  - `createTransaction(input: TransactionInput): Promise<TransactionRow>`
  - `getTransactionByIdentifier(identifier: string): Promise<TransactionRow | null>`
  - `markTransactionPaid(identifier: string, poseidonTransactionId: string | null): Promise<TransactionRow>`
  - `insertMuralMessage(m: { name: string; amount: number; message: string }): Promise<void>`
  - `isSupabaseConfigured(): boolean`

- [ ] **Step 1: Criar `supabase/schema.sql`**

```sql
-- Rodar no SQL Editor do Supabase (projeto gobhrarraopgalhrrizm).

create table if not exists public.transactions (
  id                       uuid        primary key default gen_random_uuid(),
  identifier               text        not null unique,
  poseidon_transaction_id  text,
  amount                   numeric     not null,
  donor_name               text        not null,
  donor_email              text        not null,
  donor_phone              text,
  message                  text,
  is_anonymous             boolean     not null default false,
  status                   text        not null default 'PENDING',
  pix_code                 text,
  created_at               timestamptz not null default now(),
  paid_at                  timestamptz
);

create table if not exists public.mural_messages (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  amount     numeric     not null,
  message    text        not null,
  created_at timestamptz not null default now()
);

-- RLS ligada; sem policies. O backend usa service_role (BYPASSRLS).
alter table public.transactions   enable row level security;
alter table public.mural_messages enable row level security;
```

- [ ] **Step 2: Rodar o schema no Supabase (manual)**

Abrir o SQL Editor do projeto Supabase, colar o conteúdo de `supabase/schema.sql` e executar. Confirmar que as duas tabelas aparecem em Table Editor. (Passo manual — não há teste automatizado para isto.)

- [ ] **Step 3: Instalar o client Supabase**

Run:
```bash
npm install @supabase/supabase-js
```
Expected: adiciona `@supabase/supabase-js@2.x` em `dependencies`.

- [ ] **Step 4: Criar `server/lib/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export interface TransactionInput {
  identifier: string;
  amount: number;
  donorName: string;
  donorEmail: string;
  donorPhone: string | null;
  message: string | null;
  isAnonymous: boolean;
  pixCode: string | null;
}

export interface TransactionRow {
  id: string;
  identifier: string;
  poseidon_transaction_id: string | null;
  amount: number;
  donor_name: string;
  donor_email: string;
  donor_phone: string | null;
  message: string | null;
  is_anonymous: boolean;
  status: string;
  pix_code: string | null;
  created_at: string;
  paid_at: string | null;
}

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** numeric do Postgres volta como string — coagir para number. */
function normalizeRow(row: any): TransactionRow {
  return { ...row, amount: Number(row.amount) };
}

export async function createTransaction(input: TransactionInput): Promise<TransactionRow> {
  const { data, error } = await db()
    .from('transactions')
    .insert({
      identifier: input.identifier,
      amount: input.amount,
      donor_name: input.donorName,
      donor_email: input.donorEmail,
      donor_phone: input.donorPhone,
      message: input.message,
      is_anonymous: input.isAnonymous,
      pix_code: input.pixCode,
      status: 'PENDING',
    })
    .select()
    .single();
  if (error) throw new Error(`createTransaction: ${error.message}`);
  return normalizeRow(data);
}

export async function getTransactionByIdentifier(identifier: string): Promise<TransactionRow | null> {
  const { data, error } = await db()
    .from('transactions')
    .select('*')
    .eq('identifier', identifier)
    .maybeSingle();
  if (error) throw new Error(`getTransactionByIdentifier: ${error.message}`);
  return data ? normalizeRow(data) : null;
}

export async function markTransactionPaid(
  identifier: string,
  poseidonTransactionId: string | null,
): Promise<TransactionRow> {
  const { data, error } = await db()
    .from('transactions')
    .update({
      status: 'OK',
      paid_at: new Date().toISOString(),
      poseidon_transaction_id: poseidonTransactionId,
    })
    .eq('identifier', identifier)
    .select()
    .single();
  if (error) throw new Error(`markTransactionPaid: ${error.message}`);
  return normalizeRow(data);
}

export async function insertMuralMessage(m: {
  name: string;
  amount: number;
  message: string;
}): Promise<void> {
  const { error } = await db().from('mural_messages').insert(m);
  if (error) throw new Error(`insertMuralMessage: ${error.message}`);
}
```

- [ ] **Step 5: Verificar compilação**

Run:
```bash
npm run lint
```
Expected: sem erros de TypeScript em `server/lib/supabase.ts`.

- [ ] **Step 6: Commit (se aplicável)**

```bash
git add server/lib/supabase.ts supabase/schema.sql package.json package-lock.json
git commit -m "feat: schema Supabase e helpers de transacao/mural"
```

---

## Task 4: Wrapper da PoseidonPay (com teste)

Módulo que monta o body correto, chama a API e normaliza a resposta. Testado com `fetch` mockado.

**Files:**
- Create: `server/lib/poseidon.ts`
- Test: `server/lib/poseidon.test.ts`

**Interfaces:**
- Consumes: `env`, `requirePoseidon` de `server/lib/env.ts`.
- Produces:
  - `type CreatePixInput = { identifier, amount, name, email, phone, document, callbackUrl }`
  - `type CreatePixResult = { transactionId: string | null; status: string; pixCode: string; qrImage: string | null; fee: number | null }`
  - `buildPixBody(input: CreatePixInput): object` (exportada para teste)
  - `createPixCharge(input: CreatePixInput): Promise<CreatePixResult>`

- [ ] **Step 1: Escrever os testes que falham**

Criar `server/lib/poseidon.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPixBody, createPixCharge } from './poseidon';

const input = {
  identifier: 'abc123',
  amount: 100.5,
  name: 'João da Silva',
  email: 'joao@gmail.com',
  phone: '(11) 99999-9999',
  document: '00000000000',
  callbackUrl: 'https://x.com/webhooks/poseidonpay/secret',
};

describe('buildPixBody', () => {
  it('monta o body com client e callbackUrl corretos', () => {
    const body = buildPixBody(input) as any;
    expect(body.identifier).toBe('abc123');
    expect(body.amount).toBe(100.5);
    expect(body.client).toEqual({
      name: 'João da Silva',
      email: 'joao@gmail.com',
      phone: '(11) 99999-9999',
      document: '00000000000',
    });
    expect(body.callbackUrl).toBe(input.callbackUrl);
  });
});

describe('createPixCharge', () => {
  beforeEach(() => {
    process.env.POSEIDON_PUBLIC_KEY = 'pub';
    process.env.POSEIDON_SECRET_KEY = 'sec';
  });
  afterEach(() => vi.restoreAllMocks());

  it('parseia uma resposta 201 e retorna pixCode + qrImage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        transactionId: 'tx_1',
        status: 'OK',
        fee: 2.5,
        pix: { code: 'PIXCODE123', image: 'https://qr/img.png', base64: '' },
      }),
    }));
    const r = await createPixCharge(input);
    expect(r.pixCode).toBe('PIXCODE123');
    expect(r.qrImage).toBe('https://qr/img.png');
    expect(r.transactionId).toBe('tx_1');
    expect(r.status).toBe('OK');
    expect(r.fee).toBe(2.5);
  });

  it('lança erro amigável quando a API responde 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        statusCode: 400,
        errorCode: 'INVALID_INPUT',
        message: "O valor fornecido para o campo 'amount' é inválido.",
        details: { field: 'amount', value: -20, issue: 'deve ser positivo' },
      }),
    }));
    await expect(createPixCharge(input)).rejects.toThrow(/amount/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run:
```bash
npm test -- poseidon
```
Expected: FAIL — `buildPixBody`/`createPixCharge` não existem.

- [ ] **Step 3: Implementar `server/lib/poseidon.ts`**

```ts
import { env, requirePoseidon } from './env';

export interface CreatePixInput {
  identifier: string;
  amount: number;
  name: string;
  email: string;
  phone: string;
  document: string;
  callbackUrl: string;
}

export interface CreatePixResult {
  transactionId: string | null;
  status: string;
  pixCode: string;
  qrImage: string | null;
  fee: number | null;
}

export function buildPixBody(input: CreatePixInput): object {
  return {
    identifier: input.identifier,
    amount: input.amount,
    client: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      document: input.document,
    },
    callbackUrl: input.callbackUrl,
  };
}

export async function createPixCharge(input: CreatePixInput): Promise<CreatePixResult> {
  requirePoseidon();
  const res = await fetch(`${env.poseidonBaseUrl}/gateway/pix/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-public-key': env.poseidonPublicKey,
      'x-secret-key': env.poseidonSecretKey,
    },
    body: JSON.stringify(buildPixBody(input)),
  });

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || `PoseidonPay retornou status ${res.status}`;
    throw new Error(msg);
  }

  return {
    transactionId: data?.transactionId ?? null,
    status: data?.status ?? 'PENDING',
    pixCode: data?.pix?.code ?? '',
    qrImage: data?.pix?.image ?? null,
    fee: typeof data?.fee === 'number' ? data.fee : null,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test -- poseidon
```
Expected: PASS (3 testes).

- [ ] **Step 5: Commit (se aplicável)**

```bash
git add server/lib/poseidon.ts server/lib/poseidon.test.ts
git commit -m "feat: wrapper da API PoseidonPay com testes"
```

---

## Task 5: Módulo de e-mail (Resend) com fallback

Envia o e-mail de confirmação. Sem `RESEND_API_KEY`, loga e retorna (não quebra).

**Files:**
- Create: `server/lib/email.ts`
- Modify: `package.json` (dependency `resend`)

**Interfaces:**
- Consumes: `env`.
- Produces: `sendConfirmationEmail(input: { to: string; name: string; amount: number; identifier: string }): Promise<void>`

- [ ] **Step 1: Instalar Resend**

Run:
```bash
npm install resend
```
Expected: adiciona `resend@6.x` em `dependencies`.

- [ ] **Step 2: Criar `server/lib/email.ts`**

```ts
import { Resend } from 'resend';
import { env } from './env';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!resend) resend = new Resend(env.resendApiKey);
  return resend;
}

export async function sendConfirmationEmail(input: {
  to: string;
  name: string;
  amount: number;
  identifier: string;
}): Promise<void> {
  const client = getResend();
  if (!client) {
    console.log(`[email] RESEND_API_KEY ausente — enviaria confirmação para ${input.to} (R$ ${input.amount})`);
    return;
  }

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1c1917;">
      <h2 style="color: #c2410c;">Recebemos sua doação 💛</h2>
      <p>Olá, <strong>${input.name}</strong>!</p>
      <p>Confirmamos o recebimento da sua doação de <strong>R$ ${input.amount.toFixed(2)}</strong> ao projeto Zuzu for Africa.</p>
      <p>Seu apoio ajuda a levar alimentação, saúde e educação a crianças em Angola. Muito obrigado por fazer parte disso.</p>
      <p style="color: #78716c; font-size: 13px;">Referência: ${input.identifier}</p>
    </div>
  `;

  const { error } = await client.emails.send({
    from: env.emailFrom,
    to: input.to,
    subject: 'Recebemos sua doação — Zuzu for Africa 💛',
    html,
  });

  if (error) {
    console.error(`[email] falha ao enviar para ${input.to}: ${error.message}`);
  }
}
```

- [ ] **Step 3: Verificar compilação**

Run:
```bash
npm run lint
```
Expected: sem erros de TypeScript em `server/lib/email.ts`.

- [ ] **Step 4: Commit (se aplicável)**

```bash
git add server/lib/email.ts package.json package-lock.json
git commit -m "feat: envio de e-mail de confirmacao via Resend com fallback"
```

---

## Task 6: Envio de eventos ao CAPI (completar `facebook-capi.ts`) com teste

Adiciona ao módulo (que já tem `hashEmail`) a função que monta e envia o evento ao Graph API.

**Files:**
- Modify: `server/lib/facebook-capi.ts`
- Modify: `server/lib/facebook-capi.test.ts`

**Interfaces:**
- Consumes: `env`.
- Produces:
  - `buildCapiPayload(input: SendCapiInput): object` (exportada p/ teste)
  - `sendCapiEvent(input: SendCapiInput): Promise<void>` (fallback silencioso sem token)
  - `type SendCapiInput = { eventName: 'InitiateCheckout' | 'Purchase'; email: string; value: number; eventId: string; eventSourceUrl: string }`

- [ ] **Step 1: Adicionar os testes que falham**

Adicionar ao final de `server/lib/facebook-capi.test.ts`:
```ts
import { buildCapiPayload, sendCapiEvent } from './facebook-capi';

describe('buildCapiPayload', () => {
  it('monta o payload com em hasheado em array e event_time em segundos', () => {
    const payload = buildCapiPayload({
      eventName: 'Purchase',
      email: 'joao@gmail.com',
      value: 100.5,
      eventId: 'evt_abc',
      eventSourceUrl: 'https://site.com/',
    }) as any;
    const ev = payload.data[0];
    expect(ev.event_name).toBe('Purchase');
    expect(ev.action_source).toBe('website');
    expect(ev.event_id).toBe('evt_abc');
    expect(ev.user_data.em).toEqual([hashEmail('joao@gmail.com')]);
    expect(ev.custom_data).toEqual({ currency: 'BRL', value: 100.5 });
    expect(Number.isInteger(ev.event_time)).toBe(true);
    expect(String(ev.event_time).length).toBeLessThanOrEqual(11); // segundos, não ms
  });
});

describe('sendCapiEvent', () => {
  it('não chama fetch quando o token não está configurado', async () => {
    process.env.FB_CAPI_ACCESS_TOKEN = '';
    process.env.FB_PIXEL_ID = '';
    const spy = vi.stubGlobal('fetch', vi.fn());
    await sendCapiEvent({
      eventName: 'InitiateCheckout', email: 'a@b.com', value: 10,
      eventId: 'e1', eventSourceUrl: 'https://s.com/',
    });
    expect((globalThis.fetch as any)).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
```

> Nota: o `import { hashEmail }` já existe no topo do arquivo de teste (Task 1). Adicionar só os novos imports (`buildCapiPayload`, `sendCapiEvent`).

- [ ] **Step 2: Rodar e confirmar falha**

Run:
```bash
npm test -- facebook-capi
```
Expected: FAIL — `buildCapiPayload`/`sendCapiEvent` não existem.

- [ ] **Step 3: Adicionar a implementação a `server/lib/facebook-capi.ts`**

Adicionar abaixo do `hashEmail` existente:
```ts
import { env } from './env';

const GRAPH_VERSION = 'v25.0';

export interface SendCapiInput {
  eventName: 'InitiateCheckout' | 'Purchase';
  email: string;
  value: number;
  eventId: string;
  eventSourceUrl: string;
}

export function buildCapiPayload(input: SendCapiInput): object {
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: { em: [hashEmail(input.email)] },
        custom_data: { currency: 'BRL', value: input.value },
      },
    ],
  };
  if (env.fbTestEventCode) payload.test_event_code = env.fbTestEventCode;
  return payload;
}

export async function sendCapiEvent(input: SendCapiInput): Promise<void> {
  if (!env.fbPixelId || !env.fbCapiAccessToken) {
    console.log(`[capi] Pixel/token ausente — pularia evento ${input.eventName} (${input.eventId})`);
    return;
  }
  try {
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${env.fbPixelId}/events` +
      `?access_token=${encodeURIComponent(env.fbCapiAccessToken)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCapiPayload(input)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[capi] evento ${input.eventName} falhou (${res.status}): ${body}`);
    }
  } catch (err: any) {
    console.error(`[capi] erro de rede no evento ${input.eventName}: ${err?.message}`);
  }
}
```

> ⚠️ Nota de import: `import { env }` deve ir junto aos imports no TOPO do arquivo (mover para o topo, não no meio). O `import { createHash }` já está lá da Task 1.

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test -- facebook-capi
```
Expected: PASS (5 testes: 3 do hashEmail + 2 novos).

- [ ] **Step 5: Commit (se aplicável)**

```bash
git add server/lib/facebook-capi.ts server/lib/facebook-capi.test.ts
git commit -m "feat: envio de eventos ao Facebook CAPI com fallback"
```

---

## Task 7: Extrair `server/app.ts` (refactor) mantendo comportamento

Move a criação/configuração do Express para `server/app.ts` (importável sem `listen()`), deixando `server.ts` só com o bootstrap. Isto habilita os testes de rota da Task 8.

**Files:**
- Create: `server/app.ts`
- Modify: `server.ts`

**Interfaces:**
- Produces: `createApp(): Promise<express.Express>` — retorna o app configurado (com as rotas atuais de `/api/donations` e `/api/generate-message` + o middleware Vite/estático).

- [ ] **Step 1: Criar `server/app.ts`**

Mover para cá TODO o conteúdo de `server.ts` EXCETO o `app.listen(...)` e a chamada final `startServer()`. Envolver na função `createApp`. O arquivo fica assim (conteúdo idêntico ao atual `server.ts`, reorganizado):
```ts
import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

interface Donation {
  id: string;
  name: string;
  amount: number;
  message: string;
  timestamp: string;
}

const recentDonations: Donation[] = [];

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
    }
  }
  return aiClient;
}

export async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());

  app.get('/api/donations', (req, res) => {
    res.json({
      success: true,
      donations: recentDonations,
      totals: { yearSince: 2019, mealsPerDay: 800, childrenAssisted: 1300, country: 'Angola' },
    });
  });

  app.post('/api/donations', (req, res) => {
    const { name, amount, message } = req.body;
    if (!name || !amount) {
      return res.status(400).json({ success: false, error: 'Name and amount are required.' });
    }
    const newDonation: Donation = {
      id: Math.random().toString(36).substring(2, 11),
      name: String(name).trim() || 'Doador Anônimo',
      amount: Number(amount),
      message: String(message || '').trim() || 'Apoio ao Zuzu for Africa!',
      timestamp: new Date().toISOString(),
    };
    recentDonations.unshift(newDonation);
    if (recentDonations.length > 30) recentDonations.pop();
    res.json({ success: true, donation: newDonation });
  });

  app.post('/api/generate-message', async (req, res) => {
    const { topic, senderName } = req.body;
    const keywords = topic || 'esperança, água limpa, amor e futuro';
    const sender = senderName || 'Um apoiador';
    try {
      const ai = getAiClient();
      if (!ai) {
        const fallbacks = [
          `Que cada sorriso dessas crianças em Angola seja um reflexo do amor e do carinho que enviamos daqui. Juntos, somos a força que transforma o amanhã!`,
          `Que a esperança alcance cada família atendida. Cada vida tocada por este projeto é uma vitória do amor e da solidariedade.`,
          `Para os voluntários e crianças do Zuzu for Africa: vocês nos ensinam o verdadeiro significado de empatia. Todo o meu apoio e carinho a essa jornada linda!`,
        ];
        return res.json({
          success: true,
          message: fallbacks[Math.floor(Math.random() * fallbacks.length)],
          isFallback: true,
        });
      }
      const prompt = `Gere uma mensagem curta (máximo 250 caracteres), altamente inspiradora, calorosa e emocionante em português, para ser exibida no quadro de apoio do projeto Zuzu for Africa. 
A mensagem deve ser enviada por "${sender}" e ser focada nos seguintes temas/palavras-chave: "${keywords}".
O tom deve ser profundamente humano, lembrando o trabalho da ONG em Angola: alimentação (mais de 800 refeições por dia), atendimento médico e odontológico, e o resgate da infância de crianças em situação de vulnerabilidade.
Evite clichês robóticos ou hashtags desnecessárias. Retorne apenas o texto da mensagem, sem aspas ou introduções.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: { temperature: 0.85, maxOutputTokens: 150 },
      });
      res.json({ success: true, message: response.text?.trim() || '', isFallback: false });
    } catch (error: any) {
      console.error('Error generating AI message:', error);
      res.status(500).json({
        success: false,
        error: 'Não foi possível gerar a mensagem via IA. Mas seu apoio continua sendo imensamente valioso!',
      });
    }
  });

  // Vite / estáticos
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app;
}
```

- [ ] **Step 2: Reduzir `server.ts` ao bootstrap**

Substituir todo o conteúdo de `server.ts` por:
```ts
import dotenv from 'dotenv';
import { createApp } from './server/app';

dotenv.config();

const PORT = 3000;

async function main() {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
```

> Nota: `dotenv.config()` continua em `server.ts` (executado antes de `createApp`). Como `server/lib/env.ts` lê `process.env` no momento do import, garantir que `dotenv.config()` rode antes. Nas Tasks 8+, as rotas serão adicionadas dentro de `createApp` (ver Task 8, que injeta `pixRoutes`).

- [ ] **Step 3: Rodar o servidor e confirmar que ainda sobe**

Run:
```bash
npm run dev
```
Expected: `Server running on http://localhost:3000` e o site abre normalmente (mesmo comportamento de antes). Encerrar com Ctrl+C.

- [ ] **Step 4: Verificar lint**

Run:
```bash
npm run lint
```
Expected: sem erros novos.

- [ ] **Step 5: Commit (se aplicável)**

```bash
git add server/app.ts server.ts
git commit -m "refactor: extrair createApp para permitir testes de rota"
```

---

## Task 8: Rotas Pix (`create`, `status`, `webhook`) com testes

O coração da integração. Orquestra Supabase + PoseidonPay + CAPI + e-mail.

**Files:**
- Create: `server/routes/pix.ts`
- Test: `server/routes/pix.test.ts`
- Modify: `server/app.ts` (montar as rotas)

**Interfaces:**
- Consumes: todos os helpers de `supabase.ts`, `poseidon.ts`, `facebook-capi.ts`, `email.ts`, `env.ts`.
- Produces: `registerPixRoutes(app: express.Express): void` — registra:
  - `POST /api/pix/create` → `{ transactionId, pixCode, qrImage, eventId }`
  - `GET /api/donations/:identifier/status` → `{ status }`
  - `POST /api/webhooks/poseidonpay/:secret` → `{ received: true }`

- [ ] **Step 1: Escrever os testes que falham**

Criar `server/routes/pix.test.ts`. Mocka todos os módulos de I/O e chama os handlers via `express` + `supertest`-like usando `fetch` no app? Para simplicidade (recomendado), testar os handlers via `registerPixRoutes` num app real e chamadas diretas. Usaremos mock de módulos + chamada direta ao handler exportado. Para permitir isso, `pix.ts` também exporta os handlers individualmente.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mocks de todos os módulos de I/O
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  createTransaction: vi.fn(async (i: any) => ({
    id: 'row1', identifier: i.identifier, amount: i.amount, donor_name: i.donorName,
    donor_email: i.donorEmail, is_anonymous: i.isAnonymous, message: i.message,
    status: 'PENDING', pix_code: i.pixCode, poseidon_transaction_id: null,
    donor_phone: i.donorPhone, created_at: 'now', paid_at: null,
  })),
  getTransactionByIdentifier: vi.fn(),
  markTransactionPaid: vi.fn(async (id: string) => ({
    id: 'row1', identifier: id, amount: 100, donor_name: 'João', donor_email: 'j@x.com',
    is_anonymous: false, message: 'oi', status: 'OK', pix_code: 'p', poseidon_transaction_id: 'tx',
    donor_phone: null, created_at: 'now', paid_at: 'now',
  })),
  insertMuralMessage: vi.fn(async () => {}),
}));
vi.mock('../lib/poseidon', () => ({
  createPixCharge: vi.fn(async () => ({
    transactionId: 'tx_1', status: 'PENDING', pixCode: 'PIXCODE', qrImage: 'https://qr', fee: 1,
  })),
}));
vi.mock('../lib/facebook-capi', () => ({ sendCapiEvent: vi.fn(async () => {}) }));
vi.mock('../lib/email', () => ({ sendConfirmationEmail: vi.fn(async () => {}) }));

import { createPixHandler, statusHandler, webhookHandler } from './pix';
import * as supa from '../lib/supabase';
import * as capi from '../lib/facebook-capi';
import * as email from '../lib/email';

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WEBHOOK_SECRET = 'sekret';
  process.env.POSEIDON_PUBLIC_KEY = 'pub';
  process.env.POSEIDON_SECRET_KEY = 'sec';
});

describe('createPixHandler', () => {
  it('cria transação, chama PoseidonPay, dispara InitiateCheckout e devolve pixCode', async () => {
    const req = { body: { amount: 100, name: 'João', email: 'j@x.com', isAnonymous: false, message: 'oi' } } as Request;
    const res = mockRes();
    await createPixHandler(req, res);
    expect(supa.createTransaction).toHaveBeenCalled();
    expect(capi.sendCapiEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'InitiateCheckout' }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pixCode: 'PIXCODE', qrImage: 'https://qr' }));
  });

  it('rejeita quando falta email', async () => {
    const req = { body: { amount: 100, name: 'João' } } as Request;
    const res = mockRes();
    await createPixHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('webhookHandler', () => {
  it('rejeita segredo inválido com 401', async () => {
    const req = { params: { secret: 'errado' }, body: {} } as unknown as Request;
    const res = mockRes();
    await webhookHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('marca pago, dispara Purchase, envia email e insere no mural quando status OK', async () => {
    (supa.getTransactionByIdentifier as any).mockResolvedValue({
      identifier: 'id1', amount: 100, donor_name: 'João', donor_email: 'j@x.com',
      is_anonymous: false, message: 'oi', status: 'PENDING',
    });
    const req = { params: { secret: 'sekret' }, body: { identifier: 'id1', status: 'OK', transactionId: 'tx' } } as unknown as Request;
    const res = mockRes();
    await webhookHandler(req, res);
    expect(supa.markTransactionPaid).toHaveBeenCalledWith('id1', 'tx');
    expect(capi.sendCapiEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'Purchase' }));
    expect(email.sendConfirmationEmail).toHaveBeenCalled();
    expect(supa.insertMuralMessage).toHaveBeenCalledWith(expect.objectContaining({ name: 'João' }));
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('é idempotente: não reprocessa transação já OK', async () => {
    (supa.getTransactionByIdentifier as any).mockResolvedValue({
      identifier: 'id1', amount: 100, donor_name: 'João', donor_email: 'j@x.com',
      is_anonymous: false, message: 'oi', status: 'OK',
    });
    const req = { params: { secret: 'sekret' }, body: { identifier: 'id1', status: 'OK' } } as unknown as Request;
    const res = mockRes();
    await webhookHandler(req, res);
    expect(supa.markTransactionPaid).not.toHaveBeenCalled();
    expect(capi.sendCapiEvent).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('usa "Doador Anônimo" no mural quando is_anonymous', async () => {
    (supa.getTransactionByIdentifier as any).mockResolvedValue({
      identifier: 'id1', amount: 100, donor_name: 'João', donor_email: 'j@x.com',
      is_anonymous: true, message: 'oi', status: 'PENDING',
    });
    const req = { params: { secret: 'sekret' }, body: { identifier: 'id1', status: 'OK' } } as unknown as Request;
    const res = mockRes();
    await webhookHandler(req, res);
    expect(supa.insertMuralMessage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Doador Anônimo' }));
  });
});

describe('statusHandler', () => {
  it('retorna o status da transação', async () => {
    (supa.getTransactionByIdentifier as any).mockResolvedValue({ identifier: 'id1', status: 'OK' });
    const req = { params: { identifier: 'id1' } } as unknown as Request;
    const res = mockRes();
    await statusHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ status: 'OK' });
  });

  it('retorna NOT_FOUND quando não existe', async () => {
    (supa.getTransactionByIdentifier as any).mockResolvedValue(null);
    const req = { params: { identifier: 'nope' } } as unknown as Request;
    const res = mockRes();
    await statusHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ status: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run:
```bash
npm test -- pix.test
```
Expected: FAIL — `./pix` não exporta os handlers.

- [ ] **Step 3: Implementar `server/routes/pix.ts`**

```ts
import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { env } from '../lib/env';
import {
  isSupabaseConfigured,
  createTransaction,
  getTransactionByIdentifier,
  markTransactionPaid,
  insertMuralMessage,
} from '../lib/supabase';
import { createPixCharge } from '../lib/poseidon';
import { sendCapiEvent } from '../lib/facebook-capi';
import { sendConfirmationEmail } from '../lib/email';

// Placeholder para campos obrigatórios da PoseidonPay que não coletamos no form (A2 do spec).
const PLACEHOLDER_PHONE = '(00) 00000-0000';
const PLACEHOLDER_DOCUMENT = '00000000000';

export async function createPixHandler(req: Request, res: Response): Promise<void> {
  try {
    const { amount, name, email: donorEmail, isAnonymous, message, phone } = req.body ?? {};

    if (!name || !donorEmail || !amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Nome, e-mail e um valor válido são obrigatórios.' });
      return;
    }
    if (!isSupabaseConfigured()) {
      res.status(503).json({ error: 'Serviço de doação indisponível no momento.' });
      return;
    }

    const identifier = randomUUID().replace(/-/g, '').slice(0, 20);
    const eventId = `evt_${identifier}`;
    const numericAmount = Number(amount);
    const callbackUrl = `${env.publicBaseUrl}/api/webhooks/poseidonpay/${env.webhookSecret}`;

    const pix = await createPixCharge({
      identifier,
      amount: numericAmount,
      name: String(name),
      email: String(donorEmail),
      phone: phone ? String(phone) : PLACEHOLDER_PHONE,
      document: PLACEHOLDER_DOCUMENT,
      callbackUrl,
    });

    await createTransaction({
      identifier,
      amount: numericAmount,
      donorName: String(name),
      donorEmail: String(donorEmail),
      donorPhone: phone ? String(phone) : null,
      message: message ? String(message) : null,
      isAnonymous: Boolean(isAnonymous),
      pixCode: pix.pixCode,
    });

    // Funil: InitiateCheckout na geração do Pix (dedup com o Pixel do browser via mesmo eventId).
    await sendCapiEvent({
      eventName: 'InitiateCheckout',
      email: String(donorEmail),
      value: numericAmount,
      eventId,
      eventSourceUrl: env.publicBaseUrl,
    });

    res.json({ transactionId: identifier, pixCode: pix.pixCode, qrImage: pix.qrImage, eventId });
  } catch (err: any) {
    console.error('[pix/create] erro:', err?.message);
    res.status(500).json({ error: 'Não foi possível gerar o Pix. Tente novamente.' });
  }
}

export async function statusHandler(req: Request, res: Response): Promise<void> {
  try {
    const { identifier } = req.params;
    const tx = await getTransactionByIdentifier(identifier);
    res.json({ status: tx ? tx.status : 'NOT_FOUND' });
  } catch (err: any) {
    console.error('[pix/status] erro:', err?.message);
    res.status(500).json({ status: 'ERROR' });
  }
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  // Segurança: segredo na URL valida a origem.
  if (req.params.secret !== env.webhookSecret || !env.webhookSecret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const { identifier, status, transactionId } = req.body ?? {};
    if (!identifier) {
      res.json({ received: true }); // nada a fazer, mas não quebra o retry
      return;
    }

    const tx = await getTransactionByIdentifier(identifier);
    // Idempotência: já processado ou inexistente → só confirma o recebimento.
    if (!tx || tx.status === 'OK') {
      res.json({ received: true });
      return;
    }

    // Só processa como pago quando o status confirmado é OK.
    if (status === 'OK') {
      await markTransactionPaid(identifier, transactionId ?? null);

      await sendCapiEvent({
        eventName: 'Purchase',
        email: tx.donor_email,
        value: tx.amount,
        eventId: `evt_${identifier}`,
        eventSourceUrl: env.publicBaseUrl,
      });

      await sendConfirmationEmail({
        to: tx.donor_email,
        name: tx.donor_name,
        amount: tx.amount,
        identifier,
      });

      await insertMuralMessage({
        name: tx.is_anonymous ? 'Doador Anônimo' : tx.donor_name,
        amount: tx.amount,
        message: tx.message || 'Apoio ao Zuzu for Africa!',
      });
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[pix/webhook] erro:', err?.message);
    // Responder 200 mesmo em erro interno para não travar retries; log serve de alerta.
    res.json({ received: true });
  }
}

export function registerPixRoutes(app: Express): void {
  app.post('/api/pix/create', createPixHandler);
  app.get('/api/donations/:identifier/status', statusHandler);
  app.post('/api/webhooks/poseidonpay/:secret', webhookHandler);
}
```

- [ ] **Step 4: Montar as rotas em `server/app.ts`**

Em `server/app.ts`, adicionar o import no topo:
```ts
import { registerPixRoutes } from './routes/pix';
```
E dentro de `createApp`, logo após `app.use(express.json());`, adicionar:
```ts
  registerPixRoutes(app);
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
npm test -- pix.test
```
Expected: PASS (todos os testes de create/status/webhook, incluindo idempotência e anônimo).

- [ ] **Step 6: Rodar a suíte inteira**

Run:
```bash
npm test
```
Expected: PASS em tudo (facebook-capi, poseidon, pix).

- [ ] **Step 7: Verificar lint**

Run:
```bash
npm run lint
```
Expected: sem erros.

- [ ] **Step 8: Commit (se aplicável)**

```bash
git add server/routes/pix.ts server/routes/pix.test.ts server/app.ts
git commit -m "feat: rotas Pix create/status/webhook com CAPI, email e mural"
```

---

## Task 9: Pixel do Facebook no browser (`index.html` + `src/lib/fbpixel.ts`)

Base do Pixel no HTML + helper para disparar `InitiateCheckout` com o mesmo `eventID` do servidor (dedup).

**Files:**
- Modify: `index.html`
- Create: `src/lib/fbpixel.ts`

**Interfaces:**
- Produces:
  - `initFbPixel(): void` — inicializa `fbq` com `VITE_FB_PIXEL_ID` se presente.
  - `trackInitiateCheckout(eventId: string, value: number): void` — dispara `fbq('track', 'InitiateCheckout', {...}, { eventID })`.

- [ ] **Step 1: Adicionar o snippet base do Pixel ao `index.html`**

Dentro de `<head>`, antes de `</head>`, adicionar o loader padrão do Pixel (sem o PixelID hardcoded — a inicialização acontece no `initFbPixel` com a env var):
```html
    <!-- Meta Pixel base loader (init acontece em src/lib/fbpixel.ts com VITE_FB_PIXEL_ID) -->
    <script>
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    </script>
```

- [ ] **Step 2: Criar `src/lib/fbpixel.ts`**

```ts
// Helper do Meta Pixel no browser. O eventID compartilhado com o servidor
// permite deduplicação entre o Pixel e a Conversions API (CAPI).
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID as string | undefined;

export function initFbPixel(): void {
  if (!PIXEL_ID || !window.fbq) return;
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

export function trackInitiateCheckout(eventId: string, value: number): void {
  if (!PIXEL_ID || !window.fbq) return;
  window.fbq('track', 'InitiateCheckout', { value, currency: 'BRL' }, { eventID: eventId });
}
```

- [ ] **Step 3: Inicializar o Pixel no boot do app**

Em `src/main.tsx`, adicionar após os imports e antes do `createRoot`/render:
```ts
import { initFbPixel } from './lib/fbpixel';
initFbPixel();
```
(Localizar o ponto de montagem no `src/main.tsx` — ler o arquivo primeiro; inserir `initFbPixel()` uma vez, no topo da execução.)

- [ ] **Step 4: Verificar compilação**

Run:
```bash
npm run lint
```
Expected: sem erros de TypeScript (`import.meta.env` é reconhecido pelo Vite).

- [ ] **Step 5: Commit (se aplicável)**

```bash
git add index.html src/lib/fbpixel.ts src/main.tsx
git commit -m "feat: Meta Pixel no browser com dedup por eventID"
```

---

## Task 10: `DonationWidget` — gerar Pix + QR Code + polling

Transforma o Step 2 (botão "GERAR PIX" + checkbox anônimo) e reescreve o Step 3 (QR Code + copia-e-cola + polling de status).

**Files:**
- Modify: `src/components/DonationWidget.tsx`

**Interfaces:**
- Consumes: `POST /api/pix/create`, `GET /api/donations/:id/status`, `trackInitiateCheckout` de `src/lib/fbpixel.ts`.
- Produces: (comportamento de UI; sem interface exportada nova além das props atuais)

- [ ] **Step 1: Ler o arquivo atual**

Reler `src/components/DonationWidget.tsx` inteiro para preservar estilos/estrutura (Tailwind + motion). As mudanças são cirúrgicas nos steps 2 e 3.

- [ ] **Step 2: Ajustar imports e estado**

No topo, adicionar aos imports do `lucide-react`: `QrCode, Copy, RefreshCw` (mantendo os existentes). Adicionar o import do pixel:
```ts
import { trackInitiateCheckout } from '../lib/fbpixel';
```
Adicionar estado (junto aos `useState` existentes):
```ts
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pixData, setPixData] = useState<{ transactionId: string; pixCode: string; qrImage: string | null } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'OK' | 'ERROR'>('PENDING');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
```

- [ ] **Step 3: Substituir `handleInfoSubmit` pela geração real de Pix**

Trocar o corpo do `handleInfoSubmit` por:
```ts
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const resp = await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, name, email, phone, message, isAnonymous }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data?.error || 'Não foi possível gerar o Pix. Tente novamente.');
        setIsSubmitting(false);
        return;
      }
      setPixData({ transactionId: data.transactionId, pixCode: data.pixCode, qrImage: data.qrImage });
      // Dedup com o servidor: mesmo eventID do CAPI InitiateCheckout.
      if (data.eventId) trackInitiateCheckout(data.eventId, amount);
      onDonationComplete(isAnonymous ? 'Doador Anônimo' : name, amount, message);
      setPaymentStatus('PENDING');
      setStep(3);
    } catch {
      setErrorMsg('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 4: Adicionar polling de status via `useEffect`**

Adicionar este `useEffect` junto aos hooks (após o `useEffect` existente):
```ts
  useEffect(() => {
    if (step !== 3 || !pixData || paymentStatus === 'OK') return;
    let attempts = 0;
    const maxAttempts = 225; // ~15 min a cada 4s
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }
      try {
        const r = await fetch(`/api/donations/${pixData.transactionId}/status`);
        const d = await r.json();
        if (d.status === 'OK') {
          setPaymentStatus('OK');
          clearInterval(interval);
        }
      } catch {
        /* ignora erros transitórios de polling */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [step, pixData, paymentStatus]);
```

- [ ] **Step 5: Adicionar o checkbox "Doar anonimamente" no Step 2**

No formulário do Step 2, logo após o campo de Nome Completo, adicionar:
```tsx
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500/30"
                />
                Doar anonimamente (seu nome não aparece no mural público)
              </label>
```

- [ ] **Step 6: Atualizar o aviso e o botão do Step 2**

Substituir o bloco de aviso amarelo ("A cobrança ainda não está ativa...") por:
```tsx
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex gap-2 items-start">
                <QrCode size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Ao continuar, geramos um <strong>Pix seguro</strong> para você concluir a doação no app do seu banco. Pedimos seu e-mail para enviar a confirmação.
                </p>
              </div>
```
Trocar o texto do botão de submit de `ENTRAR NA LISTA DE APOIO` para `GERAR PIX` e o estado de loading de `Registrando...` para `Gerando Pix...`. Se `errorMsg`, exibir abaixo do botão:
```tsx
              {errorMsg && <p className="text-xs text-red-600 text-center">{errorMsg}</p>}
```

- [ ] **Step 7: Reescrever o Step 3 (QR Code + copia-e-cola + status)**

Substituir todo o bloco `{step === 3 && (...)}` por:
```tsx
          {step === 3 && pixData && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-5 py-2"
            >
              {paymentStatus === 'OK' ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-4 border-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-xl font-bold text-stone-900">Pagamento recebido! 💛</h4>
                    <p className="text-stone-500 text-sm">
                      Obrigado, <strong className="text-stone-800">{isAnonymous ? 'apoiador(a)' : name}</strong>. Enviamos a confirmação para <strong>{email}</strong>.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <h4 className="font-display text-lg font-bold text-stone-900">Escaneie para doar R$ {amount}</h4>
                    <p className="text-stone-500 text-xs">Abra o app do seu banco, escaneie o QR Code ou use o Pix copia e cola.</p>
                  </div>

                  {pixData.qrImage ? (
                    <img
                      src={pixData.qrImage}
                      alt="QR Code do Pix"
                      className="w-48 h-48 mx-auto rounded-2xl border border-stone-200 bg-white p-2"
                    />
                  ) : (
                    <div className="w-48 h-48 mx-auto rounded-2xl border border-dashed border-stone-300 flex items-center justify-center text-stone-400">
                      <QrCode size={48} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left">
                      <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">Pix copia e cola</p>
                      <p className="text-[11px] text-stone-600 break-all font-mono leading-tight max-h-16 overflow-y-auto">
                        {pixData.pixCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.pixCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {copied ? <><Check size={16} /> Código copiado!</> : <><Copy size={16} /> Copiar código Pix</>}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
                    <RefreshCw size={12} className="animate-spin" />
                    Aguardando confirmação do pagamento...
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setAmount(50);
                  setName('');
                  setEmail('');
                  setPhone('');
                  setMessage('');
                  setIsAnonymous(false);
                  setPixData(null);
                  setPaymentStatus('PENDING');
                }}
                className="w-full py-3 rounded-xl border border-stone-200 text-stone-500 font-bold text-sm hover:bg-stone-50 transition-all cursor-pointer"
              >
                {paymentStatus === 'OK' ? 'FAZER NOVA DOAÇÃO' : 'CANCELAR'}
              </button>
            </motion.div>
          )}
```

- [ ] **Step 8: Atualizar o selo do header e textos "Pagamento em breve"**

No header do widget, trocar `<Clock size={14} /> Pagamento em breve` por `<QrCode size={14} /> Pix seguro`. Trocar o texto introdutório do Step 1 de "Escolha um valor de referência... quando o pagamento estiver disponível" para "Escolha quanto você quer doar agora via Pix:".

- [ ] **Step 9: Rodar o app e testar o fluxo visual**

Run:
```bash
npm run dev
```
Abrir `http://localhost:3000`, abrir o widget de doação, escolher valor → continuar → preencher nome/e-mail → GERAR PIX. Sem chaves da PoseidonPay configuradas, esperar o erro amigável ("Não foi possível gerar o Pix") — isso confirma que o fluxo de erro funciona. Com as chaves configuradas, o QR deve aparecer. Encerrar com Ctrl+C.

- [ ] **Step 10: Verificar lint**

Run:
```bash
npm run lint
```
Expected: sem erros.

- [ ] **Step 11: Commit (se aplicável)**

```bash
git add src/components/DonationWidget.tsx
git commit -m "feat: DonationWidget gera Pix real com QR Code e polling de status"
```

---

## Task 11: Atualizar textos do site (`App.tsx`, FAQ, `metadata.json`)

Remove as afirmações "pagamento em breve" / "Stripe" que agora contradizem o Pix ativo.

**Files:**
- Modify: `src/App.tsx`
- Modify: `metadata.json`

**Interfaces:** (sem interfaces novas)

- [ ] **Step 1: Localizar as menções a atualizar**

Run:
```bash
grep -rn -i -E "stripe|pagamento em breve|cobrança.*não est|lista de apoi|em breve" src/App.tsx
```
Expected: lista de linhas com os textos a corrigir (FAQ "Como será feito o pagamento?", "Como sei que este é o canal oficial?", "Vou receber comprovante?", e possíveis selos/CTAs).

- [ ] **Step 2: Reescrever a FAQ "Como será feito o pagamento?"**

Substituir a resposta atual por:
```
'O pagamento é feito por Pix, de forma rápida e segura. Ao escolher o valor e informar seus dados, geramos um QR Code (e um código Pix copia e cola) para você concluir a doação direto no app do seu banco. Assim que o pagamento é confirmado, você recebe um e-mail de confirmação. Este site não solicita dados de cartão.'
```

- [ ] **Step 3: Reescrever a FAQ "Como sei que este é o canal oficial?"**

Ajustar para remover a recomendação de "desconfie de páginas que peçam cartão" ficar coerente com Pix (mantendo o espírito de transparência):
```
'Este site é uma página de apoio ao projeto. A ONG mantém canais oficiais próprios (site, redes sociais e conta com CNPJ registrado). O pagamento aqui é feito exclusivamente via Pix — nunca pedimos dados de cartão. Antes de doar, confira sempre se o destino corresponde aos canais oficiais divulgados pela própria Zuzu for Africa.'
```

- [ ] **Step 4: Reescrever a FAQ sobre comprovante**

Se houver a FAQ "Vou receber comprovante ou prestação de contas?", ajustar a primeira frase para: `'Sim. Assim que seu Pix é confirmado, enviamos um e-mail de confirmação da sua doação.'` (mantendo o restante sobre prestação de contas da ONG).

- [ ] **Step 5: Atualizar quaisquer selos/CTAs no `App.tsx`**

Procurar por textos de UI como "Pagamento em breve", "entrar na lista", "seja avisado quando liberar" fora do widget (ex.: hero, banners) e trocar por linguagem de Pix ativo (ex.: "Doe agora via Pix"). Usar o `grep` do Step 1 como guia; ajustar cada ocorrência mantendo o tom.

- [ ] **Step 6: Atualizar `metadata.json`**

Trocar a `description` para refletir Pix ativo:
```json
"description": "Plataforma de alta conversão para doações via Pix ao projeto Zuzu for Africa, com QR Code instantâneo, simulador de impacto em tempo real e gerador de mensagens de esperança via Inteligência Artificial."
```

- [ ] **Step 7: Rodar o app e revisar visualmente**

Run:
```bash
npm run dev
```
Percorrer a página inteira (hero, FAQ, CTAs) e confirmar que **não sobrou nenhuma** menção a "pagamento em breve" ou "Stripe". Encerrar com Ctrl+C.

- [ ] **Step 8: Confirmar que não restou nenhuma menção**

Run:
```bash
grep -rn -i -E "stripe|pagamento em breve|cobrança.*não est" src/ metadata.json
```
Expected: **nenhum** resultado.

- [ ] **Step 9: Commit (se aplicável)**

```bash
git add src/App.tsx metadata.json
git commit -m "content: atualizar textos do site para Pix ativo (remover Stripe/em breve)"
```

---

## Task 12: Verificação final ponta-a-ponta

Fecha o ciclo: suíte de testes, lint, build, e um teste manual real de Pix (opcional, requer chaves + URL pública).

**Files:** (nenhuma alteração de código; passos de verificação)

- [ ] **Step 1: Rodar a suíte completa**

Run:
```bash
npm test
```
Expected: PASS em todos os testes (facebook-capi, poseidon, pix).

- [ ] **Step 2: Lint**

Run:
```bash
npm run lint
```
Expected: sem erros.

- [ ] **Step 3: Build de produção**

Run:
```bash
npm run build
```
Expected: `vite build` gera `dist/` e `esbuild` gera `dist/server.cjs` sem erros.

- [ ] **Step 4: Teste manual real (opcional — requer configuração)**

Pré-requisitos: `.env` com `POSEIDON_PUBLIC_KEY`, `POSEIDON_SECRET_KEY`, `SUPABASE_*`, `WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (URL pública acessível — ex. via ngrok: `ngrok http 3000`, e setar `PUBLIC_BASE_URL` para a URL https do ngrok). Opcional: `FB_*`, `RESEND_*`.

Procedimento:
1. `npm run dev`.
2. Gerar um Pix de valor baixo (ex. R$ 1,00) pelo widget.
3. Confirmar que o QR Code aparece e a transação surge na tabela `transactions` do Supabase (status PENDING).
4. Pagar o Pix no app do banco.
5. Confirmar: a tela muda para "Pagamento recebido! 💛" (polling); a transação vira `OK` com `paid_at`; uma linha aparece em `mural_messages`; o e-mail chega (se Resend configurado + domínio verificado, ou o e-mail da própria conta Resend); e o evento `Purchase` aparece no Facebook Events Manager (com `FB_TEST_EVENT_CODE` em Test Events).

- [ ] **Step 5: Invocar a skill de verificação**

Antes de declarar concluído, usar `superpowers:verification-before-completion` para confirmar com evidências (saída dos comandos) que testes/lint/build passam.

- [ ] **Step 6: Commit final (se aplicável)**

```bash
git add -A
git commit -m "chore: verificacao final da integracao Pix"
```

---

## Notas finais de segurança e operação

- ⚠️ **Rotacionar as credenciais do Supabase** (service_role, secret, senha do banco) que foram expostas no chat, antes de produção.
- As chaves da PoseidonPay e do Facebook/Resend devem ser preenchidas no `.env` (nunca commitadas).
- Para o webhook funcionar em produção, `PUBLIC_BASE_URL` deve ser a URL pública real do site (Cloud Run, etc.), e `WEBHOOK_SECRET` deve ser um valor longo e aleatório.
- Sem chaves configuradas, o sistema degrada graciosamente: CAPI e e-mail viram no-ops logados; apenas a criação de Pix exige as chaves da PoseidonPay (retorna erro amigável na ausência).
