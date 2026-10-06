import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

import { PricingErrorCode } from '../errors/pricing-http.exception.js';

interface DecimalLimits {
  integerDigits: number;
  scale: number;
}

const SIMPLE_DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export function IsPricingDecimal(
  limits: DecimalLimits,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isPricingDecimal',
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [limits],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) {
            return true;
          }

          if (
            typeof value !== 'string' ||
            !SIMPLE_DECIMAL_PATTERN.test(value)
          ) {
            return false;
          }

          if (value.startsWith('-')) {
            return false;
          }

          const [integerPart, fractionPart = ''] = value.split('.');
          const significantInteger = integerPart!.replace(/^0+(?=\d)/, '');

          return (
            significantInteger.length <= limits.integerDigits &&
            fractionPart.length <= limits.scale
          );
        },
        defaultMessage(args: ValidationArguments): string {
          const value = args.value;
          const code =
            typeof value === 'string' &&
            SIMPLE_DECIMAL_PATTERN.test(value) &&
            value.startsWith('-')
              ? PricingErrorCode.NEGATIVE_VALUE
              : PricingErrorCode.INVALID_DECIMAL_VALUE;

          return `__PRICING__|${code}|${args.property}`;
        },
      },
    });
  };
}

export function IsPricingCurrency(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isPricingCurrency',
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return value === undefined || value === 'BRL';
        },
        defaultMessage(args: ValidationArguments): string {
          return `__PRICING__|${PricingErrorCode.UNSUPPORTED_CURRENCY}|${args.property}`;
        },
      },
    });
  };
}
