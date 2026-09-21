import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectGroupDto } from './dto/create-project-group.dto';

@Injectable()
export class ProjectGroupService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateProjectGroupDto) {
    return this.prisma.projectGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color || '#6366f1',
        organizationId,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.projectGroup.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const group = await this.prisma.projectGroup.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        projects: true,
      },
    });
    if (!group) {
      throw new NotFoundException(`Project group with ID ${id} not found`);
    }
    return group;
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.projectGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
