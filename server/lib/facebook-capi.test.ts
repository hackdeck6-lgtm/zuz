import { describe, it, expect } from 'vitest';
import { hashEmail } from './facebook-capi';

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
