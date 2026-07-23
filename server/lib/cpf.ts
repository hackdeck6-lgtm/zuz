/**
 * Utilitários de CPF. A PoseidonPay valida o CPF de verdade (rejeita 00000000000),
 * então precisamos validar o CPF informado pelo doador OU gerar um sintaticamente válido.
 */

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** Calcula um dígito verificador de CPF a partir dos dígitos base. */
function checkDigit(digits: number[]): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (digits.length + 1 - i);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Valida um CPF (formato e dígitos verificadores). Rejeita sequências repetidas. */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  // Rejeita CPFs com todos os dígitos iguais (00000000000, 11111111111, ...).
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const nums = cpf.split('').map(Number);
  const d1 = checkDigit(nums.slice(0, 9));
  const d2 = checkDigit(nums.slice(0, 9).concat(d1));
  return d1 === nums[9] && d2 === nums[10];
}

/**
 * Gera um CPF sintaticamente válido (dígitos verificadores corretos).
 * Usado como fallback quando o doador não informa o CPF.
 * NÃO corresponde a uma pessoa real — apenas satisfaz a validação de formato.
 */
export function generateValidCPF(): string {
  const base: number[] = [];
  for (let i = 0; i < 9; i++) base.push(Math.floor(Math.random() * 10));
  // Evita a sequência degenerada de todos iguais.
  if (base.every((d) => d === base[0])) base[0] = (base[0] + 1) % 10;
  const d1 = checkDigit(base);
  const d2 = checkDigit(base.concat(d1));
  return base.concat(d1, d2).join('');
}

/**
 * Resolve o CPF a enviar à PoseidonPay: usa o informado (se válido) ou gera um válido.
 * Retorna sempre 11 dígitos sem formatação.
 */
export function resolveCPF(informed?: string | null): string {
  if (informed) {
    const cleaned = onlyDigits(informed);
    if (isValidCPF(cleaned)) return cleaned;
  }
  return generateValidCPF();
}
