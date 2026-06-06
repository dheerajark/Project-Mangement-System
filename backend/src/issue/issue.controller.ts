import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateIssueCommentDto } from './dto/create-issue-comment.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { IssueStatus } from '@prisma/client';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  // ─── Create Issue ──────────────────────────────────────────────────────────
  @Post('projects/:projectId/issues')
  @Permissions('CREATE_ISSUE')
  @ApiOperation({ summary: 'Create a new issue in a project' })
  createIssue(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @GetCurrentUserId() userId: string,
    @TenantId() orgId: string,
  ) {
    return this.issueService.createIssue(orgId, userId, projectId, dto);
  }

  // ─── List Project Issues ───────────────────────────────────────────────────
  @Get('projects/:projectId/issues')
  @Permissions('VIEW_ISSUE')
  @ApiOperation({ summary: 'List all active issues for a project' })
  @ApiQuery({ name: 'status', required: false, enum: IssueStatus })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'type', required: false })
  getProjectIssues(
    @Param('projectId') projectId: string,
    @TenantId() orgId: string,
    @Query('status') status?: IssueStatus,
    @Query('severity') severity?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('type') type?: string,
  ) {
    return this.issueService.getProjectIssues(orgId, projectId, {
      status,
      severity,
      assigneeId,
      type,
    });
  }

  // ─── Issue Stats ───────────────────────────────────────────────────────────
  @Get('projects/:projectId/issues/stats')
  @Permissions('VIEW_ISSUE')
  @ApiOperation({ summary: 'Get issue counts for a project' })
  getIssueStats(
    @Param('projectId') projectId: string,
    @TenantId() orgId: string,
  ) {
    return this.issueService.getIssueStats(orgId, projectId);
  }

  // ─── Get Assigned Issues ───────────────────────────────────────────────────
  @Get('issues/assigned')
  @Permissions('VIEW_ISSUE')
  @ApiOperation({ summary: 'Get all issues assigned to the logged-in user' })
  findAssigned(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.issueService.getAssignedIssues(orgId, userId);
  }

  // ─── Get Issue Detail ──────────────────────────────────────────────────────
  @Get('issues/:id')
  @Permissions('VIEW_ISSUE')
  @ApiOperation({ summary: 'Get detailed view of an issue' })
  getIssueById(
    @Param('id') issueId: string,
    @TenantId() orgId: string,
  ) {
    return this.issueService.getIssueById(orgId, issueId);
  }

  // ─── Update Issue ──────────────────────────────────────────────────────────
  @Patch('issues/:id')
  @Permissions('EDIT_ISSUE')
  @ApiOperation({ summary: 'Update an issue' })
  updateIssue(
    @Param('id') issueId: string,
    @Body() dto: UpdateIssueDto,
    @GetCurrentUserId() userId: string,
    @TenantId() orgId: string,
  ) {
    return this.issueService.updateIssue(orgId, userId, issueId, dto);
  }

  // ─── Archive Issue ─────────────────────────────────────────────────────────
  @Post('issues/:id/archive')
  @Permissions('ARCHIVE_ISSUE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-archive an issue' })
  archiveIssue(
    @Param('id') issueId: string,
    @GetCurrentUserId() userId: string,
    @TenantId() orgId: string,
  ) {
    return this.issueService.archiveIssue(orgId, userId, issueId);
  }

  // ─── Add Comment ───────────────────────────────────────────────────────────
  @Post('issues/:id/comments')
  @Permissions('COMMENT_ISSUE')
  @ApiOperation({ summary: 'Add a comment to an issue' })
  addComment(
    @Param('id') issueId: string,
    @Body() dto: CreateIssueCommentDto,
    @GetCurrentUserId() userId: string,
    @TenantId() orgId: string,
  ) {
    return this.issueService.addComment(orgId, userId, issueId, dto);
  }
}
