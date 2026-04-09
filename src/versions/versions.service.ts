import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { DirectUploadTarget, StoredFile, StorageService } from '../storage/storage.service';
import { AppPlatform } from '../common/enums/platform.enum';
import { CompleteUploadVersionDto } from './dto/complete-upload-version.dto';
import { ListVersionsQueryDto } from './dto/list-versions-query.dto';
import { PresignUploadVersionDto } from './dto/presign-upload-version.dto';
import { UploadVersionDto } from './dto/upload-version.dto';
import { AppVersion } from './version.entity';

@Injectable()
export class VersionsService {
  constructor(
    @InjectRepository(AppVersion)
    private readonly versionRepository: Repository<AppVersion>,
    private readonly dataSource: DataSource,
    private readonly projectsService: ProjectsService,
    private readonly storageService: StorageService,
  ) {}

  isDirectUploadEnabled(): boolean {
    return this.storageService.isDirectUploadEnabled();
  }

  async uploadVersion(file: Express.Multer.File, payload: UploadVersionDto): Promise<AppVersion> {
    if (!file) {
      throw new BadRequestException('Version file is required');
    }

    const project = await this.validateUploadPayload(payload);

    const storedFile = await this.storageService.storeFile({
      file,
      projectName: project.name,
      platform: payload.platform,
      buildNumber: payload.build_number,
    });

    try {
      return await this.persistVersionRecord(project.id, payload, storedFile);
    } catch (error) {
      await this.storageService.deleteFile(storedFile.storageKey);
      throw error;
    }
  }

  async createDirectUploadTarget(payload: PresignUploadVersionDto): Promise<DirectUploadTarget> {
    const project = await this.validateUploadPayload(payload);

    if (!this.storageService.isDirectUploadEnabled()) {
      throw new BadRequestException('Direct upload is not available for the current storage driver');
    }

    return this.storageService.createDirectUploadTarget({
      projectName: project.name,
      platform: payload.platform,
      buildNumber: payload.build_number,
      fileName: payload.file_name,
      fileSize: payload.file_size,
      contentType: payload.content_type,
    });
  }

  async completeDirectUpload(payload: CompleteUploadVersionDto): Promise<AppVersion> {
    const project = await this.validateUploadPayload(payload);

    if (!this.storageService.isDirectUploadEnabled()) {
      throw new BadRequestException('Direct upload is not available for the current storage driver');
    }

    const storedFile = await this.storageService.finalizeDirectUpload(payload.storage_key, payload.file_size);

    try {
      return await this.persistVersionRecord(project.id, payload, storedFile);
    } catch (error) {
      await this.storageService.deleteFile(storedFile.storageKey);
      throw error;
    }
  }

  async listVersions(query: ListVersionsQueryDto): Promise<AppVersion[]> {
    const where: FindOptionsWhere<AppVersion> = {};

    if (query.project_id) {
      where.projectId = query.project_id;
    }

    if (query.platform) {
      where.platform = query.platform;
    }

    return this.versionRepository.find({
      where,
      relations: {
        project: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async activateVersion(id: string): Promise<AppVersion> {
    const version = await this.versionRepository.findOne({ where: { id } });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        AppVersion,
        { projectId: version.projectId, platform: version.platform, isActive: true },
        { isActive: false },
      );
      await manager.update(AppVersion, { id: version.id }, { isActive: true });
    });

    return this.findById(id);
  }

  async deleteVersion(id: string): Promise<void> {
    const version = await this.versionRepository.findOne({ where: { id } });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AppVersion, { id: version.id });

      if (version.isActive) {
        const fallback = await manager.findOne(AppVersion, {
          where: {
            projectId: version.projectId,
            platform: version.platform,
          },
          order: {
            buildNumber: 'DESC',
            createdAt: 'DESC',
          },
        });

        if (fallback) {
          await manager.update(AppVersion, { id: fallback.id }, { isActive: true });
        }
      }
    });

    await this.storageService.deleteFile(version.storageKey);
  }

  async getLatestVersion(projectId: string, platform: AppPlatform): Promise<AppVersion | null> {
    return this.versionRepository.findOne({
      where: {
        projectId,
        platform,
        isActive: true,
      },
      order: {
        buildNumber: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  compareVersions(currentBuild: number, latestVersion: AppVersion | null): {
    update: boolean;
    required: boolean;
  } {
    if (!latestVersion) {
      return {
        update: false,
        required: false,
      };
    }

    return {
      update: latestVersion.buildNumber > currentBuild,
      required: currentBuild < latestVersion.minSupportedBuild,
    };
  }

  private async findById(id: string): Promise<AppVersion> {
    const version = await this.versionRepository.findOne({
      where: { id },
      relations: { project: true },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    return version;
  }

  private async validateUploadPayload(payload: UploadVersionDto): Promise<{ id: string; name: string }> {
    if (
      payload.min_supported_build != null &&
      payload.min_supported_build > payload.build_number
    ) {
      throw new BadRequestException('Min supported build cannot be greater than build number');
    }

    const project = await this.projectsService.findById(payload.project_id);
    const duplicate = await this.versionRepository.findOne({
      where: {
        projectId: project.id,
        platform: payload.platform,
        buildNumber: payload.build_number,
      },
    });

    if (duplicate) {
      throw new ConflictException('Build number already exists for this project and platform');
    }

    return {
      id: project.id,
      name: project.name,
    };
  }

  private async persistVersionRecord(
    projectId: string,
    payload: UploadVersionDto,
    storedFile: StoredFile,
  ): Promise<AppVersion> {
    const { savedVersion, replacedStorageKeys } = await this.dataSource.transaction(async (manager) => {
      const existingVersions = await manager.find(AppVersion, {
        where: {
          projectId,
          platform: payload.platform,
        },
      });

      const version = manager.create(AppVersion, {
        projectId,
        platform: payload.platform,
        version: payload.version,
        buildNumber: payload.build_number,
        downloadUrl: storedFile.downloadUrl,
        storageKey: storedFile.storageKey,
        fileSize: storedFile.fileSize,
        releaseNotes: payload.release_notes ?? '',
        isRequired: payload.is_required,
        isActive: true,
        minSupportedBuild: payload.min_supported_build ?? 0,
      });

      const savedVersion = await manager.save(version);

      if (existingVersions.length > 0) {
        await manager.delete(AppVersion, {
          id: In(existingVersions.map((item) => item.id)),
        });
      }

      return {
        savedVersion,
        replacedStorageKeys: existingVersions.map((item) => item.storageKey),
      };
    });

    await Promise.all(
      replacedStorageKeys.map(async (storageKey) => {
        if (storageKey !== storedFile.storageKey) {
          await this.storageService.deleteFile(storageKey);
        }
      }),
    );

    return savedVersion;
  }
}