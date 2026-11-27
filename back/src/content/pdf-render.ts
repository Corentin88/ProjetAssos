import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ContentInputError } from './content-input.error.js';

const exec = promisify(execFile);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maxPage = 200;
const maxActive = 2;
const maxWaiting = 16;
let active = 0;
const waiting: (() => void)[] = [];

// Deux conversions au plus tournent en parallèle. Les suivantes attendent dans une file bornée :
// un article avec plusieurs lecteurs PDF ne doit pas échouer, mais un afflux massif reçoit un 503.
async function acquireSlot() {
  if (active < maxActive) {
    active += 1;
    return;
  }
  if (waiting.length >= maxWaiting) throw new ServiceUnavailableException();
  // Le créneau est transmis directement par releaseSlot : le compteur reste inchangé.
  await new Promise<void>(resolve => waiting.push(resolve));
}

function releaseSlot() {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
}

async function poppler(command: 'pdfinfo' | 'pdftocairo', args: string[], maxBuffer: number) {
  await acquireSlot();
  try {
    const linux = process.platform === 'linux';
    // Le processus de conversion ne reçoit ni la configuration applicative ni ses secrets.
    const invocation = linux ? ['--as=536870912', '--cpu=6', '--nofile=64', '--', command, ...args] : args;
    const { stdout } = await exec(linux ? 'prlimit' : command, invocation, {
      encoding: 'buffer', timeout: 8_000, maxBuffer, windowsHide: true, killSignal: 'SIGKILL',
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, LANG: 'C', LC_ALL: 'C' },
    });
    return stdout;
  } catch (error) {
    const { code } = error as { code?: string | number };
    if (code === 'ENOENT' || code === 127)
      throw new ServiceUnavailableException();
    throw new ContentInputError('Ce PDF est invalide, protégé ou trop complexe pour être converti.');
  } finally {
    releaseSlot();
  }
}

export async function pdfPageCount(path: string, reader = true) {
  const info = (await poppler('pdfinfo', [resolve(path)], 64 * 1024)).toString('utf8');
  const count = Number(/^Pages:\s+(\d+)\s*$/m.exec(info)?.[1]);
  if (!Number.isSafeInteger(count) || count < 1 || !/^Encrypted:\s+no\s*$/m.test(info))
    throw new ContentInputError('La conversion de ce PDF protégé ou illisible est impossible.');
  if (reader && count > maxPage)
    throw new ContentInputError('Ce document dépasse 200 pages. Ouvrez le PDF dans le lecteur du navigateur.');
  return count;
}

export async function renderPdfPage(path: string, page: number, preview = false) {
  if (!Number.isInteger(page) || page < 1 || page > maxPage) throw new NotFoundException();
  if (page > await pdfPageCount(path, !preview)) throw new NotFoundException();
  const number = String(page);
  const dimension = preview ? 1440 : 1800;
  const png = await poppler('pdftocairo', ['-png', '-singlefile', '-f', number, '-l', number,
    '-scale-to', String(dimension), resolve(path), '-'], 8 * 1024 * 1024);
  if (png.length < 33 || !png.subarray(0, signature.length).equals(signature) ||
      png.toString('ascii', 12, 16) !== 'IHDR' ||
      [png.readUInt32BE(16), png.readUInt32BE(20)].some(side => side < 1 || side > dimension))
    throw new ContentInputError('Aperçu PDF indisponible.');
  return png;
}
