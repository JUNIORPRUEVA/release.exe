import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

const DEFAULT_MAX_UPLOAD_SIZE = '500mb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const maxUploadSize = configService.get<string>('MAX_UPLOAD_SIZE', DEFAULT_MAX_UPLOAD_SIZE);

  app.use(json({ limit: maxUploadSize }));
  app.use(urlencoded({ extended: true, limit: maxUploadSize }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(join(process.cwd(), 'storage'), {
    prefix: '/downloads',
  });
  app.enableCors();

  await app.listen(port);
}

bootstrap();
