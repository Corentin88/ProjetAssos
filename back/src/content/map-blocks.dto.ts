import { IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class TrailVisibilityDto {
  @IsBoolean() distance: boolean;
  @IsBoolean() duration: boolean;
  @IsBoolean() dates: boolean;
  @IsBoolean() elevation: boolean;
  @IsBoolean() altitude: boolean;
  @IsBoolean() difficulty: boolean;
  @IsBoolean() description: boolean;
  @IsBoolean() map: boolean;
  @IsBoolean() download: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() departure?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() arrival?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() elevationGain?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() elevationLoss?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() elevationMin?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() elevationMax?: boolean;
}

export class TrailMapSettingsDto {
  @IsBoolean() slopes: boolean;
  @IsBoolean() profile: boolean;
  @IsIn(['classic', 'slopes']) initialMode: 'classic' | 'slopes';
}

export class TrailBlockFieldsDto {
  @IsString() @MaxLength(255) name: string;
  @IsString() @MaxLength(4000) description: string;
  @IsOptional() @IsNumber() @Min(0) distance?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) durationSeconds?: number | null;
  @IsOptional() @IsNumber() @Min(0) elevationGain?: number | null;
  @IsOptional() @IsNumber() @Min(0) elevationLoss?: number | null;
  @IsOptional() @IsNumber() elevationMin?: number | null;
  @IsOptional() @IsNumber() elevationMax?: number | null;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/(?:Z|[+-]\d\d:\d\d)$/i) departureAt?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/(?:Z|[+-]\d\d:\d\d)$/i) arrivalAt?: string | null;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | null;
}

export class LocationBlockDto {
  @IsString() @MaxLength(255) title: string;
  @IsString() @MaxLength(500) address: string;
  @IsString() @MaxLength(4000) description: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
}

export class AddressSearchDto {
  @IsString() @MaxLength(500) address: string;
}
