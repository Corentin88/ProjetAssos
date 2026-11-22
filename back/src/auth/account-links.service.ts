import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { AccountTokenPurpose } from '../../generated/prisma/client.js';
import { RuntimeConfig } from '../config/runtime.module.js';

const subjects: Record<AccountTokenPurpose, string> = {
  PASSWORD_RESET: 'Réinitialiser votre mot de passe',
  INVITATION: 'Activer votre compte ProjetAssos',
  EMAIL_CHANGE: 'Confirmer votre nouvelle adresse',
};

@Injectable()
export class AccountLinksService {
  private readonly logger = new Logger(AccountLinksService.name);
  private readonly transport;

  constructor(private readonly config: RuntimeConfig) {
    if (config.smtpUrl && config.mailFrom) {
      const url = config.smtpUrl;
      const secure = url.protocol === 'smtps:';
      let auth;
      try {
        auth = url.username
          ? {
              user: decodeURIComponent(url.username),
              pass: decodeURIComponent(url.password),
            }
          : undefined;
      } catch {
        throw new Error('Identifiants SMTP mal encodés.');
      }
      this.transport = createTransport({
        host: url.hostname,
        port: Number(url.port || (secure ? 465 : 587)),
        secure,
        auth,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10_000,
        requireTLS: config.production && !secure,
      });
    }
  }

  assertConfigured() {
    if (!this.transport) throw new ServiceUnavailableException();
  }

  async send(email: string, purpose: AccountTokenPurpose, token: string) {
    this.assertConfigured();
    const path = purpose.toLowerCase().replaceAll('_', '-');
    const link = `${this.config.apiOrigin}/api/v1/auth/link/${path}#token=${token}`;
    try {
      await this.transport!.sendMail({
        from: this.config.mailFrom,
        to: email,
        subject: subjects[purpose],
        text: `${subjects[purpose]}\n\n${link}\n\nCe lien temporaire est à usage unique.`,
      });
    } catch {
      this.logger.warn('L’envoi d’un lien de compte a échoué.');
      throw new ServiceUnavailableException();
    }
  }
}
