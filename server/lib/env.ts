/**
 * Leitura centralizada das variáveis de ambiente. Strings vazias = não configurado.
 *
 * Usa getters para ler `process.env` a CADA acesso (leitura tardia), não uma
 * única vez no import. Isso garante que o valor correto seja lido após
 * `dotenv.config()` no runtime, e que testes que definem env vars em `beforeEach`
 * enxerguem os valores atualizados (imports ESM são içados antes dos hooks de teste).
 */
export const env = {
  get poseidonBaseUrl(): string {
    return process.env.POSEIDON_BASE_URL || 'https://app.poseidonpay.site/api/v1';
  },
  get poseidonPublicKey(): string {
    return process.env.POSEIDON_PUBLIC_KEY || '';
  },
  get poseidonSecretKey(): string {
    return process.env.POSEIDON_SECRET_KEY || '';
  },

  get supabaseUrl(): string {
    return process.env.SUPABASE_URL || '';
  },
  get supabaseServiceRoleKey(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  },

  get fbPixelId(): string {
    return process.env.FB_PIXEL_ID || '';
  },
  get fbCapiAccessToken(): string {
    return process.env.FB_CAPI_ACCESS_TOKEN || '';
  },
  get fbTestEventCode(): string {
    return process.env.FB_TEST_EVENT_CODE || '';
  },

  get resendApiKey(): string {
    return process.env.RESEND_API_KEY || '';
  },
  get emailFrom(): string {
    return process.env.EMAIL_FROM || 'Zuzu for Africa <onboarding@resend.dev>';
  },

  get webhookSecret(): string {
    return process.env.WEBHOOK_SECRET || '';
  },
  get publicBaseUrl(): string {
    return process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  },
};

/** Lança se as chaves da PoseidonPay não estiverem configuradas. */
export function requirePoseidon(): void {
  if (!env.poseidonPublicKey || !env.poseidonSecretKey) {
    throw new Error('PoseidonPay não configurada: defina POSEIDON_PUBLIC_KEY e POSEIDON_SECRET_KEY no .env');
  }
}
