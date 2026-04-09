import {
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { rename, unlink, writeFile } from 'fs/promises';
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

export type DirectUploadTarget = {
  uploadUrl: string;
  method: 'PUT';
  storageKey: string;
  downloadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
};

type PresignUploadInput = {
  projectName: string;
  platform: AppPlatform;
  buildNumber: number;
  fileName: string;
  fileSize: number;
  contentType?: string;
};

type StorageDriver = 'local' | 's3';

@Injectable()
export class StorageService {
  private readonly s3TimeoutMs = 20_000;

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

  isDirectUploadEnabled(): boolean {
    const driver = this.configService.get<StorageDriver>('STORAGE_DRIVER', 'local');
    const directUploadEnabled = this.configService.get<string>('DIRECT_UPLOAD_ENABLED', 'true') !== 'false';

    return driver === 's3' && directUploadEnabled;
  }

  async createDirectUploadTarget(input: PresignUploadInput): Promise<DirectUploadTarget> {
    if (!this.isDirectUploadEnabled()) {
      throw new BadRequestException('Direct uploads are not enabled for the current storage driver');
    }

    const bucket = this.getConfiguredBucket();
    const contentType = input.contentType?.trim() || 'application/octet-stream';
    const storageKey = this.buildStorageKey({
      projectName: input.projectName,
      platform: input.platform,
      buildNumber: input.buildNumber,
      fileName: input.fileName,
    });
    const expiresInSeconds = Number.parseInt(
      this.configService.get<string>('DIRECT_UPLOAD_URL_EXPIRES_SECONDS', '900'),
      10,
    );

    const uploadUrl = await this.withTimeout(
      getSignedUrl(
        this.s3Client as S3Client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          ContentType: contentType,
        }),
        { expiresIn: Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 900 },
      ),
      this.s3TimeoutMs,
      'Failed to generate direct upload URL',
    );

    return {
      uploadUrl,
      method: 'PUT',
      storageKey,
      downloadUrl: this.buildS3DownloadUrl(storageKey),
      headers: {
        'Content-Type': contentType,
      },
      expiresInSeconds: Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 900,
    };
  }

  async finalizeDirectUpload(storageKey: string, expectedFileSize: number): Promise<StoredFile> {
    if (!this.isDirectUploadEnabled()) {
      throw new BadRequestException('Direct uploads are not enabled for the current storage driver');
    }

    const bucket = this.getConfiguredBucket();
    const objectMetadata = await this.withTimeout(
      this.s3Client!.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: storageKey,
        }),
      ),
      this.s3TimeoutMs,
      'Failed to verify uploaded file in S3',
    );

    const actualFileSize = Number(objectMetadata.ContentLength ?? 0);

    if (!actualFileSize || actualFileSize !== expectedFileSize) {
      throw new BadRequestException('Uploaded file could not be verified in storage');
    }

    return {
      downloadUrl: this.buildS3DownloadUrl(storageKey),
      storageKey,
      fileSize: actualFileSize,
    };
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

    if (input.file.path) {
      await rename(input.file.path, absolutePath);
    } else {
      await writeFile(absolutePath, input.file.buffer);
    }

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

    const bucket = this.getConfiguredBucket();
    const storageKey = this.buildStorageKey({
      projectName: input.projectName,
      platform: input.platform,
      buildNumber: input.buildNumber,
      fileName: input.file.originalname,
    });

    try {
      await this.withTimeout(
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: input.file.path ? createReadStream(input.file.path) : input.file.buffer,
            ContentType: input.file.mimetype,
          }),
        ),
        this.s3TimeoutMs,
        'S3 upload timed out. Verify bucket, endpoint, and credentials.',
      );
    } finally {
      await this.cleanupTemporaryUpload(input.file.path);
    }

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

    if (!bucket || bucket.includes('REEMPLAZAR_CON_NOMBRE_REAL_DEL_BUCKET')) {
      return;
    }

    try {
      await this.withTimeout(
        this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: storageKey,
          }),
        ),
        this.s3TimeoutMs,
        'S3 delete timed out',
      );
    } catch {
      return;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new GatewayTimeoutException(message));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
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

  private getConfiguredBucket(): string {
    const bucket = this.configService.get<string>('S3_BUCKET');

    if (!bucket || bucket.includes('REEMPLAZAR_CON_NOMBRE_REAL_DEL_BUCKET')) {
      throw new InternalServerErrorException('S3 bucket is not configured correctly');
    }

    return bucket;
  }

  private buildStorageKey(input: {
    projectName: string;
    platform: AppPlatform;
    buildNumber: number;
    fileName: string;
  }): string {
    return [
      this.configService.get<string>('S3_PREFIX', 'uploads').replace(/^\/+|\/+$/g, ''),
      slugify(input.projectName),
      input.platform,
      `${input.buildNumber}-${Date.now()}-${slugify(input.fileName)}`,
    ]
      .filter(Boolean)
      .join('/');
  }

  private async cleanupTemporaryUpload(filePath: string | undefined): Promise<void> {
    if (!filePath) {
      return;
    }

    try {
      await unlink(filePath);
    } catch {
      return;
    }
  }
}