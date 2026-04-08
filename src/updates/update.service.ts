import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from '../projects/project.entity';
import { UpdateLog } from '../logs/log.entity';
import { CheckUpdateQueryDto } from './dto/check-update-query.dto';
import { VersionsService } from '../versions/versions.service';
import { AppPlatform } from '../common/enums/platform.enum';

type CachedVersion = {
  expiresAt: number;
  value: Awaited<ReturnType<VersionsService['getLatestVersion']>>;
};

@Injectable()
export class UpdateService {
  private readonly latestVersionCache = new Map<string, CachedVersion>();
  private readonly cacheTtlMs = 30_000;

  constructor(
    private readonly versionsService: VersionsService,
    @InjectRepository(UpdateLog)
    private readonly logRepository: Repository<UpdateLog>,
  ) {}

  async getLatestVersion(projectId: string, platform: AppPlatform) {
    const cacheKey = `${projectId}:${platform}`;
    const cached = this.latestVersionCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const latestVersion = await this.versionsService.getLatestVersion(projectId, platform);
    this.latestVersionCache.set(cacheKey, {
      expiresAt: Date.now() + this.cacheTtlMs,
      value: latestVersion,
    });

    return latestVersion;
  }

  compareVersions(currentBuild: number, latestVersion: Awaited<ReturnType<UpdateService['getLatestVersion']>>) {
    return this.versionsService.compareVersions(currentBuild, latestVersion);
  }

  async checkForUpdate(project: Project, query: CheckUpdateQueryDto, ip: string | null) {
    const latestVersion = await this.getLatestVersion(project.id, query.platform);
    const comparison = this.compareVersions(query.current_build, latestVersion);

    await this.logRepository.save(
      this.logRepository.create({
        projectId: project.id,
        platform: query.platform,
        currentVersion: query.current_version ?? null,
        currentBuild: query.current_build,
        ip,
      }),
    );

    return {
      update: comparison.update,
      required: comparison.required,
      latest_version: latestVersion?.version ?? null,
      latest_build: latestVersion?.buildNumber ?? null,
      download_url: latestVersion?.downloadUrl ?? null,
      release_notes: latestVersion?.releaseNotes ?? null,
      file_size: latestVersion?.fileSize ?? null,
    };
  }
}