import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSchoolDto {
  @ApiPropertyOptional({ example: 'School Name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
