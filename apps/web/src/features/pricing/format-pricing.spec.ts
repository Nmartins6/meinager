import { describe, expect, it } from 'vitest';

import { canonicalizeCommercialDecimalInput, formatBrl } from './format-pricing';

describe('canonicalizeCommercialDecimalInput', () => {
  it.each([
    ['31,50', '31.5'],
    [' 0,00 ', '0'],
    ['0001,50', '1.5'],
    ['000000000000.00', '0'],
    ['1.2300', '1.23'],
    ['1.000', '1'],
    ['999999999999.99', '999999999999.99'],
  ])('canonicalizes %s as %s without rounding', (input, expected) => {
    expect(canonicalizeCommercialDecimalInput(input)).toBe(expected);
  });

  it.each([
    '',
    '-1',
    '+1',
    '1e2',
    'NaN',
    'Infinity',
    '1,2.3',
    '1,2,3',
    '1.',
    '1000000000000',
    '1.234',
    '1.2301',
  ])('rejects %s', (input) => {
    expect(canonicalizeCommercialDecimalInput(input)).toBeNull();
  });
});

describe('formatBrl', () => {
  it('formats canonical decimal text for display without using it as a calculation source', () => {
    expect(formatBrl('31.5')).toBe('R$ 31,50');
    expect(formatBrl('0')).toBe('R$ 0,00');
  });
});
