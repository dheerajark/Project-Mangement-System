import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins for development, can restrict to frontend URL later
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
