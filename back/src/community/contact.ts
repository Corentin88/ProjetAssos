import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { ContactMessage } from '../../generated/prisma/client.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  CurrentUser,
  RoleGuard,
  Roles,
} from '../auth/access.guard.js';
import { AccountLinksService } from '../auth/account-links.service.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { contentLog, lockAdmin } from '../content/content.shared.js';
import { PrismaService } from '../prisma/prisma.module.js';

class ContactDto {
  @IsString() @MaxLength(100) prenom: string;
  @IsString() @MaxLength(100) nom: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(255) sujet: string;
  @IsString() @MaxLength(10000) message: string;
  @Equals(true) consentement: boolean;
  @IsOptional() @IsString() @MaxLength(1000) site_web?: string;
}
class ReadDto {
  @IsBoolean() lu: boolean;
}
class ContactReplyDto {
  @IsString() @MaxLength(10000) message: string;
}

function present(item: ContactMessage) {
  return {
    id: item.id,
    prenom: item.firstName,
    nom: item.lastName,
    email: item.email,
    sujet: item.subject,
    message: item.message,
    at: item.createdAt,
    lu: item.isRead,
    repliedAt: item.repliedAt,
  };
}

@Controller('contact')
export class ContactController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  @UseGuards(BrowserOriginGuard, AuthRateGuard)
  async create(@Body() dto: ContactDto) {
    if (dto.site_web?.trim()) return;
    const firstName = dto.prenom.trim();
    const lastName = dto.nom.trim();
    const subject = dto.sujet.trim();
    const message = dto.message.trim();
    if (
      !firstName ||
      !lastName ||
      !subject ||
      message.length < 20 ||
      /[\r\n]/.test(subject)
    )
      throw new BadRequestException();
    await this.prisma.contactMessage.create({
      data: {
        firstName,
        lastName,
        subject,
        message,
        email: dto.email.trim(),
      },
    });
  }
}

@Controller('admin/contact')
@UseGuards(AccessGuard, BrowserOriginGuard, RoleGuard)
@Roles('ADMIN')
export class AdminContactController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mail: AccountLinksService,
  ) {}

  @Get()
  async list() {
    return (
      await this.prisma.contactMessage.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map(present);
  }

  @Patch('read')
  @HttpCode(204)
  async readAll(@CurrentUser() actor: Principal) {
    await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await tx.contactMessage.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
    });
  }

  @Patch(':id/read')
  @HttpCode(204)
  async read(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReadDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await tx.contactMessage.update({
        where: { id },
        data: { isRead: dto.lu },
      });
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await tx.contactMessage.delete({ where: { id } });
      await contentLog(
        tx,
        actor.userId,
        'CONTACT_MESSAGE',
        id,
        'DELETE',
        'Message de contact supprimé.',
      );
    });
  }

  @Post(':id/reply')
  @HttpCode(204)
  @UseGuards(AuthRateGuard)
  async reply(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContactReplyDto,
  ) {
    const text = dto.message.trim();
    if (!text) throw new BadRequestException();
    this.mail.assertConfigured();
    await this.prisma.$transaction(
      async (tx) => {
        await lockAdmin(tx, this.sessions, actor);
        await tx.$queryRaw`SELECT id FROM contact_messages WHERE id = ${id}::uuid FOR UPDATE`;
        const item = await tx.contactMessage.findUnique({ where: { id } });
        if (!item) throw new NotFoundException();
        await this.mail.sendText(
          item.email,
          `Re: ${item.subject.replace(/[\r\n]/g, ' ')}`,
          text,
        );
        await tx.contactMessage.update({
          where: { id },
          data: { isRead: true, repliedAt: new Date() },
        });
        await contentLog(
          tx,
          actor.userId,
          'CONTACT_MESSAGE',
          id,
          'UPDATE',
          'Réponse au message de contact envoyée.',
        );
      },
      { timeout: 30000 },
    );
  }
}
