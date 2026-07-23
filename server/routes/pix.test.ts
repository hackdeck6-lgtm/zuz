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
