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
