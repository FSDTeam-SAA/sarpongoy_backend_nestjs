import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSubscribeDto {
  @ApiPropertyOptional({ example: 'Premium' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({ example: ['feature1', 'feature2'] })
  @IsArray()
  @IsOptional()
  features: string[];

  @ApiPropertyOptional({ example: 12 })
  @IsNumber()
  @IsNotEmpty()
  months: number;

  @ApiPropertyOptional({ example: 'active' })
  @IsString()
  @IsOptional()
  status: string;
}
