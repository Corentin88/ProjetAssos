import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ActivityAction,
  ActivityTarget,
  Prisma,
} from '../../generated/prisma/client.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  CurrentUser,
  RoleGuard,
  Roles,
} from '../auth/access.guard.js';
import { ConfirmDto } from '../auth/auth.dto.js';
import { AuthModule } from '../auth/auth.module.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { contentLog, lockAdmin } from '../content/content.shared.js';
import { PrismaService } from '../prisma/prisma.module.js';

class JournalQuery {
  @ValidateIf((_query, value) => value !== undefined && value !== 'none')
  @IsUUID()
  actor?: string;

  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @IsOptional()
  @IsEnum(ActivityTarget)
  target?: ActivityTarget;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  before?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  element?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
}

type JournalEntry = {
  id: string;
  actorId: string | null;
  actorLabel: string | null;
  action: ActivityAction;
  target: ActivityTarget;
  targetId: string | null;
  targetLabel: string | null;
  description: string;
  at: Date;
};
const pageSize = 50;

// Les libellés viennent des éléments encore présents. Le journal ne conserve pas de copie d'identité.
function journalRows(
  db: Prisma.TransactionClient,
  query: JournalQuery,
  limit: number,
  offset = 0,
) {
  const filters: Prisma.Sql[] = [];
  if (query.actor === 'none') filters.push(Prisma.sql`log.user_id IS NULL`);
  else if (query.actor)
    filters.push(Prisma.sql`log.user_id = ${query.actor}::uuid`);
  if (query.action)
    filters.push(Prisma.sql`log.action = ${query.action}::activity_action`);
  if (query.target)
    filters.push(Prisma.sql`log.target = ${query.target}::activity_target`);
  if (query.from)
    filters.push(Prisma.sql`log.created_at >= ${new Date(query.from)}`);
  if (query.before)
    filters.push(Prisma.sql`log.created_at < ${new Date(query.before)}`);
  const element = query.element?.trim().toLowerCase();
  const where = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
    : Prisma.empty;
  return db.$queryRaw<JournalEntry[]>`
    SELECT * FROM (
      SELECT log.id, log.user_id AS "actorId",
        NULLIF(concat_ws(' ', actor.first_name, actor.last_name), '') AS "actorLabel",
        log.action, log.target, log.target_id AS "targetId", log.description, log.created_at AS at,
        COALESCE(NULLIF(working.title, ''), NULLIF(published.title, ''), category.name, tag.name,
          media.name, association.name, NULLIF(concat_ws(' ', account.first_name, account.last_name), '')) AS "targetLabel"
      FROM activity_logs log
      LEFT JOIN profiles actor ON actor.user_id = log.user_id
      LEFT JOIN profiles account ON log.target = 'ACCOUNT' AND account.user_id = log.target_id
      LEFT JOIN article_versions working ON log.target = 'ARTICLE' AND working.article_id = log.target_id AND working.kind = 'WORKING'
      LEFT JOIN article_versions published ON log.target = 'ARTICLE' AND published.article_id = log.target_id AND published.kind = 'PUBLISHED'
      LEFT JOIN categories category ON log.target = 'CATEGORY' AND category.id = log.target_id
      LEFT JOIN tags tag ON log.target = 'TAG' AND tag.id = log.target_id
      LEFT JOIN media ON log.target = 'MEDIA' AND media.id = log.target_id
      LEFT JOIN associations association ON log.target = 'ASSOCIATION' AND association.id = log.target_id
      ${where}
    ) AS entries
    ${element ? Prisma.sql`WHERE strpos(lower(concat_ws(' ', "targetLabel", "targetId", description)), ${element}) > 0` : Prisma.empty}
    ORDER BY at DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

@Controller('admin')
@UseGuards(AccessGuard, BrowserOriginGuard, RoleGuard)
@Roles('ADMIN')
class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Get('overview')
  async overview() {
    const [
      roles,
      statuses,
      suspended,
      comments,
      unreadMessages,
      media,
      scheduled,
      recent,
    ] = await this.prisma.$transaction(
      [
        this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        this.prisma.article.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.comment.count(),
        this.prisma.contactMessage.count({ where: { isRead: false } }),
        this.prisma.media.count({
          where: {
            OR: [
              { type: 'IMAGE', path: { startsWith: 'content/' } },
              { type: 'GPX', path: { startsWith: 'trails/' } },
            ],
          },
        }),
        this.prisma.article.findMany({
          where: { status: 'SCHEDULED', scheduledAt: { not: null } },
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            scheduledAt: true,
            versions: { where: { kind: 'WORKING' }, select: { title: true } },
          },
        }),
        journalRows(this.prisma, { page: 1 }, 6),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      accounts: {
        ADMIN: 0,
        USER: 0,
        ...Object.fromEntries(roles.map((row) => [row.role, row._count._all])),
      },
      articles: {
        DRAFT: 0,
        PUBLISHED: 0,
        SCHEDULED: 0,
        TRASHED: 0,
        ...Object.fromEntries(
          statuses.map((row) => [row.status, row._count._all]),
        ),
      },
      suspended,
      comments,
      unreadMessages,
      media,
      scheduled: scheduled.map((item) => ({
        id: item.id,
        scheduledAt: item.scheduledAt,
        title: item.versions[0]?.title || 'Sans titre',
      })),
      recent,
    };
  }

  @Get('journal')
  async journal(@Query() query: JournalQuery) {
    const from = query.from ? Date.parse(query.from) : undefined;
    const before = query.before ? Date.parse(query.before) : undefined;
    if (
      Number.isNaN(from) ||
      Number.isNaN(before) ||
      (from !== undefined && before !== undefined && from >= before)
    ) {
      throw new BadRequestException();
    }
    const [rows, people] = await Promise.all([
      journalRows(
        this.prisma,
        query,
        pageSize + 1,
        (query.page - 1) * pageSize,
      ),
      this.prisma.profile.findMany({
        where: { user: { activityLogs: { some: {} } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { userId: 'asc' }],
        select: { userId: true, firstName: true, lastName: true },
      }),
    ]);
    return {
      entries: rows.slice(0, pageSize),
      hasNext: rows.length > pageSize,
      actors: people.map((person) => ({
        id: person.userId,
        label: `${person.firstName} ${person.lastName}`,
      })),
    };
  }

  @Delete('journal/:id')
  @HttpCode(204)
  @UseGuards(AuthRateGuard)
  async remove(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _confirmation: ConfirmDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await tx.activityLog.delete({ where: { id }, select: { id: true } });
      await contentLog(
        tx,
        actor.userId,
        'ACTIVITY_LOG',
        id,
        'DELETE',
        'Entrée du journal supprimée manuellement.',
      );
    });
  }
}

@Module({ imports: [AuthModule], controllers: [AdminController] })
export class AdminModule {}
