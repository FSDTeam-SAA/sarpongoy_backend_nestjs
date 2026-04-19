import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../user/user-role.enum';
import { Type } from 'class-transformer';

export class CreateAuthDto {
  @ApiPropertyOptional({ example: '69189747004459816445708b' })
  @IsMongoId()
  @IsOptional()
  schoolName: string;

  @ApiPropertyOptional({ example: 'saurav' })
  @IsString()
  @IsOptional()
  firstName: string;

  @ApiPropertyOptional({ example: 'sarkar' })
  @IsString()
  @IsOptional()
  lastName: string;

  @ApiPropertyOptional({ example: 'Bangladesh' })
  @IsString()
  @IsOptional()
  country: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiPropertyOptional({ example: 'school@gmail.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.SCHOOL })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: '017XXXXXXXX' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Dhaka, Bangladesh' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  @IsString()
  schoolLogo?: string;

  @ApiPropertyOptional({ example: 'This is school bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  @IsString()
  uploadeSignature?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalStudent?: number;
}

export class LoginAuthDto {
  @ApiProperty({ example: 'saurav@example.com' })
  @IsEmail({}, { message: 'Valid email is required' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'saurav@example.com' })
  @IsEmail({}, { message: 'Valid email is required' })
  @IsNotEmpty()
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'saurav@example.com' })
  @IsEmail({}, { message: 'Valid email is required' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'saurav@example.com' })
  @IsEmail({}, { message: 'Valid email is required' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'newsecret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldsecret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  oldPassword: string;

  @ApiProperty({ example: 'newsecret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;
}
