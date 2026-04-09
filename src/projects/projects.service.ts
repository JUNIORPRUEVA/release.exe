import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';

import { StorageService } from '../storage/storage.service';
import { AppVersion } from '../versions/version.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(AppVersion)
    private readonly versionRepository: Repository<AppVersion>,
    private readonly storageService: StorageService,
  ) {}

  async createProject(payload: CreateProjectDto): Promise<Project> {
    const existing = await this.projectRepository.findOne({ where: { name: payload.name } });

    if (existing) {
      throw new ConflictException('Project name already exists');
    }

    const project = this.projectRepository.create({
      name: payload.name,
      apiKey: await this.generateUniqueApiKey(),
      isActive: true,
    });

    return this.projectRepository.save(project);
  }

  async listProjects(): Promise<Project[]> {
    return this.projectRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async findByApiKey(apiKey: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { apiKey } });
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.findById(id);
    const versions = await this.versionRepository.find({
      where: { projectId: project.id },
      select: {
        id: true,
        storageKey: true,
      },
    });

    await this.projectRepository.delete({ id: project.id });

    await Promise.all(
      versions.map(async (version) => {
        await this.storageService.deleteFile(version.storageKey);
      }),
    );
  }

  private async generateUniqueApiKey(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = randomBytes(24).toString('base64url');
      const existing = await this.projectRepository.findOne({ where: { apiKey: candidate } });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Failed to generate a unique API key');
  }
}