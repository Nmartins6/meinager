export function formatBrl(value: string | null): string {
  if (value === null) {
    return 'Sem preço definido';
  }

  const [integer = '0', fraction = ''] = value.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${groupedInteger},${fraction.padEnd(2, '0')}`;
}

interface DecimalLimits {
  integerDigits: number;
  scale: number;
}

function normalizeDecimalText(value: string): string | null {
  const trimmed = value.trim();

  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
    return null;
  }

  const normalizedSeparator = trimmed.replace(',', '.');
  const [rawInteger, rawFraction = ''] = normalizedSeparator.split('.');
  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  const fraction = rawFraction.replace(/0+$/, '');

  return fraction ? `${integer}.${fraction}` : integer;
}

export function canonicalizeDecimalInput(value: string, limits: DecimalLimits): string | null {
  const normalized = normalizeDecimalText(value);

  if (normalized === null) {
    return null;
  }

  const [integer, fraction = ''] = normalized.split('.');

  if (integer.length > limits.integerDigits || fraction.length > limits.scale) {
    return null;
  }

  return normalized;
}

export function canonicalizeCommercialDecimalInput(value: string): string | null {
  return canonicalizeDecimalInput(value, { integerDigits: 12, scale: 2 });
}

function shiftDecimalPoint(value: string, places: number): string {
  const [integer, fraction = ''] = value.split('.');
  const digits = `${integer}${fraction}`;
  const decimalPosition = integer.length + places;
  let shifted: string;

  if (decimalPosition <= 0) {
    shifted = `0.${'0'.repeat(-decimalPosition)}${digits}`;
  } else if (decimalPosition >= digits.length) {
    shifted = `${digits}${'0'.repeat(decimalPosition - digits.length)}`;
  } else {
    shifted = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }

  return normalizeDecimalText(shifted) ?? '0';
}

export function canonicalizePercentageInput(value: string): string | null {
  const normalized = normalizeDecimalText(value);

  if (normalized === null) {
    return null;
  }

  const fraction = shiftDecimalPoint(normalized, -2);
  const [integer, decimal = ''] = fraction.split('.');

  if (integer.length > 4 || decimal.length > 8) {
    return null;
  }

  return fraction;
}

export function percentageFractionToInput(value: string | null): string {
  return value === null ? '' : shiftDecimalPoint(value, 2);
}
