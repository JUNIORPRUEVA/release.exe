import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

import { StorageService } from './storage.service';

function getStorageConfig(configService: ConfigService, primaryKey: string, aliasKey: string, fallback = ''): string {
  return configService.get<string>(primaryKey) ?? configService.get<string>(aliasKey, fallback);
}

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
          region: getStorageConfig(configService, 'S3_REGION', 'R2_REGION', 'auto'),
          endpoint: getStorageConfig(configService, 'S3_ENDPOINT', 'R2_ENDPOINT'),
          credentials: {
            accessKeyId: getStorageConfig(configService, 'S3_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
            secretAccessKey: getStorageConfig(configService, 'S3_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
          },
          forcePathStyle: getStorageConfig(configService, 'S3_FORCE_PATH_STYLE', 'R2_FORCE_PATH_STYLE', 'true') === 'true',
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}