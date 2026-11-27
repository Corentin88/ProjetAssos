import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ModerationReason, Prisma } from '../../generated/prisma/client.js';
import {
  AccessGuard,
  BrowserOriginGuard,
  CurrentUser,
  RoleGuard,
  Roles,
} from '../auth/access.guard.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { contentLog } from '../content/content.shared.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { presentAvatar, profileFields } from '../profiles/profile-avatar.js';
import { formatPublicName } from '../profiles/public-name.js';

class CommentDto {
  @IsString()
  @MaxLength(5000)
  contenu: string;
}
class ReplyDto extends CommentDto {
  @ValidateIf((_parent, value) => value != null)
  @IsUUID()
  parentId?: string | null;
}
class ModerationDto {
  @IsEnum(ModerationReason)
  motif: ModerationReason;
  @ValidateIf((input, value) => input.motif === 'OTHER' || value !== undefined)
  @IsString()
  @MaxLength(1000)
  precision?: string;
}

const author = {
  select: { profile: { select: profileFields } },
} as const;
const common = {
  user: author,
  article: {
    select: {
      id: true,
      slug: true,
      status: true,
      versions: { select: { title: true, kind: true } },
    },
  },
} satisfies Prisma.CommentInclude;
const review = {
  ...common,
  edits: { orderBy: { editedAt: 'asc' } },
  moderation: { include: { user: author } },
} satisfies Prisma.CommentInclude;
type Entry = Prisma.CommentGetPayload<{ include: typeof common }>;
type AdminEntry = Prisma.CommentGetPayload<{ include: typeof review }>;
const motifs = {
  SPAM: 'Spam',
  INAPPROPRIATE: 'Insulte / comportement inapproprié',
  OFF_TOPIC: 'Contenu hors sujet',
  ILLEGAL: 'Contenu illégal',
  OTHER: 'Autre',
};
function nom(person: Entry['user'], prive: boolean) {
  const profile = person?.profile;
  if (!profile) return 'Utilisateur supprimé';
  return prive
    ? `${profile.firstName} ${profile.lastName}`
    : `${profile.firstName} ${Array.from(profile.lastName)[0] ?? ''}.`;
}

function present(comment: Entry, privateView = false, authenticated = true, viewerId?: string) {
  const visible = comment.status === 'PUBLISHED';
  const title =
    comment.article.versions.find((v) => v.kind === 'PUBLISHED')?.title ??
    (privateView
      ? comment.article.versions.find((v) => v.kind === 'WORKING')?.title
      : undefined);
  const publicArticle = comment.article.status === 'PUBLISHED';
  return {
    id: comment.id,
    articleId: comment.articleId,
    parentId: comment.parentId,
    auteurId: authenticated && (privateView || (visible && comment.publicNameFormat !== 'ADMIN')) ? comment.userId : null,
    ...(viewerId && viewerId === comment.userId ? { isOwn: true } : {}),
    auteurAvatar:
      visible &&
      (privateView || comment.publicNameFormat !== 'ADMIN') &&
      comment.userId &&
      comment.user?.profile &&
      (authenticated || comment.user.profile.avatarKind === 'PRESET')
        ? presentAvatar(comment.userId, comment.user.profile)
        : undefined,
    auteurLabel:
      visible || privateView
        ? privateView ? nom(comment.user, true) : formatPublicName(comment.user?.profile, comment.publicNameFormat ?? 'INITIAL')
        : 'Commentaire supprimé',
    contenu: visible ? (comment.content ?? '') : '',
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt > comment.createdAt ? comment.updatedAt : null,
    deletedByAuthor: comment.status === 'DELETED_BY_AUTHOR',
    deletedByAdmin: comment.status === 'DELETED_BY_ADMIN',
    articleTitre: publicArticle || privateView ? title : undefined,
    articleSlug: publicArticle ? comment.article.slug : undefined,
  };
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async article(articleId: string, viewerId?: string) {
    return (
      await this.prisma.comment.findMany({
        where: { articleId, article: { status: 'PUBLISHED' } },
        include: common,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    ).map((comment) => present(comment, false, Boolean(viewerId), viewerId));
  }

  async own(userId: string) {
    return (
      await this.prisma.comment.findMany({
        where: { userId, status: { not: 'DELETED_BY_AUTHOR' } },
        include: common,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map((comment) => present(comment, false, true, userId));
  }

  async profile(userId: string) {
    return (
      await this.prisma.comment.findMany({
        where: {
          userId,
          status: 'PUBLISHED',
          article: { status: 'PUBLISHED' },
          OR: [{ publicNameFormat: null }, { publicNameFormat: { not: 'ADMIN' } }],
        },
        include: common,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map((comment) => present(comment));
  }

  async admin() {
    const [cutoff] = await this.prisma.$queryRaw<
      { cutoff: Date }[]
    >`SELECT now() - INTERVAL '6 months' AS cutoff`;
    return (
      await this.prisma.comment.findMany({
        include: review,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map((comment: AdminEntry) => {
      const dossier =
        comment.moderation && comment.moderation.createdAt > cutoff.cutoff
          ? comment.moderation
          : null;
      const authorVisible =
        comment.status !== 'DELETED_BY_ADMIN' || Boolean(dossier);
      return {
        ...present(comment, true),
        ...(!authorVisible
          ? { auteurId: null, auteurLabel: 'Commentaire supprimé' }
          : {}),
        moderation: dossier
          ? {
              motif: motifs[dossier.reason],
              precision: dossier.details ?? undefined,
              at: dossier.createdAt,
              adminId: dossier.userId,
              adminLabel: nom(dossier.user, true),
              contenuSupprime: dossier.content,
            }
          : null,
        history: authorVisible
          ? comment.edits.map((e) => ({ contenu: e.content, at: e.editedAt }))
          : [],
      };
    });
  }

  create(actor: Principal, articleId: string, dto: ReplyDto) {
    const content = clean(dto.contenu);
    return this.prisma.$transaction(async (tx) => {
      await this.lockActor(tx, actor, false);
      await tx.$queryRaw`SELECT id FROM articles WHERE id = ${articleId}::uuid FOR SHARE`;
      if (
        !(await tx.article.findFirst({
          where: { id: articleId, status: 'PUBLISHED' },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
      let recipient: string | null = null;
      if (dto.parentId) {
        await tx.$queryRaw`SELECT id FROM comments WHERE id = ${dto.parentId}::uuid FOR UPDATE`;
        const parent = await tx.comment.findFirst({
          where: { id: dto.parentId, articleId, parentId: null },
          select: { userId: true, status: true },
        });
        if (!parent) throw new BadRequestException();
        if (parent.status === 'PUBLISHED') recipient = parent.userId;
      }
      const creator = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { role: true, profile: { select: { publicNameFormat: true } } },
      });
      const preference = creator.profile?.publicNameFormat ?? 'INITIAL';
      const comment = await tx.comment.create({
        data: {
          articleId,
          parentId: dto.parentId,
          userId: actor.userId,
          publicNameFormat: creator.role !== 'ADMIN' && preference === 'ADMIN' ? 'INITIAL' : preference,
          content,
        },
        include: common,
      });
      if (recipient && recipient !== actor.userId) {
        await tx.notification.create({
          data: {
            userId: recipient,
            articleId,
            commentId: comment.id,
            type: 'REPLY',
            title: 'Réponse à votre commentaire',
            message: 'Un membre a répondu à votre commentaire.',
          },
        });
      }
      return present(comment, false, true, actor.userId);
    });
  }

  edit(actor: Principal, id: string, dto: CommentDto, admin = false) {
    const content = clean(dto.contenu);
    return this.mutate(actor, id, admin, async (tx, comment) => {
      if (comment.content === content) return;
      await tx.commentEdit.create({
        data: { commentId: id, content: comment.content! },
      });
      await tx.comment.update({ where: { id }, data: { content } });
      if (admin) {
        await contentLog(
          tx,
          actor.userId,
          'COMMENT',
          id,
          'UPDATE',
          'Commentaire modifié par l’administration.',
        );
        if (comment.userId && comment.userId !== actor.userId) {
          await tx.notification.create({
            data: {
              userId: comment.userId,
              articleId: comment.articleId,
              commentId: id,
              type: 'MODERATION',
              title: 'Commentaire modifié',
              message: 'Un administrateur a modifié votre commentaire.',
            },
          });
        }
      }
    });
  }

  remove(actor: Principal, id: string) {
    return this.mutate(actor, id, false, async (tx) => {
      await tx.comment.update({
        where: { id },
        data: { status: 'DELETED_BY_AUTHOR', content: null, userId: null },
      });
    });
  }

  moderate(actor: Principal, id: string, dto: ModerationDto) {
    const precision = dto.precision?.trim();
    if (dto.motif === 'OTHER' && !precision) throw new BadRequestException();
    return this.mutate(actor, id, true, async (tx, comment) => {
      await tx.commentModeration.create({
        data: {
          commentId: id,
          userId: actor.userId,
          reason: dto.motif,
          details: precision,
          content: comment.content!,
        },
      });
      await tx.comment.update({
        where: { id },
        data: { status: 'DELETED_BY_ADMIN', content: null },
      });
      if (comment.userId)
        await tx.notification.create({
          data: {
            userId: comment.userId,
            articleId: comment.articleId,
            type: 'MODERATION',
            title: 'Commentaire retiré',
            message: 'Un administrateur a retiré votre commentaire.',
          },
        });
      // Le journal permanent ne recopie pas les éléments du dossier temporaire.
      await contentLog(
        tx,
        actor.userId,
        'COMMENT',
        id,
        'DELETE',
        'Commentaire retiré par la modération.',
      );
    });
  }

  private async lockActor(
    tx: Prisma.TransactionClient,
    actor: Principal,
    admin: boolean,
  ) {
    // Les clés étrangères des notifications doivent pouvoir référencer l’autre auteur en parallèle.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.userId}::uuid FOR NO KEY UPDATE`;
    const principal = await this.sessions.assertLive(
      tx,
      actor.userId,
      actor.sessionId,
    );
    if (admin && principal.role !== 'ADMIN') throw new ForbiddenException();
  }

  private mutate(
    actor: Principal,
    id: string,
    admin: boolean,
    execute: (
      tx: Prisma.TransactionClient,
      comment: {
        userId: string | null;
        articleId: string;
        content: string | null;
      },
    ) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockActor(tx, actor, admin);
      await tx.$queryRaw`SELECT id FROM comments WHERE id = ${id}::uuid FOR UPDATE`;
      const comment = await tx.comment.findUnique({ where: { id } });
      if (!comment) throw new NotFoundException();
      if (!admin && comment.userId !== actor.userId)
        throw new ForbiddenException();
      if (comment.status !== 'PUBLISHED') throw new ConflictException();
      await execute(tx, comment);
    });
  }
}

function clean(value: string) {
  if (!value.trim()) throw new BadRequestException();
  return value.trim();
}

@Controller()
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly sessions: SessionService,
  ) {}

  @Get('articles/:id/comments')
  async article(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = authorization ? await this.sessions.authenticate(authorization) : undefined;
    return this.comments.article(id, viewer?.userId);
  }

  @Post('articles/:id/comments')
  @UseGuards(AccessGuard, BrowserOriginGuard)
  create(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyDto,
  ) {
    return this.comments.create(actor, id, dto);
  }

  @Get('me/comments')
  @UseGuards(AccessGuard)
  own(@CurrentUser() actor: Principal) {
    return this.comments.own(actor.userId);
  }

  @Get('profiles/:id/comments')
  @UseGuards(AccessGuard)
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.comments.profile(id);
  }

  @Patch('comments/:id')
  @UseGuards(AccessGuard, BrowserOriginGuard)
  @HttpCode(204)
  edit(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentDto,
  ) {
    return this.comments.edit(actor, id, dto);
  }

  @Delete('comments/:id')
  @UseGuards(AccessGuard, BrowserOriginGuard)
  @HttpCode(204)
  remove(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comments.remove(actor, id);
  }
}

@Controller('admin/comments')
@UseGuards(AccessGuard, BrowserOriginGuard, RoleGuard)
@Roles('ADMIN')
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list() {
    return this.comments.admin();
  }

  @Patch(':id')
  @HttpCode(204)
  edit(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentDto,
  ) {
    return this.comments.edit(actor, id, dto, true);
  }

  @Post(':id/moderation')
  @HttpCode(204)
  moderate(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationDto,
  ) {
    return this.comments.moderate(actor, id, dto);
  }
}
