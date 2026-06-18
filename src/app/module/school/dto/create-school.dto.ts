import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateSchoolDto {
  @ApiPropertyOptional({ example: 'School Name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 100 })
  @IsInt()
  subscribePrice?: number;

  @ApiPropertyOptional({
    example: 'NDA Content',
    type: 'string',
    format: 'binary',
  })
  @IsString()
  NDA?: string;
}
