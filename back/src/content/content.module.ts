import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AccessGuard,
  BrowserOriginGuard,
  CurrentUser,
  RoleGuard,
  Roles,
} from '../auth/access.guard.js';
import { ConfirmDto } from '../auth/auth.dto.js';
import { AuthModule } from '../auth/auth.module.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { ArticlesService } from './articles.service.js';
import {
  ArticleActionDto,
  ArticleDto,
  CarouselDto,
  MediaDto,
  NamedDto,
} from './content.dto.js';
import { contentLog, contentSlug, lockAdmin } from './content.shared.js';
import { MediaService } from './media.service.js';

function snapshot(
  prisma: PrismaService,
  articles: ArticlesService,
  media: MediaService,
  admin: boolean,
) {
  return prisma.$transaction(
    async (tx) => {
      const select = {
        id: true,
        name: true,
        slug: true,
        articles: { select: { version: { select: { articleId: true } } } },
      } as const;
      const items = await articles.list(admin, tx);
      const categories = await tx.category.findMany({
        select,
        orderBy: { name: 'asc' },
      });
      const tags = await tx.tag.findMany({ select, orderBy: { name: 'asc' } });
      const medias = await media.list(admin, tx);
      const classify = (item: (typeof categories)[number]) => ({
        id: item.id,
        nom: item.name,
        slug: item.slug,
        ...(admin
          ? {
              articleCount: new Set(
                item.articles.map((a) => a.version.articleId),
              ).size,
            }
          : {}),
      });
      return {
        articles: items,
        categories: categories.map(classify),
        tags: tags.map(classify),
        medias,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15000,
    },
  );
}

@Controller()
class PublicContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlesService,
    private readonly media: MediaService,
  ) {}

  @Get('content')
  content() {
    return snapshot(this.prisma, this.articles, this.media, false);
  }

  @Get('media/:id')
  async image(@Param('id', ParseUUIDPipe) id: string) {
    const file = await this.media.file(id, false);
    return new StreamableFile(file.data, { type: file.mime });
  }
}

type Classification = 'categories' | 'tags';
function classification(kind: string): Classification {
  if (kind !== 'categories' && kind !== 'tags') throw new BadRequestException();
  return kind;
}

const uploadOptions = {
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 2 },
};

@Controller('admin/content')
@UseGuards(AccessGuard, BrowserOriginGuard, RoleGuard)
@Roles('ADMIN')
class AdminContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlesService,
    private readonly media: MediaService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  content() {
    return snapshot(this.prisma, this.articles, this.media, true);
  }

  @Patch('carousel')
  @HttpCode(204)
  carousel(@CurrentUser() actor: Principal, @Body() dto: CarouselDto) {
    return this.articles.updateCarousel(actor, dto.articleIds);
  }

  @Post('articles')
  create(@CurrentUser() actor: Principal, @Body() dto: ArticleDto) {
    return this.articles.create(actor, dto);
  }

  @Patch('articles/:id')
  update(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArticleDto,
  ) {
    return this.articles.update(actor, id, dto);
  }

  @Post('articles/:id/actions')
  @HttpCode(200)
  action(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArticleActionDto,
  ) {
    return this.articles.action(actor, id, dto);
  }

  @Post('classification/:kind')
  createClassification(
    @CurrentUser() actor: Principal,
    @Param('kind') kind: string,
    @Body() dto: NamedDto,
  ) {
    return this.classify(actor, classification(kind), dto.nom);
  }

  @Patch('classification/:kind/:id')
  updateClassification(
    @CurrentUser() actor: Principal,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NamedDto,
  ) {
    return this.classify(actor, classification(kind), dto.nom, id);
  }

  @Delete('classification/:kind/:id')
  @HttpCode(204)
  removeClassification(
    @CurrentUser() actor: Principal,
    @Param('kind') value: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmDto,
  ) {
    const kind = classification(value);
    if (!dto.confirmed) throw new ConflictException();
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      if (kind === 'categories') await tx.category.delete({ where: { id } });
      else await tx.tag.delete({ where: { id } });
      await contentLog(
        tx,
        actor.userId,
        kind === 'categories' ? 'CATEGORY' : 'TAG',
        id,
        'DELETE',
        'Classement supprimé.',
      );
    });
  }

  @Get('media/:id/file')
  async image(@Param('id', ParseUUIDPipe) id: string) {
    const file = await this.media.file(id, true);
    return new StreamableFile(file.data, { type: file.mime });
  }

  @Post('media')
  @HttpCode(204)
  @UseInterceptors(FileInterceptor('image', uploadOptions))
  upload(
    @CurrentUser() actor: Principal,
    @UploadedFile() file: { buffer: Buffer },
    @Body() dto: MediaDto,
  ) {
    return this.media.write(actor, file?.buffer, dto);
  }

  @Patch('media/:id')
  @HttpCode(204)
  metadata(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaDto,
  ) {
    return this.media.update(actor, id, dto);
  }

  @Post('media/:id/replace')
  @HttpCode(204)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { ...uploadOptions.limits, fields: 0 },
    }),
  )
  replace(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.media.write(actor, file?.buffer, undefined, id);
  }

  @Delete('media/:id')
  @HttpCode(204)
  delete(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.media.delete(actor, id);
  }

  private classify(
    actor: Principal,
    kind: Classification,
    label: string,
    id?: string,
  ) {
    const name = label.trim();
    if (!name) throw new BadRequestException();
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      const slug = contentSlug(name);
      const item =
        kind === 'categories'
          ? id
            ? await tx.category.update({ where: { id }, data: { name } })
            : await tx.category.create({ data: { name, slug } })
          : id
            ? await tx.tag.update({ where: { id }, data: { name } })
            : await tx.tag.create({ data: { name, slug } });
      await contentLog(
        tx,
        actor.userId,
        kind === 'categories' ? 'CATEGORY' : 'TAG',
        item.id,
        id ? 'UPDATE' : 'CREATE',
        'Classement enregistré.',
      );
      return { id: item.id, nom: item.name, slug: item.slug };
    });
  }
}

@Module({
  imports: [AuthModule],
  controllers: [PublicContentController, AdminContentController],
  providers: [ArticlesService, MediaService],
})
export class ContentModule {}
