import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'Get all active notifications for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Notifications list retrieved.' })
  getNotifications(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.notificationService.getUserNotifications(userId, orgId);
  }

  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  markAsRead(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationService.markAsRead(notificationId, userId, orgId);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread notifications of the user as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  markAllAsRead(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.notificationService.markAllAsRead(userId, orgId);
  }

  @Post('notifications/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive (soft-delete) a notification' })
  @ApiResponse({ status: 200, description: 'Notification archived successfully.' })
  archiveNotification(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationService.archiveNotification(notificationId, userId, orgId);
  }

  @Get('notifications/preferences')
  @ApiOperation({ summary: 'Get notification preferences for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Notification preferences retrieved.' })
  getPreferences(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.notificationService.getPreferences(userId, orgId);
  }

  @Patch('notifications/preferences')
  @ApiOperation({ summary: 'Update notification preferences for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated.' })
  updatePreferences(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationService.updatePreferences(userId, orgId, dto);
  }
}
