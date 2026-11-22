import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  CurrentUser,
  RoleGuard,
  Roles,
} from '../auth/access.guard.js';
import {
  ChangeRoleDto,
  ChangeStatusDto,
  ConfirmDto,
  EmailDto,
  InviteDto,
} from '../auth/auth.dto.js';
import type { Principal } from '../auth/session.service.js';

@Controller('users')
@UseGuards(AccessGuard, BrowserOriginGuard, RoleGuard, AuthRateGuard)
class UsersController {
  constructor(private readonly accounts: AccountsService) {}

  @Delete('me')
  @HttpCode(204)
  deleteSelf(
    @CurrentUser() user: Principal,
    @Body() _confirmation: ConfirmDto,
  ) {
    return this.accounts.delete(user, user.userId);
  }

  @Post('invitations')
  @Roles('ADMIN')
  invite(@CurrentUser() user: Principal, @Body() dto: InviteDto) {
    return this.accounts.invite(user, dto);
  }

  @Post(':id/invitation/resend')
  @HttpCode(202)
  @Roles('ADMIN')
  resend(
    @CurrentUser() user: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounts.resendInvitation(user, id);
  }

  @Post(':id/email/change')
  @HttpCode(202)
  @Roles('ADMIN')
  email(
    @CurrentUser() user: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmailDto,
  ) {
    return this.accounts.requestEmailChange(user, id, dto.email, true);
  }

  @Patch(':id/status')
  @HttpCode(204)
  @Roles('ADMIN')
  status(
    @CurrentUser() user: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.accounts.changeStatus(user, id, dto);
  }

  @Patch(':id/role')
  @HttpCode(204)
  @Roles('ADMIN')
  role(
    @CurrentUser() user: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.accounts.changeRole(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN')
  delete(
    @CurrentUser() user: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _confirmation: ConfirmDto,
  ) {
    return this.accounts.delete(user, id, true);
  }
}

@Module({ imports: [AuthModule], controllers: [UsersController] })
export class UsersModule {}
