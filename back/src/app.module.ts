import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { RuntimeModule } from './config/runtime.module.js';
import { ContentModule } from './content/content.module.js';
import { CommunityModule } from './community/community.module.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    RuntimeModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    ContentModule,
    CommunityModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
