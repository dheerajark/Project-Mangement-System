import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitter } from 'events';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}), // Registers JwtService for validation in socket gateway
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    {
      provide: 'NOTIFICATION_EVENT_EMITTER',
      useValue: new EventEmitter(),
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
