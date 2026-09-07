import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { CustomLogger } from './common/logger/logger.service';

async function bootstrap() {
  const logger = new CustomLogger();
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Trust proxy for Nginx forwarding
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Enable security headers via Helmet
  app.use(helmet());

  // Retrieve ConfigService to fetch dynamic configurations
  const configService = app.get(ConfigService);
  const allowedOriginsEnv = configService.get<string>('ALLOWED_ORIGINS') || '';
  const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(Boolean);

  // Enable CORS with strict dynamic origin matching
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  // Enable Global Pipes for class-validator DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip out properties that are not defined in the DTO
      transform: true, // transform payloads to be objects typed according to DTO classes
    }),
  );

  // Setup Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Enterprise Project Management System API')
    .setDescription('The API documentation for EPMS (inspired by Zoho/OpenProject)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
