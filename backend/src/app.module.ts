import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { OrganizationModule } from './organization/organization.module';
import { InvitationModule } from './invitation/invitation.module';
import { ProjectModule } from './project/project.module';
import { ProjectGroupModule } from './project-group/project-group.module';
import { TaskModule } from './task/task.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { MilestoneModule } from './milestone/milestone.module';
import { IssueModule } from './issue/issue.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { DocumentModule } from './document/document.module';
import { CustomFieldModule } from './custom-field/custom-field.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './auth/guards/accessToken.guard';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        ALLOWED_ORIGINS: Joi.string().default(
          'http://localhost:3000,http://localhost:3001,http://localhost:80',
        ),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // limit each IP to 100 requests per ttl
      },
    ]),
    PrismaModule,
    AuthModule,
    AuditModule,
    OrganizationModule,
    InvitationModule,
    ProjectModule,
    ProjectGroupModule,
    TaskModule,
    CustomFieldModule,
    TimeTrackingModule,
    MilestoneModule,
    IssueModule,
    NotificationModule,
    ReportModule,
    HealthModule,
    DocumentModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
