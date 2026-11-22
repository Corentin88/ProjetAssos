import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';

@Injectable()
export class AuthRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthRetentionService.name);
  private timer?: NodeJS.Timeout;
  private pending?: Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      if (this.pending) return;
      this.pending = this.purge()
        .catch(() =>
          this.logger.warn('La purge des données d’authentification a échoué.'),
        )
        .finally(() => {
          this.pending = undefined;
        });
    }, 3_600_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.pending;
  }

  private async purge() {
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      await tx.accountToken.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      await tx.session.deleteMany({ where: { expiresAt: { lte: now } } });
      await tx.$executeRaw`DELETE FROM notifications WHERE created_at <= now() - INTERVAL '1 year'`;
      // Le placeholder et ses réponses restent en place après la purge du dossier.
      await tx.$executeRaw`DELETE FROM comment_edits e USING comment_moderations m
        WHERE e.comment_id = m.comment_id AND m.created_at <= now() - INTERVAL '6 months'`;
      await tx.$executeRaw`UPDATE comments c SET user_id = NULL FROM comment_moderations m
        WHERE c.id = m.comment_id AND m.created_at <= now() - INTERVAL '6 months'`;
      await tx.$executeRaw`DELETE FROM comment_moderations WHERE created_at <= now() - INTERVAL '6 months'`;
    });
  }
}
