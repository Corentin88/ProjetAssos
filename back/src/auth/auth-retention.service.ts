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
    await this.prisma.$transaction([
      this.prisma.accountToken.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      this.prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.prisma
        .$executeRaw`DELETE FROM notifications WHERE created_at <= now() - INTERVAL '1 year'`,
    ]);
  }
}
