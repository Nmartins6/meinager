import { IsOptional, IsUUID } from 'class-validator';

export class CreateOrderFromQuoteDto {
  @IsUUID('4')
  quoteId!: string;

  @IsOptional()
  @IsUUID('4')
  workflowId?: string;
}