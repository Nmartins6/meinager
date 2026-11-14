import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateClientDto } from './create-client.dto.js';
import { UpdateClientDto } from './update-client.dto.js';

describe.each([CreateClientDto, UpdateClientDto])(
  '%s contact validation',
  (ContactDto) => {
    const Dto: new () => CreateClientDto | UpdateClientDto = ContactDto;
    it.each(['abc', '---', 'abc12345678901'])(
      'rejects invalid contact %s instead of silently clearing it',
      async (value) => {
        const dto = plainToInstance(Dto, {
          name: 'Cliente fictício',
          document: value,
          phone: value,
        });
        expect((await validate(dto)).map((error) => error.property)).toEqual(
          expect.arrayContaining(['document', 'phone']),
        );
      },
    );
    it('keeps formatted contacts and permits explicitly empty optional fields', async () => {
      const formatted = plainToInstance(Dto, {
        name: 'Cliente fictício',
        document: '123.456.789-01',
        phone: '+55 (11) 99999-9999',
      });
      expect(await validate(formatted)).toEqual([]);
      expect(formatted.document).toBe('12345678901');
      expect(formatted.phone).toBe('5511999999999');
      expect(
        await validate(
          plainToInstance(Dto, {
            name: 'Cliente fictício',
            document: ' ',
            phone: '',
          }),
        ),
      ).toEqual([]);
    });
  },
);
