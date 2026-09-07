import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    req['requestId'] = requestId;

    // Attach request ID to response header
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl, ip } = req;
      const statusCode = res.statusCode;

      // Extract user ID from JWT bearer token if present
      let userId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
            const payload = JSON.parse(payloadJson);
            if (payload && payload.sub) {
              userId = payload.sub;
            }
          }
        } catch {
          // Ignore decoding issues to keep logging robust
        }
      }

      const logPayload = {
        requestId,
        method,
        path: originalUrl,
        userId,
        statusCode,
        responseTimeMs: duration,
        ipAddress: ip,
      };

      // Log the structured JSON payload
      this.logger.log(JSON.stringify(logPayload));
    });

    next();
  }
}
