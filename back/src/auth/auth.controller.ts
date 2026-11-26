import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { RuntimeConfig } from '../config/runtime.module.js';
import { AccountsService } from '../users/accounts.service.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  CurrentUser,
} from './access.guard.js';
import {
  ChangePasswordDto,
  CompletePasswordDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  TokenDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';
import { sendLinkPage } from './link-page.js';
import { SessionService } from './session.service.js';
import type { Principal } from './session.service.js';

const refreshCookie = 'projetassos_refresh';
const googleCookie = 'projetassos_google';

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

@Controller('auth')
@UseGuards(BrowserOriginGuard)
export class AuthController {
  private readonly cookie: CookieOptions;

  constructor(
    config: RuntimeConfig,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly accounts: AccountsService,
    private readonly google: GoogleService,
  ) {
    this.frontOrigin = config.frontOrigin;
    this.cookie = {
      path: '/api/v1/auth',
      sameSite: 'lax',
      httpOnly: true,
      secure: config.apiOrigin.startsWith('https:'),
    };
  }

  private readonly frontOrigin: string;

  @Post('register')
  @UseGuards(AuthRateGuard)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.deliver(response, await this.auth.register(dto));
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthRateGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.deliver(response, await this.auth.login(dto));
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthRateGuard)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.deliver(
      response,
      await this.sessions.rotate(readCookie(request, refreshCookie)),
    );
  }

  @Get('sessions')
  @UseGuards(AccessGuard)
  list(@CurrentUser() principal: Principal) {
    return this.sessions.list(principal);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(AccessGuard)
  async revoke(
    @CurrentUser() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revokeFromPrincipal(principal, id);
    if (id === principal.sessionId) this.clearRefresh(response);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessGuard)
  async logout(
    @CurrentUser() principal: Principal,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revokeFromPrincipal(principal, principal.sessionId);
    this.clearRefresh(response);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(AccessGuard)
  async logoutAll(
    @CurrentUser() principal: Principal,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revokeFromPrincipal(principal);
    this.clearRefresh(response);
  }

  @Post('password/change')
  @HttpCode(204)
  @UseGuards(AccessGuard, AuthRateGuard)
  async changePassword(
    @CurrentUser() principal: Principal,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(principal, dto);
    this.clearRefresh(response);
  }

  @Post('password/forgot')
  @HttpCode(202)
  @UseGuards(AuthRateGuard)
  requestReset(@Body() dto: EmailDto) {
    return this.accounts.requestReset(dto.email);
  }

  @Post('password/reset')
  @HttpCode(204)
  @UseGuards(AuthRateGuard)
  completeReset(@Body() dto: CompletePasswordDto) {
    return this.accounts.completePassword('PASSWORD_RESET', dto);
  }

  @Post('invitations/complete')
  @HttpCode(204)
  @UseGuards(AuthRateGuard)
  completeInvitation(@Body() dto: CompletePasswordDto) {
    return this.accounts.completePassword('INVITATION', dto);
  }

  @Post('email/change')
  @HttpCode(202)
  @UseGuards(AccessGuard, AuthRateGuard)
  requestEmail(@CurrentUser() principal: Principal, @Body() dto: EmailDto) {
    return this.accounts.requestEmailChange(
      principal,
      principal.userId,
      dto.email,
    );
  }

  @Post('email/confirm')
  @HttpCode(204)
  @UseGuards(AuthRateGuard)
  confirmEmail(@Body() dto: TokenDto) {
    return this.accounts.confirmEmail(dto.token);
  }

  @Get('link/:kind')
  link(@Param('kind') kind: string, @Res() response: Response) {
    sendLinkPage(response, kind, this.frontOrigin);
  }

  @Post('google/start')
  @HttpCode(200)
  @UseGuards(AuthRateGuard)
  startGoogle(@Res({ passthrough: true }) response: Response) {
    return this.googleFlow(response);
  }

  @Post('google/link')
  @HttpCode(200)
  @UseGuards(AccessGuard, AuthRateGuard)
  linkGoogle(
    @CurrentUser() principal: Principal,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.googleFlow(response, principal);
  }

  @Get('google/callback')
  @UseGuards(AuthRateGuard)
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code: unknown,
    @Query('state') state: unknown,
  ) {
    response.clearCookie(googleCookie, this.cookie);
    const session = await this.google.finish(
      readCookie(request, googleCookie),
      code,
      state,
    );
    if (session)
      this.setRefresh(
        response,
        session.refreshToken,
        session.session.expiresAt,
      );
    response.redirect(
      303,
      `${this.frontOrigin}/#${session ? '/connexion' : '/mon-compte/securite'}?google=ok`,
    );
  }

  @Delete('google/link')
  @HttpCode(204)
  @UseGuards(AccessGuard, AuthRateGuard)
  async unlinkGoogle(
    @CurrentUser() principal: Principal,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (await this.google.unlink(principal)) this.clearRefresh(response);
  }

  private async deliver(
    response: Response,
    result: Awaited<ReturnType<SessionService['create']>>,
  ) {
    const access = await this.sessions.access(result.userId, result.session.id);
    this.setRefresh(response, result.refreshToken, result.session.expiresAt);
    return access;
  }

  private async googleFlow(response: Response, principal?: Principal) {
    const { authorizationUrl, cookie } = await this.google.start(principal);
    response.cookie(googleCookie, cookie, { ...this.cookie, maxAge: 600_000 });
    return { authorizationUrl };
  }

  private setRefresh(response: Response, token: string, expires: Date) {
    response.cookie(refreshCookie, token, { ...this.cookie, expires });
  }

  private clearRefresh(response: Response) {
    response.clearCookie(refreshCookie, this.cookie);
  }
}
