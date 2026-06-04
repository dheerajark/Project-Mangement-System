import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Organization')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings retrieved successfully.' })
  getSettings(@TenantId() organizationId: string) {
    return this.organizationService.getSettings(organizationId);
  }

  @Patch('settings')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings updated successfully.' })
  updateSettings(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.organizationService.updateSettings(organizationId, userId, dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'Get list of organization members' })
  @ApiResponse({ status: 200, description: 'List of members retrieved successfully.' })
  getMembers(@TenantId() organizationId: string) {
    return this.organizationService.getMembers(organizationId);
  }

  @Patch('members/:userId')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Update organization member status or role' })
  @ApiResponse({ status: 200, description: 'Member updated successfully.' })
  updateMember(
    @TenantId() organizationId: string,
    @GetCurrentUserId() currentUserId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.organizationService.updateMember(organizationId, currentUserId, targetUserId, dto);
  }

  @Delete('members/:userId')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Soft delete member from organization' })
  @ApiResponse({ status: 200, description: 'Member successfully removed.' })
  deleteMember(
    @TenantId() organizationId: string,
    @GetCurrentUserId() currentUserId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.organizationService.deleteMember(organizationId, currentUserId, targetUserId);
  }

  @Get('audit-logs')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Get audit logs for the organization' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully.' })
  getAuditLogs(@TenantId() organizationId: string) {
    return this.organizationService.getAuditLogs(organizationId);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get list of available roles' })
  @ApiResponse({ status: 200, description: 'List of roles retrieved successfully.' })
  getRoles() {
    return this.organizationService.getRoles();
  }
}
