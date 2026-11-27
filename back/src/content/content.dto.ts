import { Type } from 'class-transformer';
import { PublicNameFormat } from '../../generated/prisma/client.js';
import { TrailDto } from './trails.js';
import { LocationBlockDto, TrailBlockFieldsDto, TrailMapSettingsDto, TrailVisibilityDto } from './map-blocks.dto.js';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ArrayMinSize,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CarouselDto {
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  articleIds: string[];
}

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
  @IsIn([...Object.keys(blockTypes), 'randonnee', 'localisation'])
  type: keyof typeof blockTypes | 'randonnee' | 'localisation';

  @ValidateIf((block, value) => block.type === 'randonnee' || value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => TrailBlockFieldsDto)
  trail?: TrailBlockFieldsDto;

  @ValidateIf((block, value) => block.type === 'randonnee' || value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => TrailVisibilityDto)
  visibility?: TrailVisibilityDto;

  @ValidateIf((_block, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => TrailMapSettingsDto)
  mapSettings?: TrailMapSettingsDto;

  @ValidateIf((block, value) => block.type === 'localisation' || value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => LocationBlockDto)
  location?: LocationBlockDto;

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
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(4000, { each: true })
  items?: string[];
}

export class ArticleDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsEnum(PublicNameFormat)
  authorNameFormat?: PublicNameFormat;

  @ValidateIf((_parent, value) => value != null)
  @IsObject()
  @ValidateNested()
  @Type(() => TrailDto)
  trail?: TrailDto | null;
  @IsString()
  @MaxLength(255)
  titre: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  blocks: BlockDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  categorieIds: string[];

  @IsArray()
  @ArrayMaxSize(100)
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
  @MaxLength(1000)
  alt: string;
}

export class MediaLibraryQuery {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsUUID()
  category?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsUUID()
  tag?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  q?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsIn(['IMAGE', 'GPX'])
  type?: 'IMAGE' | 'GPX';

  @ValidateIf((_dto, value) => value !== undefined && value !== 'unfiled')
  @IsUUID()
  folder?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsIn(['name', 'date', 'size'])
  sort?: 'name' | 'date' | 'size';

  @ValidateIf((_dto, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page?: number;
}

export class MediaClassificationDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  categorieIds: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  tagIds: string[];
}

export class MediaFolderDto extends NamedDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsUUID()
  parentId?: string;
}

export class MoveMediaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids: string[];

  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  folderId: string | null;
}
