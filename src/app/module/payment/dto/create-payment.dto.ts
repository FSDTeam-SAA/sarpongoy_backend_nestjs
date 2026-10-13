import { IsBoolean, IsDefined, IsEmail, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePaymentDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsBoolean()
  forceNew?: boolean;
}

export class SchoolPaymentDto extends CreatePaymentDto {
  @IsOptional()
  @IsString()
  paymentPlan?: string;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsOptional()
  @IsObject()
  termDueDates?: { firstTerm?: string; secondTerm?: string; thirdTerm?: string };

  @IsOptional()
  @IsString()
  offlinePaymentNote?: string;
}

export class ConfirmSchoolPaymentDto {
  @IsDefined()
  @IsString()
  @Matches(/^pi_[A-Za-z0-9]+$/)
  paymentIntentId!: string;
}
