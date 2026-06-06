import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { OrganizationModule } from './organization/organization.module';
import { InvitationModule } from './invitation/invitation.module';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { MilestoneModule } from './milestone/milestone.module';
import { IssueModule } from './issue/issue.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './auth/guards/accessToken.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    OrganizationModule,
    InvitationModule,
    ProjectModule,
    TaskModule,
    TimeTrackingModule,
    MilestoneModule,
    IssueModule,
    NotificationModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
