import { PrismaService } from '../../prisma/prisma.service';
import { ProjectMemberRole } from '@prisma/client';

/**
 * Checks if a user has Client user status either via their project membership role (CLIENT)
 * or via their system profile / role name ('Client').
 */
export async function isClientUser(
  prisma: PrismaService,
  userId: string,
  projectId?: string,
): Promise<boolean> {
  // 1. Check project-specific role
  if (projectId) {
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId, deletedAt: null },
      select: { role: true },
    });
    if (member?.role === ProjectMemberRole.CLIENT) {
      return true;
    }
  }

  // 2. Check user's assigned profile or role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      userProfile: {
        select: { profile: { select: { name: true } } },
      },
      userRoles: {
        select: { role: { select: { name: true } } },
      },
    },
  });

  if (user?.userProfile?.profile?.name?.toLowerCase().includes('client')) {
    return true;
  }

  if (
    user?.userRoles?.some((ur) =>
      ur.role.name?.toLowerCase().includes('client'),
    )
  ) {
    return true;
  }

  return false;
}
