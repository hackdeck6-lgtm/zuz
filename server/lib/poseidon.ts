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
