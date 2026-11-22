import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RuntimeConfig } from '../config/runtime.module.js';
import { AccountsService } from '../users/accounts.service.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  RoleGuard,
} from './access.guard.js';
import { AccountLinksService } from './account-links.service.js';
import { AuthController } from './auth.controller.js';
import { AuthRetentionService } from './auth-retention.service.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [RuntimeConfig],
      useFactory: (config: RuntimeConfig) => ({
        secret: config.jwtSecret,
        signOptions: { algorithm: 'HS256', issuer: 'projetassos' },
        verifyOptions: { issuer: 'projetassos' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    GoogleService,
    AccountLinksService,
    AccountsService,
    AuthRetentionService,
    AccessGuard,
    RoleGuard,
    BrowserOriginGuard,
    AuthRateGuard,
  ],
  exports: [
    AccountsService,
    SessionService,
    AccessGuard,
    RoleGuard,
    BrowserOriginGuard,
    AuthRateGuard,
  ],
})
export class AuthModule {}
