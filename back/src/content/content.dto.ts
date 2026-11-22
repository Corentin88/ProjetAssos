import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const blockTypes = {
  titre: 'HEADING',
  'sous-titre': 'SUBHEADING',
  paragraphe: 'PARAGRAPH',
  image: 'IMAGE',
  video: 'YOUTUBE',
  liste: 'LIST',
  lien: 'LINK',
  citation: 'QUOTE',
} as const;

export class BlockDto {
  @IsIn(Object.keys(blockTypes))
  type: keyof typeof blockTypes;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(16000)
  text?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  mediaId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  alt?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(4000, { each: true })
  items?: string[];
}

export class ArticleDto {
  @IsString()
  @MaxLength(255)
  titre: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  blocks: BlockDto[];

  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  categorieIds: string[];

  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  tagIds: string[];

  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  coverMediaId: string | null;
}

export const articleActions = [
  'publish',
  'schedule',
  'cancel-schedule',
  'unpublish',
  'discard-work',
  'trash',
  'restore-draft',
  'restore-published',
  'delete',
] as const;

export class ArticleActionDto {
  @IsIn(articleActions)
  action: (typeof articleActions)[number];

  @ValidateIf(
    (body, value) => body.action === 'schedule' || value !== undefined,
  )
  @IsISO8601({ strict: true })
  at?: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsBoolean()
  confirmed?: boolean;
}

export class NamedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom: string;
}

export class MediaDto extends NamedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  alt: string;
}
