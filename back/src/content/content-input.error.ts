import { BadRequestException } from '@nestjs/common';

// Seuls les messages métier construits par le code sont transmis au client.
export class ContentInputError extends BadRequestException {}
