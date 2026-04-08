import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

import { StorageService } from './storage.service';

@Module({
  providers: [
    {
      provide: 'S3_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): S3Client | null => {
        if (configService.get<string>('STORAGE_DRIVER', 'local') !== 's3') {
          return null;
        }

        return new S3Client({
          region: configService.get<string>('S3_REGION', 'auto'),
          endpoint: configService.get<string>('S3_ENDPOINT'),
          credentials: {
            accessKeyId: configService.get<string>('S3_ACCESS_KEY_ID', ''),
            secretAccessKey: configService.get<string>('S3_SECRET_ACCESS_KEY', ''),
          },
          forcePathStyle: configService.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}