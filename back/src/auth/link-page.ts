import { randomBytes } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

const pages = {
  invitation: ['Activer mon compte', 'invitations/complete'],
  'password-reset': ['Réinitialiser mon mot de passe', 'password/reset'],
  'email-change': ['Confirmer ma nouvelle adresse', 'email/confirm'],
} as const;

export function sendLinkPage(response: Response, kind: string) {
  if (!Object.hasOwn(pages, kind)) throw new NotFoundException();
  const [title, endpoint] = pages[kind as keyof typeof pages];
  const passwordFields =
    kind === 'email-change'
      ? ''
      : `
    <p><label>Nouveau mot de passe <input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></p>
    <p><label>Confirmation <input name="passwordConfirmation" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></p>`;
  const nonce = randomBytes(18).toString('base64');
  response
    .set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
    })
    .type('html').send(`<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><main><h1>${title}</h1>
<form>${passwordFields}<button type="submit">Confirmer</button></form><p role="status"></p>
<script nonce="${nonce}">
const token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null, '', location.pathname);
const form = document.querySelector('form');
const status = document.querySelector('[role=status]');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const result = await fetch('/api/v1/auth/${endpoint}', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...Object.fromEntries(new FormData(form)), token})
    });
    if (result.ok) {
      form.reset();
      form.hidden = true;
      status.textContent = 'Confirmation enregistrée. Vous pouvez fermer cette page.';
      return;
    }
    status.textContent = 'Lien inutilisable ou données invalides.';
  } catch {
    status.textContent = 'Service momentanément indisponible.';
  }
  button.disabled = false;
});
</script></main></html>`);
}
