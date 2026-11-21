// Conserve les identifiants encodés et les options Prisma de l'URL locale.
const url = URL.parse(process.env.DATABASE_URL_HOTE ?? '');
if (!url || !['postgresql:', 'postgres:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL doit contenir une URL PostgreSQL valide.');
}

url.hostname = 'db';
url.port = '5432';
process.env.DATABASE_URL = url.href;
