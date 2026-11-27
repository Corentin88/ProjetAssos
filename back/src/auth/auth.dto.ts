import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsEnum,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  AvatarKind,
  PublicNameFormat,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client.js';
import { NewPasswordLength, PasswordMaxLength } from './password-validation.js';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class EmailDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class NamesDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  firstName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  lastName: string;
}

export class PublicNameDto {
  @IsEnum(PublicNameFormat)
  publicNameFormat: PublicNameFormat;
}

export class AdminProfileDto extends NamesDto {
  @ValidateIf((_input, value) => value !== undefined)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class LoginDto extends EmailDto {
  @IsString()
  @MinLength(1)
  @PasswordMaxLength()
  password: string;
}

export class InviteDto extends NamesDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class RegisterDto extends NamesDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @NewPasswordLength()
  password: string;
}

export class TokenDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token: string;
}

export class CompletePasswordDto extends TokenDto {
  @IsString()
  @NewPasswordLength()
  password: string;

  @IsString()
  @NewPasswordLength()
  passwordConfirmation: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @PasswordMaxLength()
  currentPassword: string;

  @IsString()
  @NewPasswordLength()
  password: string;

  @IsString()
  @NewPasswordLength()
  passwordConfirmation: string;
}

export class ConfirmDto {
  @Equals(true)
  confirmed: true;
}

export class ChangeRoleDto extends ConfirmDto {
  @IsEnum(UserRole)
  currentRole: UserRole;

  @IsEnum(UserRole)
  role: UserRole;
}

export class ChangeStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

export class AvatarDto {
  @IsEnum(AvatarKind)
  kind: AvatarKind;

  @ValidateIf(
    (dto) => dto.kind === AvatarKind.PRESET || dto.preset !== undefined,
  )
  @IsInt()
  @Min(0)
  @Max(5)
  preset?: number;
}
