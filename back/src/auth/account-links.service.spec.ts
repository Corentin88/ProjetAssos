import { createTransport } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import type { RuntimeConfig } from '../config/runtime.module.js';
import {
  AccountLinksService,
  accountLinkMinutes,
} from './account-links.service.js';

vi.mock('nodemailer', () => ({ createTransport: vi.fn() }));

describe('AccountLinksService', () => {
  it('envoie les deux versions du lien de réinitialisation vers la route React', async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createTransport).mockReturnValue({
      sendMail,
    } as unknown as ReturnType<typeof createTransport>);
    const config = {
      smtpUrl: new URL('smtp://localhost:2525'),
      mailFrom: 'projetassos@example.test',
      frontOrigin: 'https://association.example.test',
    } as RuntimeConfig;
    const token = 'A'.repeat(43);
    const link = `${config.frontOrigin}/#/reinitialiser-mot-de-passe?token=${token}`;

    await new AccountLinksService(config).send(
      'membre@example.test',
      'PASSWORD_RESET',
      token,
    );

    expect(sendMail).toHaveBeenCalledOnce();
    const [message] = sendMail.mock.calls[0];
    expect(message.text).toContain(link);
    expect(message.html).toContain(`href="${link}"`);
    expect(message.text).toContain(
      `${accountLinkMinutes.PASSWORD_RESET} minutes`,
    );
    expect(message.html).toContain(
      `${accountLinkMinutes.PASSWORD_RESET} minutes`,
    );
    expect(message.html).toContain(
      'Si vous n’avez pas demandé cette réinitialisation',
    );
  });
});
