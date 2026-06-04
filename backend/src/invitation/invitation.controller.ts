import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('invitations')
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  @Post()
  @Permissions('INVITE_MEMBERS')
  @ApiOperation({ summary: 'Create and send organization member invitation' })
  @ApiResponse({ status: 201, description: 'Invitation created successfully.' })
  createInvitation(
    @TenantId() organizationId: string,
    @GetCurrentUserId() currentUserId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationService.createInvitation(organizationId, currentUserId, dto);
  }

  @Get()
  @Permissions('INVITE_MEMBERS')
  @ApiOperation({ summary: 'Get list of pending invitations' })
  @ApiResponse({ status: 200, description: 'Invitations list retrieved successfully.' })
  getInvitations(@TenantId() organizationId: string) {
    return this.invitationService.getInvitations(organizationId);
  }

  @Delete(':id')
  @Permissions('INVITE_MEMBERS')
  @ApiOperation({ summary: 'Revoke organization invitation' })
  @ApiResponse({ status: 200, description: 'Invitation successfully revoked.' })
  revokeInvitation(
    @TenantId() organizationId: string,
    @GetCurrentUserId() currentUserId: string,
    @Param('id') invitationId: string,
  ) {
    return this.invitationService.revokeInvitation(organizationId, currentUserId, invitationId);
  }
}
