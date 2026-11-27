import { ConflictException } from '@nestjs/common';

export class GoogleAccountAlreadyLinkedError extends ConflictException {
  static readonly code = 'GOOGLE_ACCOUNT_ALREADY_LINKED';
}
