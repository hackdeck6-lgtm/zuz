import { createHash } from 'node:crypto';
import { env } from './env';

/** SHA-256 hex de email normalizado (trim + lowercase), conforme exigido pelo CAPI. */
export function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

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
