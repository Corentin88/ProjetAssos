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

export const accountLinkMinutes = {
  INVITATION: 1440,
  PASSWORD_RESET: 30,
  EMAIL_CHANGE: 60,
};

export function passwordResetMail(link: string) {
  const intro =
    'Vous avez demandé à réinitialiser le mot de passe de votre compte ProjetAssos.';
  const validity = `Ce lien est valable ${accountLinkMinutes.PASSWORD_RESET} minutes et ne peut servir qu’une fois.`;
  const ignore =
    'Si vous n’avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail.';
  const action = 'Réinitialiser mon mot de passe';
  const url = link
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return {
    text: `ProjetAssos\n\n${intro}\n\n${action}\n${link}\n\n${validity}\n\n${ignore}\n\nL’équipe ProjetAssos`,
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f1eb;color:#24332b;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f4f1eb"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="560" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:560px">
<tr><td bgcolor="#244d3b" style="padding:20px 24px;color:#ffffff;font-size:20px;font-weight:bold">ProjetAssos</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.6">
<h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">Réinitialisation du mot de passe</h1>
<p>${intro}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#244d3b" style="padding:12px 18px">
<a href="${url}" style="display:inline-block;color:#ffffff;font-weight:bold;text-decoration:underline">${action}</a>
</td></tr></table>
<p>${validity}</p>
<p>Si le bouton ne fonctionne pas, ouvrez ce lien dans votre navigateur.<br>
<a href="${url}" style="color:#244d3b;word-break:break-all">${url}</a></p>
<p>${ignore}</p></td></tr>
<tr><td bgcolor="#ebe7dc" style="padding:16px 24px;font-size:14px">L’équipe ProjetAssos</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}

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
    if (purpose === 'PASSWORD_RESET') {
      const link = `${this.config.frontOrigin}/#/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
      const { text, html } = passwordResetMail(link);
      return this.sendText(email, subjects[purpose], text, html);
    }
    const path = purpose.toLowerCase().replaceAll('_', '-');
    const link = `${this.config.apiOrigin}/api/v1/auth/link/${path}#token=${token}`;
    return this.sendText(
      email,
      subjects[purpose],
      `${subjects[purpose]}\n\n${link}\n\nCe lien temporaire est à usage unique.`,
    );
  }

  async sendText(email: string, subject: string, text: string, html?: string) {
    this.assertConfigured();
    try {
      await this.transport!.sendMail({
        from: this.config.mailFrom,
        to: email,
        subject,
        text,
        html,
      });
    } catch {
      this.logger.warn('L’envoi par SMTP a échoué.');
      throw new ServiceUnavailableException();
    }
  }
}
