import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { pdfMaxBytes } from '../config/runtime.module.js';
import { pdfDisposition, validatePdfUpload } from './pdf-document.js';

describe('Contrôle d’un document PDF', () => {
  const body = '%PDF-1.7\n';
  const buffer = Buffer.from(
    `${body}xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n${body.length}\n%%EOF\n`,
  );
  const file = {
    buffer,
    originalname: 'Programme.pdf',
    mimetype: 'application/pdf',
  };

  it('conserve le nom UTF-8 et le contenu original', () => {
    const originalname = Buffer.from('Programme été.pdf').toString('latin1');
    expect(validatePdfUpload({ ...file, originalname })).toEqual({
      originalName: 'Programme été.pdf',
      data: buffer,
    });
  });

  it.each([
    { mimetype: 'text/html' },
    { originalname: 'Programme.exe' },
    { buffer: Buffer.from('<html>Faux document</html>') },
    { buffer: Buffer.from('%PDF-1.7\ninvalid\nstartxref\n9\n%%EOF\n') },
  ])('rejette un fichier hors format', (patch) => {
    expect(() => validatePdfUpload({ ...file, ...patch })).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('applique le plafond configuré avant de lire la signature', () => {
    expect(() =>
      validatePdfUpload({ ...file, buffer: Buffer.alloc(pdfMaxBytes + 1) }),
    ).toThrow(PayloadTooLargeException);
  });

  it('génère un en-tête de téléchargement sans caractères de contrôle', () => {
    const header = pdfDisposition('été "\r\n.pdf', true);
    expect(header).toContain('attachment;');
    expect(header).toContain("filename*=UTF-8''%C3%A9t%C3%A9%20%22%0D%0A.pdf");
    expect(header).not.toMatch(/[\r\n]/);
  });
});
