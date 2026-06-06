import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow connections from frontend
  },
  namespace: 'notifications',
})
@Injectable()
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  
  // Track active connection counts
  private activeUserSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    @Inject('NOTIFICATION_EVENT_EMITTER') private eventEmitter: EventEmitter,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const authHeader = socket.handshake.headers.authorization;
        let token = '';

        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        } else {
          token = (socket.handshake.query.token as string) || (socket.handshake.auth?.token as string);
        }

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_ACCESS_SECRET || 'super-secret-jwt-access-key-12345',
        });

        socket.data.userId = payload.sub;
        socket.data.organizationId = payload.organizationId;
        next();
      } catch (err) {
        next(new Error(`Authentication error: ${err.message}`));
      }
    });
    this.logger.log('Notification Socket.IO Gateway initialized with auth middleware.');
  }

  onModuleInit() {
    // Listen to decoupled internal events and push to client real-time
    this.eventEmitter.on('notification.created', (notification: any) => {
      this.sendNotificationToUser(notification.userId, 'notification_received', notification);
    });
  }

  async handleConnection(client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    // Join a room for the user to support multi-tab/multi-device delivery
    await client.join(`user:${userId}`);

    if (!this.activeUserSockets.has(userId)) {
      this.activeUserSockets.set(userId, new Set());
    }
    this.activeUserSockets.get(userId)!.add(client.id);

    this.logger.log(`Socket client connected: ${client.id} for user ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId && this.activeUserSockets.has(userId)) {
      const sockets = this.activeUserSockets.get(userId)!;
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.activeUserSockets.delete(userId);
      }
    }
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  sendNotificationToUser(userId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, payload);
    }
  }
}
