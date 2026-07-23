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
