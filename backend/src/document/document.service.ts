import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateVersionDto } from './dto/create-version.dto';

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

  // ─── Folders ─────────────────────────────────────────────────────────────────

  async createFolder(
    organizationId: string,
    userId: string,
    projectId: string,
    dto: CreateFolderDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    const targetOrgId = organizationId || project.organizationId;

    const existing = await this.prisma.projectFolder.findFirst({
      where: {
        projectId,
        parentId: dto.parentId || null,
        name: dto.name,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Folder "${dto.name}" already exists in this directory.`,
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.projectFolder.findFirst({
        where: { id: dto.parentId, projectId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }

    return this.prisma.projectFolder.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        parentId: dto.parentId || null,
        projectId,
        organizationId: targetOrgId,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        parentFolder: { select: { id: true, name: true } },
      },
    });
  }

  async getFolders(organizationId: string, projectId: string) {
    return this.prisma.projectFolder.findMany({
      where: { projectId, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subfolders: true,
        _count: { select: { documents: true, subfolders: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateFolder(
    organizationId: string,
    folderId: string,
    dto: UpdateFolderDto,
  ) {
    const folder = await this.prisma.projectFolder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found');

    return this.prisma.projectFolder.update({
      where: { id: folderId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId || null }),
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async deleteFolder(organizationId: string, folderId: string) {
    const folder = await this.prisma.projectFolder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found');

    return this.prisma.projectFolder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Documents ───────────────────────────────────────────────────────────────

  async createDocument(
    organizationId: string,
    userId: string,
    projectId: string,
    dto: CreateDocumentDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    const targetOrgId = organizationId || project.organizationId;

    if (dto.folderId) {
      const folder = await this.prisma.projectFolder.findFirst({
        where: { id: dto.folderId, projectId, deletedAt: null },
      });
      if (!folder) throw new NotFoundException('Folder not found');
    }

    const versionStr = dto.version || '1.0';

    const document = await this.prisma.projectDocument.create({
      data: {
        name: dto.name,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize || 0,
        mimeType: dto.mimeType || 'application/octet-stream',
        version: versionStr,
        tags: dto.tags || null,
        folderId: dto.folderId || null,
        projectId,
        organizationId: targetOrgId,
        uploadedById: userId,
        taskId: dto.taskId || null,
        issueId: dto.issueId || null,
        versions: {
          create: {
            version: versionStr,
            fileUrl: dto.fileUrl,
            fileSize: dto.fileSize || 0,
            notes: 'Initial upload',
            uploadedById: userId,
          },
        },
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskNumber: true } },
        issue: { select: { id: true, title: true, issueNumber: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return document;
  }

  async getDocuments(
    organizationId: string,
    projectId: string,
    query?: {
      folderId?: string;
      search?: string;
      mimeType?: string;
      taskId?: string;
      issueId?: string;
      tag?: string;
    },
  ) {
    const where: any = {
      projectId,
      deletedAt: null,
    };

    if (query?.folderId === 'root' || query?.folderId === 'null') {
      where.folderId = null;
    } else if (query?.folderId && query.folderId !== 'all') {
      where.folderId = query.folderId;
    }

    if (query?.taskId) {
      where.taskId = query.taskId;
    }

    if (query?.issueId) {
      where.issueId = query.issueId;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search } },
        { tags: { contains: query.search } },
      ];
    }

    if (query?.mimeType && query.mimeType !== 'all') {
      if (query.mimeType === 'image') {
        where.mimeType = { contains: 'image' };
      } else if (query.mimeType === 'pdf') {
        where.mimeType = { contains: 'pdf' };
      } else if (query.mimeType === 'code') {
        where.OR = [
          { mimeType: { contains: 'json' } },
          { mimeType: { contains: 'javascript' } },
          { mimeType: { contains: 'text' } },
        ];
      }
    }

    if (query?.tag) {
      where.tags = { contains: query.tag };
    }

    return this.prisma.projectDocument.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskNumber: true } },
        issue: { select: { id: true, title: true, issueNumber: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentById(organizationId: string, documentId: string) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskNumber: true } },
        issue: { select: { id: true, title: true, issueNumber: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async addVersion(
    organizationId: string,
    userId: string,
    documentId: string,
    dto: CreateVersionDto,
  ) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.projectDocumentVersion.create({
      data: {
        documentId,
        version: dto.version,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize || 0,
        notes: dto.notes || null,
        uploadedById: userId,
      },
    });

    return this.prisma.projectDocument.update({
      where: { id: documentId },
      data: {
        version: dto.version,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize || document.fileSize,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskNumber: true } },
        issue: { select: { id: true, title: true, issueNumber: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async updateDocument(
    organizationId: string,
    documentId: string,
    dto: UpdateDocumentDto,
  ) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    return this.prisma.projectDocument.update({
      where: { id: documentId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId || null }),
        ...(dto.taskId !== undefined && { taskId: dto.taskId || null }),
        ...(dto.issueId !== undefined && { issueId: dto.issueId || null }),
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskNumber: true } },
        issue: { select: { id: true, title: true, issueNumber: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async deleteDocument(organizationId: string, documentId: string) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    return this.prisma.projectDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  }
}
