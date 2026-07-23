import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export interface TransactionInput {
  identifier: string;
  amount: number;
  donorName: string;
  donorEmail: string;
  donorPhone: string | null;
  message: string | null;
  isAnonymous: boolean;
  pixCode: string | null;
}

export interface TransactionRow {
  id: string;
  identifier: string;
  poseidon_transaction_id: string | null;
  amount: number;
  donor_name: string;
  donor_email: string;
  donor_phone: string | null;
  message: string | null;
  is_anonymous: boolean;
  status: string;
  pix_code: string | null;
  created_at: string;
  paid_at: string | null;
}

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** numeric do Postgres volta como string — coagir para number. */
function normalizeRow(row: any): TransactionRow {
  return { ...row, amount: Number(row.amount) };
}

export async function createTransaction(input: TransactionInput): Promise<TransactionRow> {
  const { data, error } = await db()
    .from('transactions')
    .insert({
      identifier: input.identifier,
      amount: input.amount,
      donor_name: input.donorName,
      donor_email: input.donorEmail,
      donor_phone: input.donorPhone,
      message: input.message,
      is_anonymous: input.isAnonymous,
      pix_code: input.pixCode,
      status: 'PENDING',
    })
    .select()
    .single();
  if (error) throw new Error(`createTransaction: ${error.message}`);
  return normalizeRow(data);
}

export async function getTransactionByIdentifier(identifier: string): Promise<TransactionRow | null> {
  const { data, error } = await db()
    .from('transactions')
    .select('*')
    .eq('identifier', identifier)
    .maybeSingle();
  if (error) throw new Error(`getTransactionByIdentifier: ${error.message}`);
  return data ? normalizeRow(data) : null;
}

export async function markTransactionPaid(
  identifier: string,
  poseidonTransactionId: string | null,
): Promise<TransactionRow> {
  const { data, error } = await db()
    .from('transactions')
    .update({
      status: 'OK',
      paid_at: new Date().toISOString(),
      poseidon_transaction_id: poseidonTransactionId,
    })
    .eq('identifier', identifier)
    .select()
    .single();
  if (error) throw new Error(`markTransactionPaid: ${error.message}`);
  return normalizeRow(data);
}

export async function insertMuralMessage(m: {
  name: string;
  amount: number;
  message: string;
}): Promise<void> {
  const { error } = await db().from('mural_messages').insert(m);
  if (error) throw new Error(`insertMuralMessage: ${error.message}`);
}
