import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSchoolDto {
  @ApiPropertyOptional({ example: 'School Name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 100 })
  @IsInt()
  subscribePrice?: number;

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
