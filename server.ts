import dotenv from 'dotenv';
import { createApp } from './server/app';

dotenv.config();

// Render (e a maioria dos hosts) injeta a porta via PORT.
const PORT = Number(process.env.PORT) || 3000;

/**
 * Self-ping anti-hibernação (Render free tier dorme após ~15 min de inatividade).
 * A cada 14 min, o próprio servidor bate em /api/health usando a URL pública.
 * Só roda em produção e apenas quando há uma URL pública real (não localhost).
 */
function startKeepAlive() {
  const publicUrl = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '';
  if (process.env.NODE_ENV !== 'production' || !publicUrl.startsWith('https://')) return;

  const url = `${publicUrl.replace(/\/$/, '')}/api/health`;
  const FOURTEEN_MIN = 14 * 60 * 1000;
  setInterval(async () => {
    try {
      await fetch(url);
    } catch (err: any) {
      console.error('[keep-alive] ping falhou:', err?.message);
    }
  }, FOURTEEN_MIN);
  console.log(`Keep-alive ativo: pingando ${url} a cada 14 min.`);
}

async function main() {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startKeepAlive();
  });
}

main();
