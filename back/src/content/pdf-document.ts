import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { pdfMaxBytes } from '../config/runtime.module.js';

export const pdfMime = 'application/pdf';

export type PdfUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

function decodeFilename(filename: string) {
  if (/[^\u0000-\u00ff]/.test(filename)) return filename;
  // Les navigateurs transmettent souvent le nom en UTF-8, lu comme Latin-1 par le multipart.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.from(filename, 'latin1'),
    );
  } catch {
    return filename;
  }
}

export function validatePdfUpload(file?: PdfUpload) {
  if (!file?.buffer.length) throw new BadRequestException();
  if (file.buffer.length > pdfMaxBytes) throw new PayloadTooLargeException();
  const originalName =
    decodeFilename(file.originalname)
      .split(/[/\\]/)
      .at(-1)
      ?.replace(/[\u0000-\u001f\u007f]/g, '')
      .trim() ?? '';
  if (
    file.mimetype !== pdfMime ||
    !/\.pdf$/i.test(originalName) ||
    Array.from(originalName).length > 255
  )
    throw new UnsupportedMediaTypeException();
  const header = file.buffer.subarray(0, 12).toString('latin1');
  const trailer = file.buffer.subarray(-1024).toString('latin1');
  const offset = Number(
    /startxref[ \t\r\n]+(\d+)[ \t\r\n]+%%EOF[ \t\r\n]*$/.exec(trailer)?.[1],
  );
  if (
    !/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(header) ||
    !Number.isSafeInteger(offset) ||
    offset <= 0 ||
    offset >= file.buffer.length
  )
    throw new UnsupportedMediaTypeException();
  const xref = file.buffer.subarray(offset, offset + 64).toString('latin1');
  if (!/^(?:xref|\d+\s+\d+\s+obj)(?=\s)/.test(xref))
    throw new UnsupportedMediaTypeException();
  return { originalName, data: file.buffer };
}

export function pdfDisposition(originalName: string, download: boolean) {
  const fallback = originalName.replace(/[^a-zA-Z0-9._ -]/g, '_');
  const encoded = encodeURIComponent(originalName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16)}`,
  );
  return `${download ? 'attachment' : 'inline'}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
