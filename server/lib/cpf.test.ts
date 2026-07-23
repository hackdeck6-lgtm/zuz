import { describe, it, expect } from 'vitest';
import { isValidCPF, generateValidCPF, resolveCPF, onlyDigits } from './cpf';

describe('isValidCPF', () => {
  it('aceita um CPF com dígitos verificadores corretos', () => {
    // CPF válido conhecido (dígitos verificadores corretos).
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('52998224725')).toBe(true);
  });

  it('rejeita o placeholder de zeros e sequências repetidas', () => {
    expect(isValidCPF('00000000000')).toBe(false);
    expect(isValidCPF('11111111111')).toBe(false);
  });

  it('rejeita comprimento errado e dígitos verificadores inválidos', () => {
    expect(isValidCPF('123')).toBe(false);
    expect(isValidCPF('52998224724')).toBe(false); // último dígito errado
  });
});

describe('generateValidCPF', () => {
  it('gera um CPF que passa na própria validação', () => {
    for (let i = 0; i < 50; i++) {
      const cpf = generateValidCPF();
      expect(cpf).toMatch(/^\d{11}$/);
      expect(isValidCPF(cpf)).toBe(true);
    }
  });
});

describe('resolveCPF', () => {
  it('usa o CPF informado quando é válido (só dígitos)', () => {
    expect(resolveCPF('529.982.247-25')).toBe('52998224725');
  });

  it('gera um válido quando o informado é inválido ou vazio', () => {
    expect(isValidCPF(resolveCPF(''))).toBe(true);
    expect(isValidCPF(resolveCPF(null))).toBe(true);
    expect(isValidCPF(resolveCPF('123'))).toBe(true);
    expect(isValidCPF(resolveCPF('00000000000'))).toBe(true);
  });
});

describe('onlyDigits', () => {
  it('remove formatação', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
  });
});
