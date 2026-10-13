export function formatBrl(value: string | null): string {
  if (value === null) {
    return 'Sem preço definido';
  }

  const [integer = '0', fraction = ''] = value.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${groupedInteger},${fraction.padEnd(2, '0')}`;
}

export function canonicalizeCommercialDecimalInput(value: string): string | null {
  const trimmed = value.trim();

  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
    return null;
  }

  const normalizedSeparator = trimmed.replace(',', '.');
  const [rawInteger, rawFraction = ''] = normalizedSeparator.split('.');
  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  const fraction = rawFraction.replace(/0+$/, '');

  if (integer.length > 12 || fraction.length > 2) {
    return null;
  }

  return fraction ? `${integer}.${fraction}` : integer;
}
