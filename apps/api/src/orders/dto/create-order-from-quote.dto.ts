import { IsUUID } from 'class-validator';

export class CreateOrderFromQuoteDto {
  @IsUUID('4')
  quoteId!: string;
}
