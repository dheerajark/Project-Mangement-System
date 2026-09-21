import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    // Basic liveness check - returns 200 OK immediately if application process is running
    return this.health.check([]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  ready() {
    // Readiness check - verifies PostgreSQL database connectivity via Prisma
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),
    ]);
  }
}
