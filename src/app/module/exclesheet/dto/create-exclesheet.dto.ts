import { IsNotEmpty, IsOptional, IsString, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExclesheetDto {
  @ApiPropertyOptional({ example: 'ABC School' })
  @IsNotEmpty()
  @IsString()
  schoolName: string;

  @ApiPropertyOptional({ example: 'Sarkar' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'Saurav' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional({ example: 'STD12345' })
  @IsNotEmpty()
  @IsString()
  studentId: string;

  @ApiProperty({ example: 'Grade 10' })
  @IsNotEmpty()
  @IsString()
  gradeLevel: string;

  @ApiPropertyOptional({ example: 'https://example.com/file.xlsx' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: '665f1c2b9c1234567890abcd' })
  @IsOptional()
  @IsMongoId()
  schoolId?: string;
}