import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSchoolDto {
  @ApiPropertyOptional({ example: 'School Name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  subscribePrice?: number;

  @ApiPropertyOptional({ example: 500 })
  @Type(() => Number)
  @IsInt()
  totalStudent?: number;

  @ApiPropertyOptional({
    example:
      '[{"termId":"term_1","label":"Term 1","amount":12000,"dueDate":"2026-09-01"}]',
  })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({
    example: 'School contract file',
    type: 'string',
    format: 'binary',
  })
  @IsString()
  NDA?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  firstTermDueDate?: string;

  @ApiPropertyOptional({ example: '2027-01-15' })
  @IsOptional()
  @IsString()
  secondTermDueDate?: string;

  @ApiPropertyOptional({ example: '2027-04-15' })
  @IsOptional()
  @IsString()
  thirdTermDueDate?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  fullPaymentDueDate?: string;
}
