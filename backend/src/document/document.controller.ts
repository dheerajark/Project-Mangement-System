import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Documents & Files')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  // ─── Folders ─────────────────────────────────────────────────────────────────

  @Post('projects/:projectId/folders')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Create a new folder in project' })
  @ApiResponse({ status: 201, description: 'Folder created successfully.' })
  createFolder(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.documentService.createFolder(
      organizationId,
      userId,
      projectId,
      dto,
    );
  }

  @Get('projects/:projectId/folders')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get all folders in project' })
  @ApiResponse({ status: 200, description: 'Folders retrieved successfully.' })
  getFolders(
    @TenantId() organizationId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.documentService.getFolders(organizationId, projectId);
  }

  @Patch('folders/:id')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Update folder details' })
  @ApiResponse({ status: 200, description: 'Folder updated successfully.' })
  updateFolder(
    @TenantId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.documentService.updateFolder(organizationId, id, dto);
  }

  @Delete('folders/:id')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Delete folder' })
  @ApiResponse({ status: 200, description: 'Folder deleted successfully.' })
  deleteFolder(@TenantId() organizationId: string, @Param('id') id: string) {
    return this.documentService.deleteFolder(organizationId, id);
  }

  // ─── Documents ───────────────────────────────────────────────────────────────

  @Post('projects/:projectId/documents')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Upload/Create a document in project' })
  @ApiResponse({ status: 201, description: 'Document created successfully.' })
  createDocument(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentService.createDocument(
      organizationId,
      userId,
      projectId,
      dto,
    );
  }

  @Get('projects/:projectId/documents')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get all documents in project with filtering' })
  @ApiResponse({
    status: 200,
    description: 'Documents retrieved successfully.',
  })
  getDocuments(
    @TenantId() organizationId: string,
    @Param('projectId') projectId: string,
    @Query('folderId') folderId?: string,
    @Query('search') search?: string,
    @Query('mimeType') mimeType?: string,
    @Query('taskId') taskId?: string,
    @Query('issueId') issueId?: string,
    @Query('tag') tag?: string,
  ) {
    return this.documentService.getDocuments(organizationId, projectId, {
      folderId,
      search,
      mimeType,
      taskId,
      issueId,
      tag,
    });
  }

  @Get('documents/:id')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get single document details with version history' })
  @ApiResponse({
    status: 200,
    description: 'Document details retrieved successfully.',
  })
  getDocumentById(@TenantId() organizationId: string, @Param('id') id: string) {
    return this.documentService.getDocumentById(organizationId, id);
  }

  @Post('documents/:id/versions')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Upload new version of document' })
  @ApiResponse({ status: 201, description: 'New version added successfully.' })
  addVersion(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.documentService.addVersion(organizationId, userId, id, dto);
  }

  @Patch('documents/:id')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiResponse({ status: 200, description: 'Document updated successfully.' })
  updateDocument(
    @TenantId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentService.updateDocument(organizationId, id, dto);
  }

  @Delete('documents/:id')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully.' })
  deleteDocument(@TenantId() organizationId: string, @Param('id') id: string) {
    return this.documentService.deleteDocument(organizationId, id);
  }
}
