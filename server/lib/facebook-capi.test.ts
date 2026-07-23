import { describe, it, expect, vi } from 'vitest';
import { hashEmail, buildCapiPayload, sendCapiEvent } from './facebook-capi';

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
