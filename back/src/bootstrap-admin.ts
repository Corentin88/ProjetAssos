import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppModule } from './app.module.js';
import { InviteDto } from './auth/auth.dto.js';
import { AccountsService } from './users/accounts.service.js';

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
  abortOnError: false,
}).catch(() => undefined);
if (!app) {
  console.error('Impossible de démarrer. Vérifier la configuration de l’API.');
  process.exitCode = 1;
} else {
  try {
    const accounts = app.get(AccountsService);
    const dto = plainToInstance(InviteDto, {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME,
      lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME,
      role: 'ADMIN',
    });
    if ((await validate(dto)).length) throw new Error();
    await accounts.invite(null, dto);
    console.log('Invitation administrateur envoyée.');
  } catch {
    console.error(
      'Invitation impossible. Vérifier SMTP, les paramètres de l’invitation et l’état du compte.',
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
