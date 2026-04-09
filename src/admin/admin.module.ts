import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import { AuthModule } from '../auth/auth.module';
import { parseSizeToBytes } from '../common/utils/parse-size';
import { ProjectsModule } from '../projects/projects.module';
import { VersionsModule } from '../versions/versions.module';
import { AdminController } from './admin.controller';

const DEFAULT_MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    VersionsModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uploadTmpDir = configService.get<string>('UPLOAD_TMP_DIR', 'storage/tmp');
        const absoluteUploadTmpDir = join(process.cwd(), uploadTmpDir);

        mkdirSync(absoluteUploadTmpDir, { recursive: true });

        return {
          storage: diskStorage({
            destination: absoluteUploadTmpDir,
            filename: (_request, file, callback) => {
              callback(null, `${Date.now()}-${randomUUID()}${extname(file.originalname)}`);
            },
          }),
          limits: {
            fileSize: parseSizeToBytes(
              configService.get<string>('MAX_UPLOAD_SIZE', '500mb'),
              DEFAULT_MAX_UPLOAD_BYTES,
            ),
          },
        };
      },
    }),
  ],
  controllers: [AdminController],
})
export class AdminModule {}