import { Transform, Type } from 'class-transformer';
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
  carrousel: 'CAROUSEL',
  pdf: 'PDF',
  video: 'YOUTUBE',
  liste: 'LIST',
  lien: 'LINK',
  citation: 'QUOTE',
} as const;

class PdfBlockDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsIn(['integrated', 'link'])
  presentation?: 'integrated' | 'link';

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  display?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  download?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @MaxLength(4000)
  description?: string;
}

class VisualPdfOptionsDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  viewPdf?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  downloadPdf?: boolean;
}

export class BlockImageDto extends VisualPdfOptionsDto {
  @IsUUID()
  mediaId: string;

  @IsString()
  @MaxLength(1000)
  alt: string;

  @ValidateIf((_image, value) => value !== undefined)
  @IsBoolean()
  decorative?: boolean;

  @ValidateIf((_block, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  caption?: string;
}

export class BlockDto extends VisualPdfOptionsDto {
  @IsIn([...Object.keys(blockTypes), 'randonnee', 'localisation'])
  type: keyof typeof blockTypes | 'randonnee' | 'localisation';

  @ValidateIf((_block, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => PdfBlockDto)
  pdf?: PdfBlockDto;

  @ValidateIf((block, value) => block.type === 'carrousel' || value !== undefined)
  @IsArray()
  @ArrayMaxSize(24)
  @ArrayUnique((slide: BlockImageDto) => slide?.mediaId)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => BlockImageDto)
  slides?: BlockImageDto[];

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

  @ValidateIf((_block, value) => value !== undefined)
  @IsBoolean()
  decorative?: boolean;

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

class CategoryVisualDto {
  @ValidateIf((_visual, value) => value !== undefined)
  @IsIn([
    'activity', 'baby', 'bike', 'book-open', 'calendar-days', 'camera', 'chef-hat',
    'circle-dot', 'clapperboard', 'compass', 'dices', 'drama', 'dumbbell', 'footprints',
    'hand-heart', 'heart', 'landmark', 'leaf', 'map-pin', 'mountain', 'music', 'palette',
    'party-popper', 'person-standing', 'plane', 'spade', 'tree-pine', 'trophy', 'users', 'utensils',
  ])
  icon?: string;

  @ValidateIf((_visual, value) => value !== undefined)
  @IsUUID()
  mediaId?: string;
}

export class ClassificationDto extends NamedDto {
  @ValidateIf((_dto, value) => value != null)
  @IsObject()
  @ValidateNested()
  @Type(() => CategoryVisualDto)
  visual?: CategoryVisualDto | null;
}

export class MediaDto extends NamedDto {
  @IsString()
  @MaxLength(1000)
  alt: string;

  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @ValidateIf((_media, value) => value !== undefined)
  @IsBoolean()
  decorative?: boolean;
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
  @IsIn(['IMAGE', 'GPX', 'PDF', 'VISUAL'])
  type?: 'IMAGE' | 'GPX' | 'PDF' | 'VISUAL';

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
