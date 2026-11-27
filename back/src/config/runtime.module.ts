import { Global, Injectable, Module } from '@nestjs/common';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { isIP } from 'node:net';

config({ path: resolve(process.cwd(), '../.env'), quiet: true });

const pdfMaxMib = Number(process.env.PDF_MAX_MIB ?? 20);
if (!Number.isInteger(pdfMaxMib) || pdfMaxMib < 1 || pdfMaxMib > 50)
  throw new Error('PDF_MAX_MIB doit être un entier compris entre 1 et 50.');
export const pdfMaxBytes = pdfMaxMib * 1024 * 1024;

@Injectable()
export class RuntimeConfig {
  readonly production = process.env.NODE_ENV === 'production';
  readonly databaseUrl = this.serviceUrl(
    'DATABASE_URL',
    ['postgres:', 'postgresql:'],
    true,
  )!;
  readonly jwtSecret = this.required('AUTH_JWT_SECRET');
  readonly frontOrigin = this.origin('FRONT_ORIGIN', 'http://localhost:5173');
  readonly apiOrigin = this.origin('API_ORIGIN', 'http://localhost:3000');
  readonly smtpUrl = this.serviceUrl('SMTP_URL', ['smtp:', 'smtps:']);
  readonly mailFrom = process.env.MAIL_FROM;
  readonly googleClientId = process.env.GOOGLE_CLIENT_ID;
  readonly googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  readonly googleRedirectUri = `${this.apiOrigin}/api/v1/auth/google/callback`;
  readonly trustProxyIp = process.env.TRUST_PROXY_IP?.trim();
  readonly avatarDirectory = process.env.AVATAR_DIRECTORY || 'storage/avatars';

  constructor() {
    if (this.trustProxyIp && !isIP(this.trustProxyIp)) {
      throw new Error('TRUST_PROXY_IP doit être une adresse IP unique.');
    }
    if (Buffer.byteLength(this.jwtSecret) < 32) {
      throw new Error('AUTH_JWT_SECRET doit contenir au moins 32 octets.');
    }
    if (
      this.production &&
      [this.frontOrigin, this.apiOrigin].some(
        (origin) => !origin.startsWith('https:'),
      )
    ) {
      throw new Error('Les origines publiques doivent utiliser HTTPS.');
    }
  }

  private required(name: string): string {
    const value = process.env[name];
    if (!value?.trim()) throw new Error(`Variable obligatoire : ${name}.`);
    return value;
  }

  private origin(name: string, fallback: string): string {
    const url = URL.parse(process.env[name] || fallback);
    if (
      !url ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(`${name} doit contenir une origine HTTP(S).`);
    }
    return url.origin;
  }

  private serviceUrl(
    name: string,
    protocols: string[],
    required = false,
  ): URL | undefined {
    const value = required ? this.required(name) : process.env[name]?.trim();
    if (!value) return undefined;
    const url = URL.parse(value);
    if (!url?.hostname || !protocols.includes(url.protocol)) {
      throw new Error(`${name} doit contenir une URL de service valide.`);
    }
    return url;
  }
}

@Global()
@Module({ providers: [RuntimeConfig], exports: [RuntimeConfig] })
export class RuntimeModule {}
