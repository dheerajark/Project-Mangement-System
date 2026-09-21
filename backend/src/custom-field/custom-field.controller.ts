import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CustomFieldService } from './custom-field.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { ReorderCustomFieldsDto } from './dto/reorder-custom-fields.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Custom Fields')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('custom-fields')
export class CustomFieldController {
  constructor(private readonly customFieldService: CustomFieldService) {}

  @Get()
  @ApiOperation({ summary: 'Get all custom fields for organization / project' })
  async getCustomFields(
    @TenantId() organizationId: string,
    @Query('projectId') projectId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.customFieldService.getCustomFields(
      organizationId,
      projectId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get custom field by ID' })
  async getCustomFieldById(
    @TenantId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.customFieldService.getCustomFieldById(organizationId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new custom field definition' })
  async createCustomField(
    @TenantId() organizationId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Body() dto: CreateCustomFieldDto,
  ) {
    // Check permission: MANAGE_USERS (org-wide) or EDIT_PROJECT (if project-scoped)
    const canManageOrg = permissions?.includes('MANAGE_USERS');
    const canEditProject = permissions?.includes('EDIT_PROJECT');

    if (!canManageOrg && (!dto.projectId || !canEditProject)) {
      throw new ForbiddenException(
        'You do not have permission to create custom fields',
      );
    }

    return this.customFieldService.createCustomField(organizationId, dto);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder custom fields' })
  async reorderCustomFields(
    @TenantId() organizationId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Body() dto: ReorderCustomFieldsDto,
  ) {
    const canManageOrg = permissions?.includes('MANAGE_USERS');
    const canEditProject = permissions?.includes('EDIT_PROJECT');

    if (!canManageOrg && !canEditProject) {
      throw new ForbiddenException(
        'You do not have permission to reorder custom fields',
      );
    }

    return this.customFieldService.reorderCustomFields(organizationId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update custom field definition' })
  async updateCustomField(
    @TenantId() organizationId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    const canManageOrg = permissions?.includes('MANAGE_USERS');
    const canEditProject = permissions?.includes('EDIT_PROJECT');

    if (!canManageOrg && !canEditProject) {
      throw new ForbiddenException(
        'You do not have permission to update custom fields',
      );
    }

    return this.customFieldService.updateCustomField(organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete custom field definition' })
  async deleteCustomField(
    @TenantId() organizationId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
  ) {
    const canManageOrg = permissions?.includes('MANAGE_USERS');
    const canEditProject = permissions?.includes('EDIT_PROJECT');

    if (!canManageOrg && !canEditProject) {
      throw new ForbiddenException(
        'You do not have permission to delete custom fields',
      );
    }

    return this.customFieldService.deleteCustomField(organizationId, id);
  }
}
