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
