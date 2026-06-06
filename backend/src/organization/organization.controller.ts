import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CloneProfileDto } from './dto/clone-profile.dto';
import { AssignProfileDto } from './dto/assign-profile.dto';
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

  // ─── Profiles & Permissions Endpoints ───────────────────────────────────────

  @Get('permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Get all system permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully.' })
  getAllPermissions() {
    return this.organizationService.getAllPermissions();
  }

  @Get('profiles')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Get organization profiles' })
  @ApiResponse({ status: 200, description: 'Profiles retrieved successfully.' })
  getProfiles(@TenantId() organizationId: string) {
    return this.organizationService.getProfiles(organizationId);
  }

  @Post('profiles')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Create custom profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully.' })
  createCustomProfile(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateProfileDto,
  ) {
    return this.organizationService.createCustomProfile(organizationId, userId, dto);
  }

  @Post('profiles/:id/archive')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Archive a profile' })
  @ApiResponse({ status: 200, description: 'Profile archived successfully.' })
  archiveProfile(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.organizationService.archiveProfile(organizationId, userId, id);
  }

  @Post('profiles/:profileId/clone')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Clone a profile' })
  @ApiResponse({ status: 201, description: 'Profile cloned successfully.' })
  cloneProfile(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('profileId') profileId: string,
    @Body() dto: CloneProfileDto,
  ) {
    return this.organizationService.cloneProfile(organizationId, userId, profileId, dto);
  }

  @Post('profiles/:profileId/permissions/:permissionId')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Add permission to profile' })
  @ApiResponse({ status: 201, description: 'Permission granted successfully.' })
  addPermissionToProfile(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('profileId') profileId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.organizationService.addPermissionToProfile(organizationId, userId, profileId, permissionId);
  }

  @Delete('profiles/:profileId/permissions/:permissionId')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Remove permission from profile' })
  @ApiResponse({ status: 200, description: 'Permission revoked successfully.' })
  removePermissionFromProfile(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('profileId') profileId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.organizationService.removePermissionFromProfile(organizationId, userId, profileId, permissionId);
  }

  @Patch('members/:memberId/profile')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  @ApiOperation({ summary: 'Assign profile to organization member' })
  @ApiResponse({ status: 200, description: 'Profile assigned successfully.' })
  assignProfileToMember(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('memberId') targetUserId: string,
    @Body() dto: AssignProfileDto,
  ) {
    return this.organizationService.assignProfileToMember(organizationId, userId, targetUserId, dto);
  }
}
