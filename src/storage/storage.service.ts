import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { existsSync, mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { join } from 'path';

import { AppPlatform } from '../common/enums/platform.enum';
import { slugify } from '../common/utils/slugify';

type StoreFileInput = {
  file: Express.Multer.File;
  projectName: string;
  platform: AppPlatform;
  buildNumber: number;
};

export type StoredFile = {
  downloadUrl: string;
  storageKey: string;
  fileSize: number;
};

type StorageDriver = 'local' | 's3';

@Injectable()
export class StorageService {
  constructor(
    private readonly configService: ConfigService,
    @Inject('S3_CLIENT') private readonly s3Client: S3Client | null,
  ) {}

  async storeFile(input: StoreFileInput): Promise<StoredFile> {
    const driver = this.configService.get<StorageDriver>('STORAGE_DRIVER', 'local');

    if (driver === 's3') {
      return this.storeInS3(input);
    }

    return this.storeLocally(input);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const driver = this.configService.get<StorageDriver>('STORAGE_DRIVER', 'local');

    if (driver === 's3') {
      await this.deleteFromS3(storageKey);
      return;
    }

    const fullPath = join(process.cwd(), 'storage', storageKey);

    try {
      await unlink(fullPath);
    } catch {
      return;
    }
  }

  private async storeLocally(input: StoreFileInput): Promise<StoredFile> {
    const root = this.configService.get<string>('STORAGE_LOCAL_ROOT', 'storage/uploads');
    const relativeDirectory = join(
      root.replace(/^storage[\\/]/, ''),
      slugify(input.projectName),
      input.platform,
    );
    const absoluteDirectory = join(process.cwd(), 'storage', relativeDirectory);

    if (!existsSync(absoluteDirectory)) {
      mkdirSync(absoluteDirectory, { recursive: true });
    }

    const fileName = `${input.buildNumber}-${Date.now()}-${slugify(input.file.originalname)}`;
    const storageKey = join(relativeDirectory, fileName);
    const absolutePath = join(process.cwd(), 'storage', storageKey);

    await writeFile(absolutePath, input.file.buffer);

    return {
      downloadUrl: this.buildLocalDownloadUrl(storageKey),
      storageKey,
      fileSize: input.file.size,
    };
  }

  private async storeInS3(input: StoreFileInput): Promise<StoredFile> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('S3 client is not configured');
    }

    const bucket = this.configService.get<string>('S3_BUCKET');

    if (!bucket) {
      throw new InternalServerErrorException('S3 bucket is not configured');
    }

    const storageKey = [
      this.configService.get<string>('S3_PREFIX', 'uploads').replace(/^\/+|\/+$/g, ''),
      slugify(input.projectName),
      input.platform,
      `${input.buildNumber}-${Date.now()}-${slugify(input.file.originalname)}`,
    ]
      .filter(Boolean)
      .join('/');

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: input.file.buffer,
        ContentType: input.file.mimetype,
      }),
    );

    return {
      downloadUrl: this.buildS3DownloadUrl(storageKey),
      storageKey,
      fileSize: input.file.size,
    };
  }

  private async deleteFromS3(storageKey: string): Promise<void> {
    if (!this.s3Client) {
      return;
    }

    const bucket = this.configService.get<string>('S3_BUCKET');

    if (!bucket) {
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: storageKey,
        }),
      );
    } catch {
      return;
    }
  }

  private buildLocalDownloadUrl(storageKey: string): string {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000').replace(/\/$/, '');
    const normalizedKey = storageKey.split('\\').join('/');

    return `${baseUrl}/downloads/${normalizedKey}`;
  }

  private buildS3DownloadUrl(storageKey: string): string {
    const publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '');

    if (publicBaseUrl) {
      return `${publicBaseUrl}/${storageKey}`;
    }

    const endpoint = this.configService.get<string>('S3_ENDPOINT', '').replace(/\/$/, '');
    const bucket = this.configService.get<string>('S3_BUCKET', '');

    return `${endpoint}/${bucket}/${storageKey}`;
  }
}