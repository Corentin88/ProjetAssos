import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { RuntimeConfig } from '../config/runtime.module.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: RuntimeConfig) {
    const url = config.databaseUrl;
    super({
      adapter: new PrismaPg(
        { connectionString: url.href, connectionTimeoutMillis: 5000 },
        { schema: url.searchParams.get('schema') ?? 'public' },
      ),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
