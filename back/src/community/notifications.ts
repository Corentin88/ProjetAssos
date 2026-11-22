import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  AccessGuard,
  BrowserOriginGuard,
  CurrentUser,
} from '../auth/access.guard.js';
import type { Principal } from '../auth/session.service.js';
import { PrismaService } from '../prisma/prisma.module.js';

@Controller('me/notifications')
@UseGuards(AccessGuard, BrowserOriginGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@CurrentUser() actor: Principal) {
    const [period] = await this.prisma.$queryRaw<
      { since: Date }[]
    >`SELECT now() - INTERVAL '1 year' AS since`;
    const notifications = await this.prisma.notification.findMany({
      where: { userId: actor.userId, createdAt: { gt: period.since } },
      include: {
        article: { select: { slug: true, status: true } },
        comment: { select: { id: true, status: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type:
        n.type === 'ACCOUNT'
          ? 'compte'
          : n.type === 'MODERATION'
            ? 'moderation'
            : 'interaction',
      titre: n.title,
      texte: n.message,
      at: n.createdAt,
      lue: n.isRead,
      link:
        n.article?.status === 'PUBLISHED'
          ? `/actualites/${n.article.slug}${n.comment?.status === 'PUBLISHED' ? `#commentaire-${n.comment.id}` : ''}`
          : undefined,
    }));
  }

  @Patch('read')
  @HttpCode(204)
  async readAll(@CurrentUser() actor: Principal) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.userId, isRead: false },
      data: { isRead: true },
    });
  }

  @Patch(':id/read')
  @HttpCode(204)
  async read(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: actor.userId },
      data: { isRead: true },
    });
    if (!result.count) throw new NotFoundException();
  }

  @Delete()
  @HttpCode(204)
  async removeAll(@CurrentUser() actor: Principal) {
    await this.prisma.notification.deleteMany({
      where: { userId: actor.userId },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId: actor.userId },
    });
    if (!result.count) throw new NotFoundException();
  }
}
