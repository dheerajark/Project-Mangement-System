import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectGroupService } from './project-group.service';
import { CreateProjectGroupDto } from './dto/create-project-group.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';

@ApiTags('Project Groups')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('project-groups')
export class ProjectGroupController {
  constructor(private readonly projectGroupService: ProjectGroupService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project group' })
  create(@Request() req, @Body() dto: CreateProjectGroupDto) {
    return this.projectGroupService.create(req.user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all project groups for organization' })
  findAll(@Request() req) {
    return this.projectGroupService.findAll(req.user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project group by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.projectGroupService.findOne(req.user.organizationId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a project group' })
  remove(@Request() req, @Param('id') id: string) {
    return this.projectGroupService.remove(req.user.organizationId, id);
  }
}
