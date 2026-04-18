import { Transform } from 'class-transformer';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

const emptyStringToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @Transform(emptyStringToUndefined)
  firstName?: string;

  @Transform(emptyStringToUndefined)
  lastName?: string;

  @Transform(emptyStringToUndefined)
  email?: string;

  @Transform(emptyStringToUndefined)
  password?: string;

  @Transform(emptyStringToUndefined)
  role?: string;

  @Transform(emptyStringToUndefined)
  gender?: string;

  @Transform(emptyStringToUndefined)
  phoneNumber?: string;

  @Transform(emptyStringToUndefined)
  bio?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile picture file upload',
  })
  @Transform(emptyStringToUndefined)
  profilePicture?: any;

  @Transform(emptyStringToUndefined)
  status?: string;

  @Transform(emptyStringToUndefined)
  dateOfBirth?: Date;

  @Transform(emptyStringToUndefined)
  schoolAddress?: string;

  @Transform(emptyStringToUndefined)
  relationship?: string;

  @Transform(emptyStringToUndefined)
  otp?: string;

  @Transform(({ value }) => {
    if (value === '') {
      return undefined;
    }

    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return value;
  })
  verifiedForget?: boolean;

  @Transform(emptyStringToUndefined)
  stripeAccountId?: string;
}
