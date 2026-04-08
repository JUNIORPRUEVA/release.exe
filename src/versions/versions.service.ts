import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';
import { AppPlatform } from '../common/enums/platform.enum';
import { ListVersionsQueryDto } from './dto/list-versions-query.dto';
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

  async uploadVersion(file: Express.Multer.File, payload: UploadVersionDto): Promise<AppVersion> {
    if (!file) {
      throw new BadRequestException('Version file is required');
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

    const storedFile = await this.storageService.storeFile({
      file,
      projectName: project.name,
      platform: payload.platform,
      buildNumber: payload.build_number,
    });

    try {
      return await this.dataSource.transaction(async (manager) => {
        const shouldActivate = payload.is_active ?? !(await manager.exists(AppVersion, {
          where: {
            projectId: project.id,
            platform: payload.platform,
            isActive: true,
          },
        }));

        if (shouldActivate) {
          await manager.update(
            AppVersion,
            { projectId: project.id, platform: payload.platform, isActive: true },
            { isActive: false },
          );
        }

        const version = manager.create(AppVersion, {
          projectId: project.id,
          platform: payload.platform,
          version: payload.version,
          buildNumber: payload.build_number,
          downloadUrl: storedFile.downloadUrl,
          storageKey: storedFile.storageKey,
          fileSize: storedFile.fileSize,
          releaseNotes: payload.release_notes ?? '',
          isRequired: payload.is_required,
          isActive: shouldActivate,
          minSupportedBuild: payload.min_supported_build ?? 0,
        });

        return manager.save(version);
      });
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
}