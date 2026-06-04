import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    organizationId: string,
    userId: string,
    entityType: string,
    entityId: string,
    action: string,
    oldValue?: any,
    newValue?: any,
  ) {
    const oldValStr = oldValue ? JSON.stringify(oldValue) : null;
    const newValStr = newValue ? JSON.stringify(newValue) : null;

    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType,
        entityId,
        action,
        oldValue: oldValStr,
        newValue: newValStr,
      },
    });
  }

  async getLogs(organizationId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
