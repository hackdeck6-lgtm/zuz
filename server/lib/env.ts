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
