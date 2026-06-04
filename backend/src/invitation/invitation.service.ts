import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async createInvitation(organizationId: string, currentUserId: string, dto: CreateInvitationDto) {
    // 1. Check if email is already taken by a registered user
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
      },
    });
    if (existingUser) {
      throw new ForbiddenException('User with this email already exists in the system');
    }

    // 1.5. Validate allowed email domains from organization settings
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    if (settings && settings.allowedEmailDomains) {
      const allowedDomains = settings.allowedEmailDomains
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);
      
      if (allowedDomains.length > 0) {
        const emailDomain = dto.email.split('@')[1]?.toLowerCase();
        if (!emailDomain || !allowedDomains.includes(emailDomain)) {
          throw new ForbiddenException(
            `Email domain '@${emailDomain || ''}' is not allowed by this organization. Allowed domains: ${settings.allowedEmailDomains}`,
          );
        }
      }
    }

    // 2. Check if role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException('Requested role not found');
    }

    // 3. Generate raw token and hash it
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 4. Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Create invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email,
        organizationId,
        roleId: dto.roleId,
        tokenHash,
        invitedBy: currentUserId,
        expiresAt,
        status: 'PENDING',
      },
    });

    // 6. Log raw token for system administrator / console copy-paste
    console.log(`\n--- INVITATION GENERATED ---`);
    console.log(`Email: ${dto.email}`);
    console.log(`Role: ${role.name}`);
    console.log(`Raw Token: ${rawToken}`);
    console.log(`Use this raw token to join: /accept-invite?token=${rawToken}`);
    console.log(`-----------------------------\n`);

    // 7. Audit Log
    await this.auditService.log(
      organizationId,
      currentUserId,
      'Invitation',
      invitation.id,
      'CREATE_INVITATION',
      null,
      { email: dto.email, role: role.name },
    );

    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      token: rawToken,
    };
  }

  async getInvitations(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(organizationId: string, currentUserId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or already revoked');
    }

    const updatedInvitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'REVOKED',
        deletedAt: new Date(),
      },
    });

    await this.auditService.log(
      organizationId,
      currentUserId,
      'Invitation',
      invitationId,
      'REVOKE_INVITATION',
      { status: invitation.status },
      { status: updatedInvitation.status },
    );

    return { success: true };
  }
}
