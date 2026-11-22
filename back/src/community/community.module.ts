import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AssociationController, AssociationService } from './association.js';
import {
  AdminCommentsController,
  CommentsController,
  CommentsService,
} from './comments.js';
import { AdminContactController, ContactController } from './contact.js';
import { NotificationsController } from './notifications.js';

@Module({
  imports: [AuthModule],
  controllers: [
    CommentsController,
    AdminCommentsController,
    NotificationsController,
    AssociationController,
    ContactController,
    AdminContactController,
  ],
  providers: [CommentsService, AssociationService],
})
export class CommunityModule {}
